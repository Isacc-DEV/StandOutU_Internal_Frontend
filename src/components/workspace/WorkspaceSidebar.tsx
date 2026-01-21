import { FileText, RefreshCw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
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

function EditableRow({
  label,
  value,
  editing,
  children,
}: {
  label: string;
  value: string;
  editing: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-200">
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm text-slate-100">
        {editing ? (children ?? value ?? "N/A") : value ?? "N/A"}
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

        <div className="rounded-xl border border-slate-700 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-200">
              Base info
            </p>

            <button
              onClick={onToggleBaseInfo}
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
            <div className="rounded-2xl p-4">
              <div className="space-y-2 text-sm ">
                <EditableRow label="First name" editing={false} value={baseDraft?.name?.first || "N/A"} />
                <EditableRow label="Last name" editing={false} value={baseDraft?.name?.last || "N/A"} />
                <EditableRow label="Email" editing={false} value={baseDraft?.contact?.email || "N/A"} />
                <EditableRow label="Phone code" editing={false} value={baseDraft?.contact?.phoneCode || "N/A"} />
                <EditableRow label="Phone number" editing={false} value={baseDraft?.contact?.phoneNumber || "N/A"} />
                <EditableRow label="Phone (combined)" editing={false} value={phoneCombined || "N/A"} />
                <EditableRow label="LinkedIn" editing={false} value={baseDraft?.links?.linkedin || "N/A"} />

                <div className="my-3 h-px w-full bg-slate-200/60" />

                <EditableRow label="Address" editing={false} value={baseDraft?.location?.address || "N/A"} />
                <EditableRow label="City" editing={false} value={baseDraft?.location?.city || "N/A"} />
                <EditableRow label="State / Province" editing={false} value={baseDraft?.location?.state || "N/A"} />
                <EditableRow label="Country" editing={false} value={baseDraft?.location?.country || "N/A"} />
                <EditableRow label="Postal code" editing={false} value={baseDraft?.location?.postalCode || "N/A"} />

                <div className="my-3 h-px w-full bg-slate-200/60" />

                <EditableRow label="Job title" editing={false} value={baseDraft?.career?.jobTitle || "N/A"} />
                <EditableRow label="Current company" editing={false} value={baseDraft?.career?.currentCompany || "N/A"} />
                <EditableRow label="Years of experience" editing={false} value={(baseDraft?.career?.yearsExp as string) || "N/A"} />
                <EditableRow label="Desired salary" editing={false} value={baseDraft?.career?.desiredSalary || "N/A"} />

                <div className="my-3 h-px w-full bg-slate-200/60" />

                <EditableRow label="School" editing={false} value={baseDraft?.education?.school || "N/A"} />
                <EditableRow label="Degree" editing={false} value={baseDraft?.education?.degree || "N/A"} />
                <EditableRow label="Major / field" editing={false} value={baseDraft?.education?.majorField || "N/A"} />
                <EditableRow label="Graduation date" editing={false} value={baseDraft?.education?.graduationAt || "N/A"} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
