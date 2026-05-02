import { FileText, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import type { BaseResume, Profile } from "@/app/workspace/types";

type WorkspaceSidebarProps = {
  profiles: Profile[];
  selectedProfileId: string;
  onSelectProfile: (id: string) => void;
  onOpenJdModal: () => void;
  tailorLoading: boolean;
  onAutofill: () => void;
  autofillDisabled: boolean;
  autofillActive: boolean;
  baseResume?: BaseResume | null;
};

export default function WorkspaceSidebar({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onOpenJdModal,
  tailorLoading,
  onAutofill,
  autofillDisabled,
  autofillActive,
  baseResume,
}: WorkspaceSidebarProps) {
  const [showResumeInfo, setShowResumeInfo] = useState(false);

  const resumeWork = baseResume?.workExperience ?? [];
  const resumeEducation = baseResume?.education ?? [];

  const formatDates = (start?: string, end?: string) => {
    if (!start && !end) return "";
    return [start, end ?? "Present"].filter(Boolean).join(" - ");
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
            <span className="inline-flex items-center rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100">
              OpenAI
            </span>
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
            title={autofillActive ? "Filling..." : "Autofill"}
          >
            {autofillActive ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5 mr-2 pr-1" />
            )}
            <span>
              {autofillActive ? "Filling..." : "Autofill"}
            </span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-700 shadow-sm">
          <div
            onClick={() => setShowResumeInfo((prev) => !prev)}
            className="pr-2 pl-4 py-2 flex items-center justify-between cursor-pointer"
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-200">
              Resume
            </p>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              aria-label={showResumeInfo ? "Collapse" : "Expand"}
            >
              <svg
                className={`h-4 w-4 transition-transform ${showResumeInfo ? "rotate-90" : ""}`}
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

          {showResumeInfo ? (
            <div className="rounded-2xl px-4 pb-4 text-sm text-slate-100">
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-[11px] pl-1 font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Work Experience
                  </p>
                  {resumeWork.length ? (
                    <div className="mt-2 space-y-3">
                      {resumeWork.map((role, index) => {
                        const dates = formatDates(role.startDate, role.endDate);
                        return (
                          <div
                            key={`${role.companyTitle || "role"}-${index}`}
                            className={`pl-1 ${index > 0 ? "border-t border-slate-800 pt-3" : ""}`}
                          >
                            <p className="text-sm text-slate-300">
                              {role.companyTitle || "---"}
                            </p>
                            <p className="text-sm text-slate-100">
                              {role.roleTitle || "---"}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                              {dates ? <span>{dates}</span> : null}
                              {role.location ? <span>{role.location}</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="pl-1 text-sm text-slate-100">---</p>
                  )}
                </div>
                <div className="h-px bg-slate-800" />
                <div>
                  <p className="text-[11px] pl-1 font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Education
                  </p>
                  {resumeEducation.length ? (
                    <div className="mt-2 space-y-2">
                      {resumeEducation.map((edu, index) => {
                        const primaryLine = [edu.degree, edu.institution].filter(Boolean).join(" - ");
                        const secondaryLine = [edu.field, edu.date].filter(Boolean).join(" • ");
                        return (
                          <div
                            key={`${edu.institution || "edu"}-${index}`}
                            className={`pl-1 ${index > 0 ? "border-t border-slate-800 pt-3" : ""}`}
                          >
                            <p className="text-sm text-slate-100">{primaryLine || "---"}</p>
                            {secondaryLine ? (
                              <p className="text-xs text-slate-400">{secondaryLine}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="pl-1 text-sm text-slate-100">---</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
