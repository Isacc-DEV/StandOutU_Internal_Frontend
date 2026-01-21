import { Play, RefreshCw, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { BaseResume } from "@/app/workspace/types";

type JdPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  jdDraft: string;
  onJdDraftChange: (value: string) => void;
  jdCaptureError: string;
  companyTitleKeys: string[];
  baseResumeView: BaseResume;
  bulletCountByCompany: Record<string, number>;
  onBulletCountChange: Dispatch<SetStateAction<Record<string, number>>>;
  tailorLoading: boolean;
};

export default function JdPreviewModal({
  open,
  onClose,
  onCancel,
  onConfirm,
  jdDraft,
  onJdDraftChange,
  jdCaptureError,
  companyTitleKeys,
  baseResumeView,
  bulletCountByCompany,
  onBulletCountChange,
  tailorLoading,
}: JdPreviewModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Job description
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">Review</h2>
            <p className="text-xs text-slate-500">
              Confirm the JD text before sending to AI.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 transition"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <textarea
            value={jdDraft}
            onChange={(event) => onJdDraftChange(event.target.value)}
            placeholder="Paste job description here..."
            className="h-80 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
          />
          {jdCaptureError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {jdCaptureError}
            </div>
          ) : null}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Bullet counts
              </p>
              <p className="text-xs text-slate-500">Company Title - Role Number</p>
            </div>
            <div className="mt-3 space-y-2">
              {companyTitleKeys.length ? (
                companyTitleKeys.map((companyTitle, index) => {
                  const roleLabel = (baseResumeView.workExperience?.[index]?.roleTitle ?? "").trim();
                  const displayLabel = [companyTitle, roleLabel || `Role ${index + 1}`]
                    .filter(Boolean)
                    .join(" - ");
                  const fallbackCount = index === 0 ? 3 : 1;
                  const currentValue =
                    typeof bulletCountByCompany[companyTitle] === "number"
                      ? bulletCountByCompany[companyTitle]
                      : fallbackCount;
                  return (
                    <label
                      key={`${companyTitle}-${index}`}
                      className="flex items-center justify-between gap-3 text-xs text-slate-700"
                    >
                      <span className="flex-1 truncate">{displayLabel}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={currentValue}
                        onChange={(event) => {
                          const nextValue = event.target.valueAsNumber;
                          const safeValue = Number.isFinite(nextValue)
                            ? Math.max(0, nextValue)
                            : 0;
                          onBulletCountChange((prev) => ({
                            ...prev,
                            [companyTitle]: safeValue,
                          }));
                        }}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm outline-none focus:ring-1 focus:ring-slate-300"
                      />
                    </label>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  No work experience entries found.
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={!jdDraft.trim() || tailorLoading}
              className="flex items-center justify-center rounded-full bg-slate-900 p-2.5 text-white hover:bg-slate-800 disabled:opacity-60 transition"
              title={tailorLoading ? "Generating..." : "Generate"}
            >
              {tailorLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={tailorLoading}
              className="flex items-center justify-center rounded-full border border-slate-200 p-2.5 text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
