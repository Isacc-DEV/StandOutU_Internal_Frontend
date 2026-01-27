import { ChevronLeft, ChevronRight, RefreshCw, Radio } from "lucide-react";
import type { Ref } from "react";
import type { WebviewHandle } from "@/app/workspace/types";
import WorkspaceAutofillOverlay from "./WorkspaceAutofillOverlay";
import WorkspaceTabsBar from "./WorkspaceTabsBar";

type BrowserToolbarProps = {
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
  selectedProfileId: string;
  url: string;
  onUrlChange: (value: string) => void;
  navigationStarted: boolean;
};

type BrowserContentProps = {
  isElectron: boolean;
  tabType: "links" | "profiles";
  tabs: { id: string; url?: string; title?: string }[];
  activeTabId: string | null;
  effectiveBrowserSrc: string;
  shouldRenderBrowser: boolean;
  autofillTabIds: string[];
  webviewPartition: string;
  setWebviewRef: (node: WebviewHandle | null) => void;
  assignWebviewRef: (tabId: string) => (node: WebviewHandle | null) => void;
  loadingAction: string;
};

const BrowserEmptyState = () => (
  <div className="flex h-full min-h-[calc(100vh-70px)] flex-1 items-center justify-center text-slate-600">
    <div className="text-center space-y-2">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-br from-indigo-100 to-cyan-100 mb-2">
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
);

const BrowserToolbar = ({
  onGoBack,
  onGoForward,
  onRefresh,
  onGo,
  onCheck,
  canGoBack,
  canGoForward,
  canCheck,
  loadingAction,
  isNavigating,
  selectedProfileId,
  url,
  onUrlChange,
  navigationStarted,
}: BrowserToolbarProps) => (
  <div className="relative border-b-2 p-2 border-slate-200 bg-slate-50/50">
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex gap-2 sm:shrink-0">
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
          disabled={isNavigating || !selectedProfileId}
          className="min-w-[40px] rounded-lg bg-transparent px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
          title={navigationStarted ? "Refresh" : "Connect"}
        >
          <RefreshCw className={`h-4 w-4 ${isNavigating ? "animate-spin" : ""}`} />
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
      <div className="flex gap-2 sm:shrink-0">
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
);

const BrowserContent = ({
  isElectron,
  tabType,
  tabs,
  activeTabId,
  effectiveBrowserSrc,
  shouldRenderBrowser,
  autofillTabIds,
  webviewPartition,
  setWebviewRef,
  assignWebviewRef,
  loadingAction,
}: BrowserContentProps) => (
  <div className="relative flex-1 min-h-0 overflow-hidden from-white via-slate-50 to-slate-100 transition-shadow duration-300">
    {shouldRenderBrowser ? (
      isElectron ? (
        <div className="relative h-full w-full">
          {tabType === "links" || tabType === "profiles" ? (
            <>
              {tabs
                .filter((tab) => tab.url?.trim())
                .map((tab) => {
                  const isActive = tab.id === activeTabId;
                  const isAutofillActive = autofillTabIds.includes(tab.id);
                  return (
                    <div
                      key={tab.id}
                      className="absolute inset-0 h-full w-full"
                      style={{ display: isActive ? "block" : "none" }}
                    >
                      <webview
                        ref={assignWebviewRef(tab.id) as unknown as Ref<HTMLWebViewElement>}
                        src={tab.url}
                        partition={
                          tabType === "profiles"
                            ? `persist:smartwork-profile-${tab.id}`
                            : webviewPartition
                        }
                        webpreferences="allowRunningInsecureContent=yes, webSecurity=no"
                        style={{
                          position: "absolute",
                          inset: "0px",
                          height: "100%",
                          width: "100%",
                          backgroundColor: "#ffffff",
                        }}
                      />
                      <WorkspaceAutofillOverlay
                        visible={loadingAction === "autofill" && isAutofillActive}
                        url={tab.url ?? ""}
                      />
                    </div>
                  );
                })}
            </>
          ) : (
            <>
              <webview
                ref={setWebviewRef as unknown as Ref<HTMLWebViewElement>}
                src={effectiveBrowserSrc}
                partition={webviewPartition}
                webpreferences="allowRunningInsecureContent=yes, webSecurity=no"
                style={{
                  position: "absolute",
                  inset: "0px",
                  height: "100%",
                  width: "100%",
                  backgroundColor: "#ffffff",
                }}
              />
              <WorkspaceAutofillOverlay
                visible={loadingAction === "autofill"}
                url={effectiveBrowserSrc}
              />
            </>
          )}
          {!effectiveBrowserSrc ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-600">
              <BrowserEmptyState />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {tabType === "links" || tabType === "profiles" ? (
            <>
              {tabs
                .filter((tab) => tab.url?.trim())
                .map((tab) => {
                  const isActive = tab.id === activeTabId;
                  const isAutofillActive = autofillTabIds.includes(tab.id);
                  return (
                    <div
                      key={tab.id}
                      className="absolute inset-0 h-full w-full"
                      style={{ display: isActive ? "block" : "none" }}
                    >
                      <iframe
                        src={tab.url}
                        className="absolute inset-0 h-full min-h-0 w-full bg-white"
                        style={{ backgroundColor: "#ffffff" }}
                        allowFullScreen
                        referrerPolicy="no-referrer"
                      />
                      <WorkspaceAutofillOverlay
                        visible={loadingAction === "autofill" && isAutofillActive}
                        url={tab.url ?? ""}
                      />
                    </div>
                  );
                })}
            </>
          ) : (
            <>
              <iframe
                src={effectiveBrowserSrc}
                className="absolute inset-0 h-full min-h-0 w-full bg-white"
                style={{ backgroundColor: "#ffffff" }}
                allowFullScreen
                referrerPolicy="no-referrer"
              />
              <WorkspaceAutofillOverlay
                visible={loadingAction === "autofill"}
                url={effectiveBrowserSrc}
              />
            </>
          )}
          {!effectiveBrowserSrc ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-600">
              <BrowserEmptyState />
            </div>
          ) : null}
          <div className="absolute top-2 right-2 flex gap-2">
            <a
              href={effectiveBrowserSrc}
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
      <BrowserEmptyState />
    )}
  </div>
);

type WorkspaceBrowserProps = {
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
  selectedProfileId: string;
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
  isNavigating,
  selectedProfileId,
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onDuplicateTab,
  tabType,
  onTabTypeChange,
  url,
  onUrlChange,
  navigationStarted,
  isElectron,
  browserSrc,
  setWebviewRef,
  setWebviewRefForTab,
  webviewPartition,
  autofillTabIds,
}: WorkspaceBrowserProps) {
  const activeTabUrl =
    tabs.find((tab) => tab.id === activeTabId)?.url?.trim() || "";
  const effectiveBrowserSrc = tabType === "links" ? activeTabUrl : browserSrc;
  const hasTabUrls = tabs.some((tab) => Boolean(tab.url?.trim()));
  const shouldRenderBrowser =
    tabType === "links" || tabType === "profiles"
      ? hasTabUrls
      : Boolean(effectiveBrowserSrc);
  const assignWebviewRef =
    (tabId: string) => (node: WebviewHandle | null) => {
      setWebviewRefForTab(tabId, node);
      if (tabId === activeTabId) {
        setWebviewRef(node);
      }
    };

  return (
    <section className="flex h-[calc(100vh-57px)] flex-col gap-2 overflow-hidden rounded-2xl bg-linear-to-br from-slate-50 via-white to-slate-100 xl:ml-[280px]">
      <div className="mx-auto flex h-full w-full flex-1 min-h-0 flex-col">
        <WorkspaceTabsBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={onSelectTab}
          onAddTab={onAddTab}
          onCloseTab={onCloseTab}
          onDuplicateTab={onDuplicateTab}
          tabType={tabType}
          onTabTypeChange={onTabTypeChange}
        />
        <BrowserToolbar
          onGoBack={onGoBack}
          onGoForward={onGoForward}
          onRefresh={onRefresh}
          onGo={onGo}
          onCheck={onCheck}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          canCheck={canCheck}
          loadingAction={loadingAction}
          isNavigating={isNavigating}
          selectedProfileId={selectedProfileId}
          url={url}
          onUrlChange={onUrlChange}
          navigationStarted={navigationStarted}
        />
        <BrowserContent
          isElectron={isElectron}
          tabType={tabType}
          tabs={tabs}
          activeTabId={activeTabId}
          effectiveBrowserSrc={effectiveBrowserSrc}
          shouldRenderBrowser={shouldRenderBrowser}
          autofillTabIds={autofillTabIds}
          webviewPartition={webviewPartition}
          setWebviewRef={setWebviewRef}
          assignWebviewRef={assignWebviewRef}
          loadingAction={loadingAction}
        />
      </div>
    </section>
  );
}
