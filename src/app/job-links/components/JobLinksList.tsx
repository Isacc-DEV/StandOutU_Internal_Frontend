'use client';

import { useEffect, useState } from "react";
import { ExternalLink, Globe, Clock, CheckCircle2 } from "lucide-react";
import type { JobLink } from "../types";
import { formatRelativeTime } from "../utils";
import JobLinksEmptyState from "./JobLinksEmptyState";

type JobLinksListProps = {
  items: JobLink[];
  loading: boolean;
  startIndex: number;
  onOpenLink?: (url: string) => void;
};

const STORAGE_KEY = "smartwork_job_links_clicked";

const readClickedLinks = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item) => typeof item === "string"));
  } catch {
    return new Set();
  }
};

const writeClickedLinks = (links: Set<string>) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(links)));
  } catch {
    // Ignore storage failures.
  }
};

export default function JobLinksList({
  items,
  loading,
  startIndex,
  onOpenLink
}: JobLinksListProps) {
  const [clickedLinks, setClickedLinks] = useState<Set<string>>(() => readClickedLinks());

  useEffect(() => {
    setClickedLinks(readClickedLinks());
  }, []);

  const handleLinkClick = (url: string) => {
    setClickedLinks((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      writeClickedLinks(next);
      return next;
    });
  };

  const handleOpen = (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    handleLinkClick(url);
    if (onOpenLink) {
      event.preventDefault();
      onOpenLink(url);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/30 p-8 shadow-sm">
        <div className="flex items-center justify-center gap-3 text-sm font-medium text-slate-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Loading job links...
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return <JobLinksEmptyState />;
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/30 shadow-sm">
      <div className="overflow-hidden">
        <div className="grid gap-3 p-6">
          {items.map((item, index) => {
            const submittedLabel = formatRelativeTime(item.submittedAt);
            const isClicked = clickedLinks.has(item.url);
            const rowNumber = startIndex + index + 1;

            return (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-600 group-hover:from-emerald-100 group-hover:to-emerald-200 group-hover:text-emerald-700 transition-colors">
                    {rowNumber}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <a
                        href={item.url}
                        onClick={(event) => handleOpen(event, item.url)}
                        className="group/link min-w-0 flex-1"
                        title={item.url}
                      >
                        <div className="flex items-center gap-2">
                          <p className={`truncate text-base font-semibold transition-colors ${
                            isClicked
                              ? "text-rose-600 group-hover/link:text-rose-700"
                              : "text-emerald-600 group-hover/link:text-emerald-700"
                          }`}>
                            {item.url}
                          </p>
                          <ExternalLink className={`h-4 w-4 shrink-0 transition-colors ${
                            isClicked ? "text-rose-500" : "text-emerald-500"
                          } opacity-0 group-hover/link:opacity-100 transition-opacity`} />
                        </div>
                      </a>
                      {isClicked && (
                        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-rose-600" />
                          <span className="text-xs font-medium text-rose-700">Viewed</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5">
                        <Globe className="h-3.5 w-3.5 text-slate-600" />
                        <span className="text-xs font-semibold text-slate-700">
                          {item.countryName ?? "Global"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{submittedLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
