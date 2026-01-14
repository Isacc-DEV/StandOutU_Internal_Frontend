'use client';

type JobLinksErrorStateProps = {
  message: string;
};

export default function JobLinksErrorState({ message }: JobLinksErrorStateProps) {
  return (
    <section className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-rose-100/50 px-6 py-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shadow-sm">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86l-7.4 12.82A1 1 0 0 0 3.74 18h16.52a1 1 0 0 0 .85-1.32l-7.4-12.82a1 1 0 0 0-1.72 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-rose-600">
            Error
          </div>
          <div className="mb-2 text-base font-semibold text-rose-900">{message}</div>
          <div className="text-sm text-rose-700">
            Please refresh or adjust filters and try again.
          </div>
        </div>
      </div>
    </section>
  );
}
