'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Clock3, CheckCircle2, Trophy } from "lucide-react";
import WorkbookShell from "../../../components/WorkbookShell";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";

type WorkbookEntry = {
  id: string;
  bidderUserId?: string | null;
  bidderName?: string | null;
  bidderEmail?: string | null;
  createdAt: string;
  isReviewed?: boolean | null;
};

type RangeKey = "daily" | "weekly" | "monthly";

export default function WorkBookDashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<WorkbookEntry[]>([]);
  const [error, setError] = useState("");
  const [loadingList, setLoadingList] = useState(false);

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
    const load = async () => {
      setLoadingList(true);
      setError("");
      try {
        const data = await api<WorkbookEntry[]>("/manager/applications", undefined, token);
        setEntries(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard data.");
      } finally {
        setLoadingList(false);
      }
    };
    void load();
  }, [loading, user, token, router]);

  const total = entries.length;
  const pending = entries.filter((e) => !toBool(e.isReviewed)).length;
  const reviewed = total - pending;

  const topBidderByRange = useMemo(() => {
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    const ranges: Record<RangeKey, number> = {
      daily: 1,
      weekly: 7,
      monthly: 30,
    };
    const result: Record<RangeKey, { label: string; count: number }> = {
      daily: { label: "No data", count: 0 },
      weekly: { label: "No data", count: 0 },
      monthly: { label: "No data", count: 0 },
    };

    (Object.keys(ranges) as RangeKey[]).forEach((key) => {
      const days = ranges[key];
      const since = now - days * msInDay;
      const counts = new Map<string, number>();
      entries.forEach((entry) => {
        const createdAt = new Date(entry.createdAt).getTime();
        if (Number.isNaN(createdAt) || createdAt < since) return;
        const id = entry.bidderUserId || "unknown";
        const label = entry.bidderName || entry.bidderEmail || "Unknown";
        const current = counts.get(id) ?? 0;
        counts.set(id, current + 1);
        // store label separately
        counts.set(`${id}__label`, label);
      });
      let topId = "";
      let topCount = 0;
      counts.forEach((value, keyLabel) => {
        if (keyLabel.endsWith("__label")) return;
        if (value > topCount) {
          topCount = value;
          topId = keyLabel;
        }
      });
      if (topId) {
        const label = (counts.get(`${topId}__label`) as string) || "Unknown";
        result[key] = { label, count: topCount };
      }
    });
    return result;
  }, [entries]);

  return (
    <WorkbookShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-slate-900 shadow-lg shadow-indigo-500/25">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                Work book
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                Dashboard
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Quick status of applications and top bidders.
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-400/60 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Total applications" value={total} tone="slate" />
          <MetricCard label="Pending review" value={pending} tone="amber" icon={Clock3} />
          <MetricCard label="Reviewed" value={reviewed} tone="emerald" icon={CheckCircle2} />
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <TopBidderCard title="Monthly top bidder" data={topBidderByRange.monthly} />
          <TopBidderCard title="Weekly top bidder" data={topBidderByRange.weekly} />
          <TopBidderCard title="Daily top bidder" data={topBidderByRange.daily} />
        </section>

        {loadingList ? (
          <div className="text-sm text-slate-600">Loading...</div>
        ) : null}
      </div>
    </WorkbookShell>
  );
}

function MetricCard({
  label,
  value,
  tone = "slate",
  icon: Icon,
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "amber";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClasses =
    tone === "emerald"
      ? "bg-emerald-50 border-emerald-100 text-emerald-900"
      : tone === "amber"
      ? "bg-amber-50 border-amber-100 text-amber-900"
      : "bg-slate-50 border-slate-200 text-slate-900";
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClasses}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        {Icon ? <Icon className="h-5 w-5 text-slate-500" /> : null}
      </div>
    </div>
  );
}

function TopBidderCard({ title, data }: { title: string; data: { label: string; count: number } }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
        <div className="mt-1 text-lg font-semibold text-slate-900">{data.label}</div>
        <div className="text-sm text-slate-600">{data.count} applications</div>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
        <Trophy className="h-5 w-5" />
      </div>
    </div>
  );
}

function toBool(value?: boolean | null) {
  return Boolean(value);
}
