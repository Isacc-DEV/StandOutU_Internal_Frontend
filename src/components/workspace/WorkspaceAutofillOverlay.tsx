type WorkspaceAutofillOverlayProps = {
  visible: boolean;
  url?: string;
};

const MULTI_PART_TLDS = new Set(["co.uk", "com.au", "co.nz", "co.jp"]);

const getDomainKey = (hostname: string): string | null => {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length === 0) return null;
  const tld = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(tld) && parts.length >= 3) {
    return parts[parts.length - 3];
  }
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return parts[0];
};

const getDomainLabel = (url?: string): string | null => {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return getDomainKey(hostname);
  } catch {
    return null;
  }
};

export default function WorkspaceAutofillOverlay({
  visible,
  url,
}: WorkspaceAutofillOverlayProps) {
  if (!visible) return null;
  const domainLabel = getDomainLabel(url);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/20"
      role="status"
      aria-live="polite"
    >
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-white/40 border-t-white shadow-lg animate-spin" />
        {domainLabel ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm">
              {domainLabel.slice(0, 3)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
