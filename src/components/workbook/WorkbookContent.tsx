'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, CheckCircle2, Clock3, ExternalLink, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

type ReviewFilter = "all" | "pending" | "reviewed";

type WorkbookEntry = {
  id: string;
  sessionId?: string | null;
  bidderUserId?: string | null;
  bidderName?: string | null;
  bidderEmail?: string | null;
  profileId?: string | null;
  profileDisplayName?: string | null;
  resumeId?: string | null;
  url?: string | null;
  domain?: string | null;
  createdAt: string;
  isReviewed?: boolean | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewerName?: string | null;
  reviewerEmail?: string | null;
};

type ProfileOption = {
  id: string;
  displayName: string;
  assignedBidderId?: string | null;
};

export default function WorkbookContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, loading } = useAuth();
  const [entries, setEntries] = useState<WorkbookEntry[]>([]);
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [loadingList, setLoadingList] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createUrl, setCreateUrl] = useState("");
  const [createProfileId, setCreateProfileId] = useState("");
  const [createProfileHint] = useState("");

  const loadEntries = useCallback(
    async (authToken: string) => {
      setLoadingList(true);
      setError("");
      try {
        const data = await api<WorkbookEntry[]>("/manager/applications", undefined, authToken);
        setEntries(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load workbook entries.");
      } finally {
        setLoadingList(false);
      }
    },
    [],
  );

  const loadProfiles = useCallback(async (authToken: string) => {
    try {
      const data = await api<ProfileOption[]>("/profiles", undefined, authToken);
      const assigned = data.filter((p) => Boolean(p.assignedBidderId));
      setProfileOptions(assigned);
      if (assigned.length && !createProfileId) {
        setCreateProfileId(assigned[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }, [createProfileId]);

  useEffect(() => {
    if (!createProfileId) return;
    const selected = profileOptions.find((p) => p.id === createProfileId);
  }, [createProfileId, profileOptions]);

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace("/auth");
      return;
    }
    const allowed = user.role === "MANAGER" || user.role === "ADMIN" || user.role === "BIDDER";
    if (!allowed) {
      router.replace("/workspace");
      return;
    }
    void loadEntries(token);
    void loadProfiles(token);
  }, [loading, user, token, router, loadEntries, loadProfiles]);

  useEffect(() => {
    const status = (searchParams?.get("status") ?? "").toLowerCase();
    const mapped =
      status === "pending"
        ? "pending"
        : status === "reviewed" || status === "accepted" || status === "rejected"
        ? "reviewed"
        : "all";
    setReviewFilter(mapped as ReviewFilter);
  }, [searchParams]);

  const setFilterAndQuery = (next: ReviewFilter) => {
    setReviewFilter(next);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "all") {
      params.delete("status");
    } else if (next === "pending") {
      params.set("status", "pending");
    } else {
      params.set("status", "reviewed");
    }
    const query = params.toString();
    router.replace(query ? `/work-book?${query}` : "/work-book");
  };

  const filtered = useMemo(() => {
    const query = normalizeSearch(search);
    const statusParam = (searchParams?.get("status") ?? "").toLowerCase();
    const statusTarget =
      statusParam === "pending"
        ? "in_review"
        : statusParam === "accepted"
        ? "accepted"
        : statusParam === "rejected"
        ? "rejected"
        : statusParam === "reviewed"
        ? "reviewed"
        : null;
    return entries.filter((entry) => {
      if (statusTarget) {
        const statusValue = (entry.status ?? "in_review").toLowerCase();
        if (statusTarget === "reviewed") {
          if (statusValue !== "accepted" && statusValue !== "rejected" && statusValue !== "reviewed")
            return false;
        } else if (statusValue !== statusTarget) {
          return false;
        }
      } else {
        if (reviewFilter === "pending" && toBool(entry.isReviewed)) return false;
        if (reviewFilter === "reviewed" && !toBool(entry.isReviewed)) return false;
      }
      if (!query) return true;
      const target = buildSearchTarget(entry);
      return target.includes(query);
    });
  }, [entries, reviewFilter, search, searchParams]);

  const pendingCount = useMemo(
    () => entries.filter((entry) => !toBool(entry.isReviewed)).length,
    [entries],
  );
  const reviewedCount = entries.length - pendingCount;

  const handleToggleReview = async (entry: WorkbookEntry) => {
    if (!token) return;
    setUpdatingId(entry.id);
    setError("");
    try {
      const updated = await api<WorkbookEntry>(
        `/manager/applications/${entry.id}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({ isReviewed: !toBool(entry.isReviewed) }),
        },
        token,
      );
      setEntries((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      console.error(err);
      setError("Could not update review status.");
    } finally {
      setUpdatingId("");
    }
  };

  const reviewButtonClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition ${
      active
        ? "border-slate-900 bg-slate-900 text-white"
        : "border-slate-200 text-slate-700 hover:bg-slate-100"
    }`;

  const confirmAndCreate = () => {
    if (!createProfileId) {
      setError("Select a profile to add.");
      return;
    }
    const ok = window.confirm("Add this job to the Work Book with auto date/owner?");
    if (!ok) return;
    void handleCreate();
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!createProfileId) {
      setError("Select a profile to add.");
      return;
    }
    setCreateLoading(true);
    setError("");
    try {
      const created = await api<WorkbookEntry>(
        "/manager/applications",
        {
          method: "POST",
          body: JSON.stringify({
            profileId: createProfileId,
            url: createUrl.trim(),
          }),
        },
        token,
      );
      setEntries((prev) => [created, ...prev]);
      setCreateUrl("");
      const selected = profileOptions.find((p) => p.id === createProfileId);  
    } catch (err) {
      console.error(err);
      setError("Could not add to workbook.");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-slate-900 shadow-lg shadow-indigo-500/25">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Manager
            </p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
              Work book
            </h1>
          </div>
        </div>
        <p className="max-w-2xl text-base leading-relaxed text-slate-600">
          Track every application submitted by bidders, mark what you have reviewed, and keep job
          links handy.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-400/60 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex-1 space-y-1">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by ID, URL, profile, bidder, or domain..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
            />
          </label>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Review status</div>
            <select
              value={reviewFilter}
              onChange={(e) => setFilterAndQuery(e.target.value as ReviewFilter)}
              className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => token && loadEntries(token)}
              disabled={loadingList}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
            {filtered.length !== entries.length ? ` of ${entries.length}` : ""}
          </div>
          <div>
            {reviewFilter === "all"
              ? "All statuses"
              : reviewFilter === "pending"
              ? "Pending review"
              : "Reviewed"}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <div className="min-w-[1100px]">
            <div className="grid grid-cols-[160px_120px_1.5fr_1.1fr_1.1fr_1fr_1.2fr] items-center bg-slate-50 px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-600">
              <div>ID</div>
              <div>Date</div>
              <div>Job URL</div>
              <div>Profile</div>
              <div>Who</div>
              <div>Is reviewed</div>
              <div>Other</div>
            </div>

            <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1">
                  <input
                    value={createUrl}
                    onChange={(e) => setCreateUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmAndCreate();
                      }
                    }}
                    placeholder="https://example.com/job"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                </div>
                <div className="w-full md:w-72">
                  <select
                    value={createProfileId}
                    onChange={(e) => setCreateProfileId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  >
                    {profileOptions.length === 0 ? (
                      <option value="">No assigned profiles</option>
                    ) : (
                      profileOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={confirmAndCreate}
                    disabled={createLoading || profileOptions.length === 0}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {createLoading ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {loadingList && entries.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-600">Loading applications...</div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-600">No applications found.</div>
              ) : (
                filtered.map((entry) => {
                  const reviewed = toBool(entry.isReviewed);
                  const reviewerLabel = entry.reviewerName || entry.reviewerEmail;
                  return (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[160px_120px_1.5fr_1.1fr_1.1fr_1fr_1.2fr] items-start gap-3 px-4 py-3 text-sm text-slate-800"
                    >
                      <div className="space-y-1 font-mono text-xs text-slate-600">
                        <div className="truncate" title={entry.id}>
                          {entry.id}
                        </div>
                        {entry.sessionId ? (
                          <div className="text-[11px] text-slate-500" title={entry.sessionId}>
                            Session: {entry.sessionId}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-600">{formatDate(entry.createdAt)}</div>
                      <div className="space-y-1">
                        {entry.url ? (
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-slate-800 underline decoration-slate-300 hover:text-slate-900"
                            title={entry.url}
                          >
                            <span className="truncate">{entry.domain || entry.url}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">No URL</span>
                        )}
                      </div>
                      <div className="text-slate-800">
                        {entry.profileDisplayName || (
                          <span className="text-xs text-slate-500">Unknown</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900">
                          {entry.bidderName || entry.bidderEmail || "Unknown"}
                        </div>
                        {entry.bidderEmail ? (
                          <div className="text-xs text-slate-500">{entry.bidderEmail}</div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <div
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            reviewed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {reviewed ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                          {reviewed ? "Reviewed" : "Pending"}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleReview(entry)}
                          disabled={updatingId === entry.id}
                          className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingId === entry.id
                            ? "Updating..."
                            : reviewed
                            ? "Mark pending"
                            : "Mark reviewed"}
                        </button>
                        {reviewed && (entry.reviewedAt || reviewerLabel) ? (
                          <div className="text-[11px] leading-relaxed text-slate-500">
                            {reviewerLabel ? <div>By {reviewerLabel}</div> : null}
                            {entry.reviewedAt ? <div>{formatDate(entry.reviewedAt)}</div> : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="font-semibold text-slate-800">
                          {entry.domain || "Domain unknown"}
                        </div>
                        <div className="text-slate-500">
                          Resume: {entry.resumeId ? entry.resumeId.slice(0, 8) : "None"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "amber";
}) {
  const toneClasses =
    tone === "emerald"
      ? "from-emerald-50 to-white border-emerald-100 text-emerald-900"
      : tone === "amber"
      ? "from-amber-50 to-white border-amber-100 text-amber-900"
      : "from-slate-50 to-white border-slate-200 text-slate-900";
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${toneClasses} px-4 py-3 shadow-sm`}>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function buildSearchTarget(entry: WorkbookEntry) {
  const parts = [
    entry.id,
    entry.sessionId,
    entry.url,
    entry.domain,
    entry.profileId,
    entry.profileDisplayName,
    entry.bidderUserId,
    entry.bidderName,
    entry.bidderEmail,
    entry.resumeId,
    entry.createdAt,
  ];
  return normalizeSearch(parts.filter(Boolean).join(" "));
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toBool(value?: boolean | null) {
  return Boolean(value);
}
