import { ChevronLeft, ChevronRight, RefreshCw, Radio } from "lucide-react";
import type { Ref } from "react";
import type { WebviewHandle } from "../types";

type WorkspaceBrowserProps = {
  onGoBack: () => void;
  onGoForward: () => void;
  onRefresh: () => void;
  onGo: () => void | Promise<void>;
  onCheck: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  canCheck: boolean;
  loadingAction: string;
  selectedProfileId: string;
  url: string;
  onUrlChange: (value: string) => void;
  navigationStarted: boolean;
  isElectron: boolean;
  browserSrc: string;
  setWebviewRef: (node: WebviewHandle | null) => void;
  webviewPartition: string;
};

export default function WorkspaceBrowser({
  onGoBack,
  onGoForward,
  onRefresh,
  onGo,
  onCheck,
  canGoBack,
  canGoForward,
  canCheck,
  loadingAction,
  selectedProfileId,
  url,
  onUrlChange,
  navigationStarted,
  isElectron,
  browserSrc,
  setWebviewRef,
  webviewPartition,
}: WorkspaceBrowserProps) {
  return (
    <section className="flex flex-col gap-2 bg-gradient-to-br from-slate-50 via-white to-slate-100 rounded-2xl xl:ml-[280px] min-h-[calc(100vh-57px)] max-h-[calc(100vh-57px)] overflow-auto">
      <div className="mx-auto flex w-full flex-1 min-h-0 flex-col ">
        <div className="relative border-b-2 p-2 border-slate-200 bg-slate-50/50">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex gap-2 sm:flex-shrink-0">
              <button
                onClick={onGoBack}
                disabled={!canGoBack}
                className="min-w-[40px] rounded-lg bg-transparent px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
                title="Go back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={onGoForward}
                disabled={!canGoForward}
                className="min-w-[40px] rounded-lg bg-transparent px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
                title="Go forward"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={onRefresh}
                disabled={loadingAction === "go" || !selectedProfileId}
                className="min-w-[40px] rounded-lg bg-transparent px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
                title={navigationStarted ? "Refresh" : "Connect"}
              >
                <RefreshCw className={`h-4 w-4 ${loadingAction === "go" ? "animate-spin" : ""}`} />
                <span className="sr-only">
                  {navigationStarted ? "Refresh" : "Connect"}
                </span>
              </button>
            </div>
            <div className="flex-1">
              <input
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onGo();
                  }
                }}
                placeholder="https://example.com/job-posting"
                className="w-full rounded-3xl bg-gray-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
              />
            </div>
            <div className="flex gap-2 sm:flex-shrink-0">
              <button
                onClick={onCheck}
                disabled={!canCheck}
                className="min-w-[40px] rounded-l px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                title="Check"
              >
                {loadingAction === "check" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Radio className="h-4 w-4" />
                )}
                <span className="sr-only">Check</span>
              </button>
            </div>
          </div>
        </div>
        <div className="relative flex-1 min-h-0 overflow-hidden from-white via-slate-50 to-slate-100 transition-shadow duration-300">
          {browserSrc ? (
            isElectron ? (
              <div className="relative h-full w-full">
                <webview
                  ref={setWebviewRef as unknown as Ref<HTMLWebViewElement>}
                  key={browserSrc}
                  src={browserSrc}
                  partition={webviewPartition}
                  style={{ height: "100%", minHeight: "calc(100vh - 70px)", width: "100%", backgroundColor: "#ffffff" }}
                />
              </div>
            ) : (
              <>
                <iframe
                  key={browserSrc}
                  src={browserSrc}
                  className="h-auto min-h-[calc(100vh-70px)] w-full bg-white"
                  style={{ backgroundColor: "#ffffff" }}
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <a
                    href={browserSrc}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-slate-100lack/50 px-3 py-1 text-[11px] text-slate-800 hover:bg-slate-100lack/60"
                  >
                    Open in new tab
                  </a>
                </div>
              </>
            )
          ) : (
            <div className="flex h-full min-h-[calc(100vh-70px)] flex-1 items-center justify-center text-slate-600">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 mb-2">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div className="text-sm font-semibold text-slate-700">No URL loaded</div>
                <div className="text-xs text-slate-500">
                  Enter a URL and click Go.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
