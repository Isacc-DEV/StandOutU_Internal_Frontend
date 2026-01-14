'use client';

export default function JobLinksEmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-white to-slate-50/50 px-8 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 shadow-sm">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      </div>
      <h3 className="mt-6 text-xl font-bold text-slate-900">
        No job links found
      </h3>
      <p className="mt-3 text-sm font-medium text-slate-600">
        Try adjusting the search, country, or date filters to see more results.
      </p>
    </section>
  );
}
