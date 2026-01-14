'use client';

import { RotateCcw, RefreshCw } from "lucide-react";
import type { DateRangeKey } from "../types";

type JobLinksFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  range: DateRangeKey;
  onRangeChange: (value: DateRangeKey) => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  onReset: () => void;
  onRefresh: () => void;
  loading: boolean;
};

const rangeOptions: Array<{ value: DateRangeKey; label: string }> = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" }
];

const pageSizeOptions = [25, 50, 100];

export default function JobLinksFilters({
  search,
  onSearchChange,
  range,
  onRangeChange,
  pageSize,
  onPageSizeChange,
  onReset,
  onRefresh,
  loading
}: JobLinksFiltersProps) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/30 p-6 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_0.7fr_auto] lg:items-end">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
            Search
          </span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by URL or domain..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none ring-1 ring-transparent transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20 hover:border-slate-300"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
            Date Range
          </span>
          <select
            value={range}
            onChange={(event) => onRangeChange(event.target.value as DateRangeKey)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none ring-1 ring-transparent transition-all duration-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20 hover:border-slate-300"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
            Page Size
          </span>
          <select
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none ring-1 ring-transparent transition-all duration-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/20 hover:border-slate-300"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={String(option)}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
            aria-label="Reset filters"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-sm transition-all duration-200 hover:from-emerald-700 hover:to-teal-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm"
            aria-label="Refresh"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
