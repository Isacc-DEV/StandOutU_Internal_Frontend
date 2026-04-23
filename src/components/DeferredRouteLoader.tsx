type DeferredRouteLoaderProps = {
  title: string;
  detail?: string;
};

export default function DeferredRouteLoader({
  title,
  detail = "Preparing the page...",
}: DeferredRouteLoaderProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.38)]">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Loading
              </p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950">{title}</h1>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">{detail}</p>
        </div>
      </div>
    </div>
  );
}
