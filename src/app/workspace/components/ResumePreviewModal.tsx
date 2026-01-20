import { Download, Radio, RefreshCw, X } from "lucide-react";
import type { Profile } from "../types";

type ResumePreviewModalProps = {
  open: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
  onRegenerate: () => void;
  onReselectJd: () => void;
  templateName?: string;
  templateLoading: boolean;
  templateError: string;
  templateAssigned: boolean;
  selectedProfile?: Profile;
  tailorLoading: boolean;
  tailorError: string;
  tailorPdfLoading: boolean;
  tailorPdfError: string;
  resumePreviewHtml: string;
  resumePreviewDoc: string;
  jdDraft: string;
  llmRawOutput: string;
  llmMeta: { provider?: string; model?: string } | null;
};

export default function ResumePreviewModal({
  open,
  onClose,
  onDownloadPdf,
  onRegenerate,
  onReselectJd,
  templateName,
  templateLoading,
  templateError,
  templateAssigned,
  selectedProfile,
  tailorLoading,
  tailorError,
  tailorPdfLoading,
  tailorPdfError,
  resumePreviewHtml,
  resumePreviewDoc,
  jdDraft,
  llmRawOutput,
  llmMeta,
}: ResumePreviewModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Tailored resume
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">Preview</h2>
            {selectedProfile ? (
              <p className="text-xs text-slate-500">
                Profile: {selectedProfile.displayName}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={tailorPdfLoading || !resumePreviewHtml.trim()}
              className="flex items-center justify-center rounded-full bg-slate-900 p-2 text-white hover:bg-slate-800 disabled:opacity-60 transition"
              title={tailorPdfLoading ? "Saving..." : "Save PDF"}
            >
              {tailorPdfLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={tailorLoading || !jdDraft.trim()}
              className="flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition"
              title={tailorLoading ? "Generating..." : "Regenerate"}
            >
              {tailorLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onReselectJd}
              disabled={tailorLoading}
              className="flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition"
              title="Reselect JD"
            >
              <Radio className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Template
          </div>
          {templateLoading ? (
            <div className="text-xs text-slate-500">Loading templates...</div>
          ) : templateAssigned && templateName ? (
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800">
              {templateName}
            </div>
          ) : templateAssigned ? (
            <div className="text-xs text-slate-500">Template details are loading...</div>
          ) : (
            <div className="text-xs text-red-600">No template assigned. Ask a manager to set one.</div>
          )}
        </div>
        {tailorError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {tailorError}
          </div>
        ) : null}
        {tailorPdfError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {tailorPdfError}
          </div>
        ) : null}
        {templateError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {templateError}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Template preview
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {tailorLoading ? (
              <div className="flex h-[520px] items-center justify-center text-sm text-slate-500">
                Generating tailored resume...
              </div>
            ) : (
              <iframe
                title="Tailored resume preview"
                srcDoc={resumePreviewDoc}
                className="h-[520px] w-full"
                sandbox=""
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          {llmRawOutput ? (
            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                LLM output (for testing)
              </summary>
              <div className="mt-2 text-[11px] text-slate-500">
                Provider: {llmMeta?.provider || "unknown"} | Model: {llmMeta?.model || "unknown"}
              </div>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-slate-800">
                {llmRawOutput}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
