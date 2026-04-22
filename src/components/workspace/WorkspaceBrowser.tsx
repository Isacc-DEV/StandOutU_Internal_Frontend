import { Download, Radio, RefreshCw, X } from "lucide-react";
import type { RefObject } from "react";
import type {
  Profile,
  ResumePreviewLlmMeta,
  ResumePreviewTab,
  WebviewHandle,
  WorkspaceChatMessage,
} from "@/app/workspace/types";
import WorkspaceAnswersPanel from "./WorkspaceAnswersPanel";

type WorkspaceBrowserProps = {
  selectedProfileId: string;
  selectedProfile?: Profile;
  resumeTabs: ResumePreviewTab[];
  activeResumeTab?: ResumePreviewTab | null;
  activeResumeTabId: string | null;
  onSelectResumeTab: (tabId: string) => void;
  onCloseResumeTab: (tabId: string) => void;
  onDownloadPdf: () => void;
  onRegenerate: () => void;
  onReselectJd: () => void;
  templateName?: string;
  templateLoading: boolean;
  templateError: string;
  templateAssigned: boolean;
  tailorLoading: boolean;
  tailorError: string;
  tailorPdfLoading: boolean;
  tailorPdfError: string;
  activeResumePreviewHtml: string;
  activeResumePreviewDoc: string;
  jdDraft: string;
  llmRawOutput: string;
  llmMeta: ResumePreviewLlmMeta | null;
  chatMessages: WorkspaceChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  chatLoading: boolean;
  onSendChatMessage: () => void | Promise<void>;
  chatMessagesEndRef: RefObject<HTMLDivElement | null>;
  chatInputRef: RefObject<HTMLInputElement | null>;
  onGoBack: () => void;
  onGoForward: () => void;
  onRefresh: () => void;
  onGo: (nextUrl?: string) => void | Promise<void>;
  onCheck: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  canCheck: boolean;
  loadingAction: string;
  isNavigating: boolean;
  tabs: { id: string; url?: string; title?: string }[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onDuplicateTab: (tabId: string) => void;
  tabType: "links" | "profiles";
  onTabTypeChange: (value: "links" | "profiles") => void;
  url: string;
  onUrlChange: (value: string) => void;
  navigationStarted: boolean;
  isElectron: boolean;
  browserSrc: string;
  setWebviewRef: (node: WebviewHandle | null) => void;
  setWebviewRefForTab: (tabId: string, node: WebviewHandle | null) => void;
  webviewPartition: string;
  autofillTabIds: string[];
};

const EmptyResumeState = ({ selectedProfileId }: { selectedProfileId: string }) => (
  <div className="flex h-full min-h-[calc(100vh-120px)] items-center justify-center rounded-[28px] border border-slate-200 bg-white">
    <div className="max-w-md text-center">
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Workspace</p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-900">
        {selectedProfileId ? "Resume preview unavailable" : "Select a profile"}
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        {selectedProfileId
          ? "Assign a resume template to this profile to view the integrated resume."
          : "Choose a profile from the sidebar to load its base resume here."}
      </p>
    </div>
  </div>
);

export default function WorkspaceBrowser({
  selectedProfileId,
  selectedProfile,
  resumeTabs,
  activeResumeTab,
  activeResumeTabId,
  onSelectResumeTab,
  onCloseResumeTab,
  onDownloadPdf,
  onRegenerate,
  onReselectJd,
  templateName,
  templateLoading,
  templateError,
  templateAssigned,
  tailorLoading,
  tailorError,
  tailorPdfLoading,
  tailorPdfError,
  activeResumePreviewHtml,
  activeResumePreviewDoc,
  jdDraft,
  llmRawOutput,
  llmMeta,
  chatMessages,
  chatInput,
  onChatInputChange,
  chatLoading,
  onSendChatMessage,
  chatMessagesEndRef,
  chatInputRef,
}: WorkspaceBrowserProps) {
  const hasPreview = Boolean(activeResumePreviewHtml.trim());
  const answersContextDescription = activeResumeTab?.jd?.trim()
    ? "Using this tab's generated resume and job description."
    : "Using this tab's base resume only.";

  return (
    <section className="flex h-[calc(100vh-57px)] flex-col overflow-hidden rounded-2xl bg-linear-to-br from-slate-50 via-white to-slate-100 xl:ml-[280px]">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 pt-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-2">
          {resumeTabs.map((tab) => {
            const isActive = tab.id === activeResumeTabId;
            return (
              <div
                key={tab.id}
                className={`flex min-w-0 max-w-[240px] items-center gap-2 rounded-t-xl px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "bg-slate-300/80 text-slate-600 hover:bg-slate-200"
                }`}
                title={tab.label}
              >
                <button
                  type="button"
                  onClick={() => onSelectResumeTab(tab.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="truncate">{tab.label}</span>
                </button>
                {tab.kind === "generated" ? (
                  <button
                    type="button"
                    onClick={() => onCloseResumeTab(tab.id)}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                    title="Close tab"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="pb-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Profile</p>
          <p className="text-xs font-semibold text-slate-700">
            {selectedProfile?.displayName || "None"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Integrated Resume View</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">
            {activeResumeTab?.label || "Base Resume"}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              Template:{" "}
              {templateLoading
                ? "Loading..."
                : templateAssigned
                  ? templateName || "Loading details..."
                  : "Not assigned"}
            </span>
            {tailorLoading ? <span>Generating new resume tab...</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={tailorPdfLoading || !hasPreview}
            className="flex items-center justify-center rounded-full bg-slate-900 p-2 text-white transition hover:bg-slate-800 disabled:opacity-60"
            title={tailorPdfLoading ? "Saving..." : "Save PDF"}
          >
            {tailorPdfLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={tailorLoading || !jdDraft.trim()}
            className="flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            title={tailorLoading ? "Generating..." : "Regenerate"}
          >
            <RefreshCw className={`h-4 w-4 ${tailorLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onReselectJd}
            disabled={tailorLoading}
            className="flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            title="Reselect JD"
          >
            <Radio className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {tailorError ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {tailorError}
          </div>
        ) : null}
        {tailorPdfError ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {tailorPdfError}
          </div>
        ) : null}
        {templateError ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {templateError}
          </div>
        ) : null}

        {hasPreview ? (
          <div className="grid h-full min-h-[calc(100vh-245px)] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="flex min-h-0 flex-col gap-4">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <iframe
                  title={activeResumeTab ? `${activeResumeTab.label} preview` : "Resume preview"}
                  srcDoc={activeResumePreviewDoc}
                  className="h-[calc(100vh-245px)] min-h-[620px] w-full"
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
            <div className="min-h-[620px] xl:min-h-0">
              <WorkspaceAnswersPanel
                profileName={selectedProfile?.displayName}
                activeTabLabel={activeResumeTab?.label}
                contextDescription={answersContextDescription}
                chatMessages={chatMessages}
                chatInput={chatInput}
                onChatInputChange={onChatInputChange}
                chatLoading={chatLoading}
                onSendMessage={onSendChatMessage}
                chatMessagesEndRef={chatMessagesEndRef}
                chatInputRef={chatInputRef}
              />
            </div>
          </div>
        ) : (
          <EmptyResumeState selectedProfileId={selectedProfileId} />
        )}
      </div>
    </section>
  );
}
