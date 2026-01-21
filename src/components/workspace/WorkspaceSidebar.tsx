import { Check, Copy, FileText, RefreshCw, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import type { BaseInfo, Profile } from "@/app/workspace/types";

type WorkspaceSidebarProps = {
  profiles: Profile[];
  selectedProfileId: string;
  onSelectProfile: (id: string) => void;
  aiProvider: "HUGGINGFACE" | "OPENAI" | "GEMINI";
  onAiProviderChange: (value: "HUGGINGFACE" | "OPENAI" | "GEMINI") => void;
  onOpenJdModal: () => void;
  tailorLoading: boolean;
  onAutofill: () => void;
  autofillDisabled: boolean;
  loadingAction: string;
  showBaseInfo: boolean;
  onToggleBaseInfo: () => void;
  baseDraft: BaseInfo;
  phoneCombined: string;
};

function BaseInfoField({
  label,
  value,
  copied,
  onCopySuccess,
}: {
  label: string;
  value?: string | number | null;
  copied: boolean;
  onCopySuccess: (label: string) => void;
}) {
  const normalizedValue = typeof value === "number" ? value.toString() : value ?? "";
  const trimmedValue = normalizedValue.trim();
  const displayValue = trimmedValue.length > 0 ? trimmedValue : "---";
  const canCopy = trimmedValue.length > 0;

  const handleCopy = async () => {
    if (!canCopy || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(trimmedValue);
      onCopySuccess(label);
    } catch {
      // Ignore clipboard errors silently.
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] pl-1 font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="relative">
        <input
          readOnly
          value={displayValue}
          className="w-full bg-[#1D293D] rounded-xl border border-slate-600 px-3 py-2 pr-11 text-sm text-white shadow-sm"
        />
        <button
          type="button"
          onClick={handleCopy}
          disabled={!canCopy}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center cursor-pointer justify-center rounded-md  text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Copy ${label}`}
          title={canCopy ? `Copy ${label}` : "Nothing to copy"}
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function WorkspaceSidebar({
  profiles,
  selectedProfileId,
  onSelectProfile,
  aiProvider,
  onAiProviderChange,
  onOpenJdModal,
  tailorLoading,
  onAutofill,
  autofillDisabled,
  loadingAction,
  showBaseInfo,
  onToggleBaseInfo,
  baseDraft,
  phoneCombined,
}: WorkspaceSidebarProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const contact = baseDraft?.contact;
  const location = baseDraft?.location;
  const phoneValue =
    phoneCombined ||
    contact?.phone ||
    [contact?.phoneCode, contact?.phoneNumber]
      .filter((item): item is string => Boolean(item))
      .join(" ");
  const handleCopySuccess = (label: string) => {
    setCopiedField(label);
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedField(null);
    }, 1200);
  };
  return (
    <section
      className="flex flex-col gap-2 bg-[#0b1224] text-slate-100 xl:fixed xl:left-0 xl:top-[57px] xl:h-[calc(100vh-57px)] xl:w-[280px] xl:overflow-y-auto"
      style={{ boxShadow: "0 10px 15px -3px rgba(99,102,241,0.5), #0b1224" }}
    >
      <div className="p-4 space-y-4">
        <div className="rounded-xl border border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-200">
                Profile:
              </p>
            </div>

            <select
              value={selectedProfileId}
              onChange={(e) => onSelectProfile(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:border-slate-500 focus:ring-slate-500"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-200">Service</p>

            <select
              value={aiProvider}
              onChange={(event) =>
                onAiProviderChange(event.target.value as "OPENAI" | "HUGGINGFACE" | "GEMINI")
              }
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:border-slate-500 focus:ring-slate-500"
            >
              <option value="HUGGINGFACE">Hugging Face</option>
              <option value="OPENAI">OpenAI</option>
              <option value="GEMINI">Gemini</option>
            </select>
          </div>
          <div className="mt-4 relative">
            <button
              onClick={onOpenJdModal}
              disabled={!selectedProfileId || tailorLoading}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              title={tailorLoading ? "Generating..." : "Generate Resume"}
            >
              {tailorLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                </>
              )}
              <span>
                {tailorLoading ? "Generating..." : "Generate Resume"}
              </span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-200">
                Autofill
              </p>
            </div>
            <span className="text-xs text-slate-500">Ctrl + Shift + F</span>
          </div>

          <button
            onClick={onAutofill}
            disabled={autofillDisabled}
            className="flex items-center justify-center w-full rounded-xl bg-indigo-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            title={loadingAction === "autofill" ? "Filling..." : "Autofill"}
          >
            {loadingAction === "autofill" ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5 mr-2 pr-1" />
            )}
            <span>
              {loadingAction === "autofill" ? "Filling..." : "Autofill"}
            </span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-700 shadow-sm">
          <div 
            onClick={onToggleBaseInfo}
          className="pr-2 pl-4 py-2 flex items-center justify-between cursor-pointer">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-200">
              Base info
            </p>

            <button

              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              aria-label={showBaseInfo ? "Collapse" : "Expand"}
            >
              <svg
                className={`h-4 w-4 transition-transform ${showBaseInfo ? "rotate-90" : ""
                  }`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {showBaseInfo ? (
            <div className="rounded-2xl px-2 pb-4 shadow-sm">
              <div className="mt-4 space-y-4">
                <BaseInfoField
                  label="First name"
                  value={baseDraft?.name?.first}
                  copied={copiedField === "First name"}
                  onCopySuccess={handleCopySuccess}
                />
                <BaseInfoField
                  label="Last name"
                  value={baseDraft?.name?.last}
                  copied={copiedField === "Last name"}
                  onCopySuccess={handleCopySuccess}
                />
                <BaseInfoField
                  label="Email"
                  value={contact?.email}
                  copied={copiedField === "Email"}
                  onCopySuccess={handleCopySuccess}
                />
                <BaseInfoField
                  label="Phone"
                  value={phoneValue}
                  copied={copiedField === "Phone"}
                  onCopySuccess={handleCopySuccess}
                />
                <BaseInfoField
                  label="Address"
                  value={location?.address}
                  copied={copiedField === "Address"}
                  onCopySuccess={handleCopySuccess}
                />
                <BaseInfoField
                  label="City"
                  value={location?.city}
                  copied={copiedField === "City"}
                  onCopySuccess={handleCopySuccess}
                />
                <BaseInfoField
                  label="Postal code"
                  value={location?.postalCode}
                  copied={copiedField === "Postal code"}
                  onCopySuccess={handleCopySuccess}
                />
                <BaseInfoField
                  label="Country"
                  value={location?.country}
                  copied={copiedField === "Country"}
                  onCopySuccess={handleCopySuccess}
                />
                <BaseInfoField
                  label="LinkedIn"
                  value={baseDraft?.links?.linkedin}
                  copied={copiedField === "LinkedIn"}
                  onCopySuccess={handleCopySuccess}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
