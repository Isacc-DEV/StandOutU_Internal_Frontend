import { Download, Radio, RefreshCw, X } from "lucide-react";
import type { Profile, ResumePreviewLlmMeta, ResumePreviewTab } from "@/app/workspace/types";

type ResumePreviewModalProps = {
  open: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
  onRegenerate: () => void;
  onReselectJd: () => void;
  tabs: ResumePreviewTab[];
  activeTab?: ResumePreviewTab | null;
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  templateName?: string;
  templateLoading: boolean;
  templateError: string;
  templateAssigned: boolean;
  selectedProfile?: Profile;
  tailorLoading: boolean;
  tailorError: string;
  tailorPdfLoading: boolean;
  tailorPdfError: string;
  activeResumePreviewHtml: string;
  activeResumePreviewDoc: string;
  jdDraft: string;
  llmRawOutput: string;
  llmMeta: ResumePreviewLlmMeta | null;
};

export default function ResumePreviewModal({
  open,
  onClose,
  onDownloadPdf,
  onRegenerate,
  onReselectJd,
  tabs,
  activeTab,
  activeTabId,
  onSelectTab,
  templateName,
  templateLoading,
  templateError,
  templateAssigned,
  selectedProfile,
  tailorLoading,
  tailorError,
  tailorPdfLoading,
  tailorPdfError,
  activeResumePreviewHtml,
  activeResumePreviewDoc,
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
              Resume preview
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">Preview</h2>
            {selectedProfile ? (
              <p className="text-xs text-slate-500">
                Profile: {selectedProfile.displayName}
              </p>
            ) : null}
            {activeTab ? (
              <p className="mt-1 text-xs font-medium text-slate-600">
                Viewing: {activeTab.label}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={tailorPdfLoading || !activeResumePreviewHtml.trim()}
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
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2" role="tablist" aria-label="Resume preview tabs">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelectTab(tab.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Template preview
          </div>
          {tailorLoading ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Generating a new resume tab. Your current preview stays visible until it finishes.
            </div>
          ) : null}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <iframe
              title={activeTab ? `${activeTab.label} preview` : "Resume preview"}
              srcDoc={activeResumePreviewDoc}
              className="h-[520px] w-full"
              sandbox=""
              referrerPolicy="no-referrer"
            />
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
