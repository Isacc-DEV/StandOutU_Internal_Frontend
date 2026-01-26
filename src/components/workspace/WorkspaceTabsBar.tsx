import { Check, Globe, Plus, Settings, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";

type WorkspaceTab = {
  id: string;
  url?: string;
  title?: string;
};

type WorkspaceTabsBarProps = {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onDuplicateTab: (tabId: string) => void;
  tabType: "links" | "profiles";
  onTabTypeChange: (value: "links" | "profiles") => void;
};

const getTabMeta = (url: string) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "");
    const pathChunk = parsed.pathname.split("/").filter(Boolean).pop();
    const title = pathChunk ? `${host} / ${decodeURIComponent(pathChunk)}` : host;
    const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
      parsed.hostname
    )}&sz=64`;
    return { title, favicon };
  } catch {
    return { title: url || "New Tab", favicon: "" };
  }
};

export default function WorkspaceTabsBar({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onDuplicateTab,
  tabType,
  onTabTypeChange,
}: WorkspaceTabsBarProps) {
  const [menuState, setMenuState] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  const menuTab = useMemo(
    () => (menuState ? tabs.find((tab) => tab.id === menuState.tabId) : null),
    [menuState, tabs]
  );

  const handleCloseMenu = () => setMenuState(null);
  const handleOpenMenu = (event: MouseEvent, tabId: string) => {
    event.preventDefault();
    if (tabType !== "links") return;
    setMenuState({ tabId, x: event.clientX, y: event.clientY });
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (tabType !== "links") {
      setMenuState(null);
    }
  }, [tabType]);
  if (!tabs.length) {
    return (
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <div className="flex items-center gap-2 rounded-t-lg bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm">
          <Globe className="h-4 w-4 text-slate-400" />
          <span>New Tab</span>
        </div>
        {tabType === "links" ? (
          <button
            type="button"
            onClick={onAddTab}
            className="flex cursor-pointer h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-slate-300"
            aria-label="Add tab"
            title="Add tab"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
        <div className="relative ml-auto flex w-[100px] items-center justify-end">
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              settingsOpen
                ? "bg-slate-300 text-slate-700"
                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
            }`}
            aria-label="Tab settings"
            title="Tab settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          {settingsOpen ? (
            <div className="absolute right-0 top-10 w-[180px] rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg">
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Tab Type
              </p>
              {(["links", "profiles"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onTabTypeChange(type);
                    setSettingsOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-slate-700 hover:bg-slate-100"
                >
                  <span>{type === "links" ? "Links" : "Profiles"}</span>
                  {tabType === type ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 pt-3 overflow-visible">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const meta = tab.title
            ? { title: tab.title, favicon: "" }
            : getTabMeta(tab.url ?? "");
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              onContextMenu={(event) => handleOpenMenu(event, tab.id)}
              className={`group cursor-pointer flex min-w-[140px] max-w-[220px] items-center gap-2 rounded-t-lg px-3 py-2 text-xs font-semibold shadow-sm transition ${
                isActive
                  ? "bg-white/80 text-slate-900 shadow-md border-t-3 border-blue-500 hover:bg-slate-200"
                  : "bg-slate-300/80 text-slate-600 hover:bg-slate-200"
              }`}
              title={tab.title || tab.url || ""}
            >
              {meta.favicon ? (
                <img
                  src={meta.favicon}
                  alt=""
                  className="h-4 w-4 rounded-sm"
                  loading="lazy"
                />
              ) : (
                <Globe className="h-4 w-4 text-slate-400" />
              )}
              <span className="truncate text-left flex-1">{meta.title}</span>
              {tabType === "links" ? (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Close tab"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </button>
          );
        })}
        {tabType === "links" ? (
          <button
            type="button"
            onClick={onAddTab}
            className="flex cursor-pointer h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-slate-300"
            aria-label="Add tab"
            title="Add tab"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="relative ml-auto flex w-[100px] items-center justify-end pb-2">
        <button
          type="button"
          onClick={() => {
            setSettingsOpen((prev) => !prev);
            handleCloseMenu();
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
            settingsOpen
              ? "bg-slate-300 text-slate-700"
              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
          }`}
          aria-label="Tab settings"
          title="Tab settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        {settingsOpen ? (
          <div className="absolute right-0 top-10 z-20 w-[180px] rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Tab Type
            </p>
            {(["links", "profiles"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onTabTypeChange(type);
                  setSettingsOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-slate-700 hover:bg-slate-100"
              >
                <span>{type === "links" ? "Links" : "Profiles"}</span>
                {tabType === type ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {menuState && menuTab ? (
        <div
          className="fixed inset-0 z-50"
          onClick={handleCloseMenu}
          onContextMenu={(event) => {
            event.preventDefault();
            handleCloseMenu();
          }}
        >
          <div
            className="absolute min-w-[160px] rounded-lg border border-slate-200 bg-white p-1 text-xs text-slate-700 shadow-lg"
            style={{ left: menuState.x, top: menuState.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-left hover:bg-slate-100"
              onClick={() => {
                onCloseTab(menuState.tabId);
                handleCloseMenu();
              }}
            >
              Close tab
            </button>
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-left hover:bg-slate-100"
              onClick={() => {
                onDuplicateTab(menuState.tabId);
                handleCloseMenu();
              }}
            >
              Duplicate tab
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
