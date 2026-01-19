'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Filter, CheckCircle2, Clock3, XCircle, ChevronDown } from "lucide-react";
import WorkbookShell from "../../../components/WorkbookShell";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";

type StatusKey = "all" | "in_review" | "accepted" | "rejected";

type ApplicationRow = {
  id: string;
  bidderUserId?: string | null;
  bidderName?: string | null;
  bidderEmail?: string | null;
  profileDisplayName?: string | null;
  url?: string | null;
  domain?: string | null;
  status?: "in_review" | "accepted" | "rejected" | null;
  createdAt: string;
};

export default function MyApplicationsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [error, setError] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [statusOpen, setStatusOpen] = useState(false);
  const [quickFiltersOpen, setQuickFiltersOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string>("");

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace("/auth");
      return;
    }
    const allowed = user.role === "BIDDER" || user.role === "MANAGER" || user.role === "ADMIN";
    if (!allowed) {
      router.replace("/workspace");
      return;
    }
    const load = async () => {
      setLoadingList(true);
      setError("");
      try {
        const data = await api<ApplicationRow[]>("/manager/applications", undefined, token);
        setRows(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load applications.");
      } finally {
        setLoadingList(false);
      }
    };
    void load();
  }, [loading, user, token, router]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((row) => (row.status ?? "in_review") === statusFilter);
  }, [rows, statusFilter]);

  const statusLabel = (status: StatusKey | null | undefined) => {
    const value = status ?? "in_review";
    if (value === "accepted") return "Accepted";
    if (value === "rejected") return "Rejected";
    if (value === "in_review") return "In review";
    return "All";
  };

  const statusChip = (status: StatusKey | null | undefined) => {
    const value = status ?? "in_review";
    const base =
      value === "accepted"
        ? "bg-emerald-50 text-emerald-700"
        : value === "rejected"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-700";
    const Icon = value === "accepted" ? CheckCircle2 : value === "rejected" ? XCircle : Clock3;
    return (
      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${base}`}>
        <Icon className="h-4 w-4" />
        {statusLabel(value)}
      </span>
    );
  };

  const updateStatus = async (id: string, next: StatusKey) => {
    if (!token) return;
    if (next === "all") return;
    setUpdatingId(id);
    setError("");
    try {
      const updated = await api<ApplicationRow>(
        `/manager/applications/${id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: next }),
        },
        token,
      );
      setRows((prev) => prev.map((row) => (row.id === updated.id ? { ...row, status: updated.status } : row)));
    } catch (err) {
      console.error(err);
      setError("Failed to update status.");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <WorkbookShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                Work book
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">My applications</h1>
              <p className="mt-2 text-sm text-slate-600">See everything you've submitted, with status filters.</p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                <Filter className="h-4 w-4" />
                {statusLabel(statusFilter)}
                <ChevronDown className={`h-4 w-4 transition ${statusOpen ? "rotate-180" : ""}`} />
              </button>
              {statusOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg">
                  {(["all", "in_review", "accepted", "rejected"] as StatusKey[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setStatusFilter(option);
                        setStatusOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 ${
                        statusFilter === option ? "bg-slate-50 font-semibold" : ""
                      }`}
                    >
                      <span>{statusLabel(option)}</span>
                      {statusFilter === option ? <span className="text-xs text-slate-500">✓</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-400/60 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[150px_1fr_1fr_1fr_1fr] items-center bg-slate-50 px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-600">
            <div>Date</div>
            <div>Job URL</div>
            <div>Profile</div>
            <div>Status</div>
            <div>Who</div>
          </div>
          <div className="divide-y divide-slate-200">
            {loadingList ? (
              <div className="px-4 py-6 text-sm text-slate-600">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">No applications found.</div>
            ) : (
              filtered.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[150px_1fr_1fr_1fr_1fr] items-start gap-3 px-4 py-3 text-sm text-slate-800"
                >
                  <div className="text-xs text-slate-600">{formatDate(row.createdAt)}</div>
                  <div className="space-y-1">
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-slate-800 underline decoration-slate-300 hover:text-slate-900"
                        title={row.url}
                      >
                        <span className="truncate">{row.domain || row.url}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">No URL</span>
                    )}
                  </div>
                  <div className="text-slate-800">
                    {row.profileDisplayName || <span className="text-xs text-slate-500">Unknown</span>}
                  </div>
                  <div className="space-y-2">
                    {statusChip(row.status as StatusKey)}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateStatus(row.id, "in_review")}
                        disabled={updatingId === row.id}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingId === row.id ? "…" : "In review"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(row.id, "accepted")}
                        disabled={updatingId === row.id}
                        className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingId === row.id ? "…" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(row.id, "rejected")}
                        disabled={updatingId === row.id}
                        className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingId === row.id ? "…" : "Reject"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{row.bidderName || "You"}</div>
                    {row.bidderEmail ? <div className="text-xs text-slate-500">{row.bidderEmail}</div> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </WorkbookShell>
  );
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
