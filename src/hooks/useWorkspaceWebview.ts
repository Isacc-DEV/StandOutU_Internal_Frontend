import { useCallback, useEffect, useRef, useState } from "react";
import type { FillPlanAction, PageFieldCandidate, WebviewHandle } from "../app/workspace/types";
import {
  buildApplyAutofillActionsScript,
  buildCollectWebviewFieldsScript,
  buildCollectWebviewTextScript,
  buildHotkeyBridgeScript,
  buildReadWebviewSelectionScript,
  buildSelectionCacheScript,
} from "@/lib/webviewScripts";

type HotkeyEventLike = {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  control?: boolean;
  shift?: boolean;
  preventDefault?: () => void;
};

type WebviewBeforeInputPayload = {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  control?: boolean;
  shiftKey?: boolean;
  shift?: boolean;
  metaKey?: boolean;
  meta?: boolean;
};

type WebviewBeforeInputEvent = WebviewBeforeInputPayload & {
  input?: WebviewBeforeInputPayload;
  preventDefault?: () => void;
};

type WebContentsInput = {
  key?: string;
  code?: string;
  ctrl?: boolean;
  control?: boolean;
  shift?: boolean;
  meta?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  preventDefault?: () => void;
};

type ElectronWebContents = {
  on: (event: string, listener: (event: unknown, input: WebContentsInput) => void) => void;
  removeListener: (event: string, listener: (event: unknown, input: WebContentsInput) => void) => void;
};

type ElectronWebviewHandle = WebviewHandle & {
  canGoBack?: () => boolean;
  canGoForward?: () => boolean;
  goBack?: () => void;
  goForward?: () => void;
  getWebContents?: () => ElectronWebContents | null;
};

type UseWorkspaceWebviewOptions = {
  isClient: boolean;
  isElectron: boolean;
  browserSrc: string;
  handleHotkey: (eventLike: HotkeyEventLike) => void;
  setCheckEnabled: (value: boolean) => void;
};

type WebviewStorageSnapshot = {
  cookie?: string;
  sessionStorage?: Record<string, string>;
  localStorage?: Record<string, string>;
};

export function useWorkspaceWebview({
  isClient,
  isElectron,
  browserSrc,
  handleHotkey,
  setCheckEnabled,
}: UseWorkspaceWebviewOptions) {
  const webviewRef = useRef<WebviewHandle | null>(null);
  const [webviewStatus, setWebviewStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const setWebviewRef = useCallback((node: WebviewHandle | null) => {
    webviewRef.current = node;
    if (!node) {
      setWebviewStatus("idle");
      setCheckEnabled(false);
      setCanGoBack(false);
      setCanGoForward(false);
      return;
    }
    node.setAttribute("allowpopups", "true");
    if (isElectron) {
      setWebviewStatus("loading");
      setCheckEnabled(false);
    }
  }, [isElectron, setCanGoBack, setCanGoForward, setCheckEnabled, setWebviewStatus]);

  // Global hotkeys across the renderer
  useEffect(() => {
    if (!isClient) return;
    const handleKeyDown = (event: KeyboardEvent) => handleHotkey(event);
    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isClient, handleHotkey]);

  const installSelectionCache = useCallback(async () => {
    const view = webviewRef.current;
    if (!view) return;
    const script = buildSelectionCacheScript();
    try {
      await view.executeJavaScript(script, true);
    } catch {
      // ignore selection cache errors
    }
  }, []);

  const installHotkeyBridge = useCallback(async () => {
    const view = webviewRef.current;
    if (!view) return;
    const script = buildHotkeyBridgeScript();
    try {
      await view.executeJavaScript(script, true);
    } catch {
      // ignore hotkey bridge errors
    }
  }, []);

  useEffect(() => {
    if (!isElectron || !webviewRef.current || !browserSrc) return;
    const view = webviewRef.current;
    const electronView = view as ElectronWebviewHandle;
    const checkNavigationState = () => {
      // Try Electron webview API methods first
      if (typeof electronView.canGoBack === "function") {
        setCanGoBack(electronView.canGoBack());
      } else {
        setCanGoBack(false);
      }
      if (typeof electronView.canGoForward === "function") {
        setCanGoForward(electronView.canGoForward());
      } else {
        setCanGoForward(false);
      }
      // Also try checking via JavaScript as fallback
      view
        .executeJavaScript("window.history.length > 1", true)
        .then((result) => {
          if (typeof result === "number" && result > 1) {
            // Check if we can go back by trying to access history state
            view
              .executeJavaScript("window.history.state !== null", true)
              .then((canBack) => {
                setCanGoBack(Boolean(canBack));
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    };
    const handleReady = () => {
      setWebviewStatus("ready");
      setCheckEnabled(true);
      checkNavigationState();
      void installSelectionCache();
      void installHotkeyBridge();
      attachWebContentsHotkey();
    };
    const handleDomReady = () => {
      setWebviewStatus("ready");
      setCheckEnabled(true);
      checkNavigationState();
      void installSelectionCache();
      void installHotkeyBridge();
      attachWebContentsHotkey();
    };
    const handleStop = () => {
      setWebviewStatus("ready");
      setCheckEnabled(true);
      checkNavigationState();
      void installSelectionCache();
      void installHotkeyBridge();
      attachWebContentsHotkey();
    };
    const handleFail = () => {
      setWebviewStatus("failed");
      setCheckEnabled(false);
    };
    const handleStart = () => {
      setWebviewStatus("loading");
      setCheckEnabled(false);
    };
    const handleNavigate = () => {
      checkNavigationState();
    };
    const handleNewWindow = (event: Event) => {
      const popup = event as Event & { url?: string; preventDefault?: () => void };
      if (typeof popup.preventDefault === "function") {
        popup.preventDefault();
      }
      if (!popup.url) return;
      if (view.loadURL) {
        void view.loadURL(popup.url);
      } else {
        view.setAttribute("src", popup.url);
      }
    };
    const handleBeforeInput = (event: WebviewBeforeInputEvent) => {
      const input = event.input ?? event;
      const ctrlKey = Boolean(input?.control || input?.ctrlKey || input?.metaKey);
      const shiftKey = Boolean(input?.shift || input?.shiftKey);
      handleHotkey({
        key: input?.key,
        code: input?.code,
        ctrlKey,
        metaKey: input?.metaKey,
        shiftKey,
        control: input?.control,
        shift: input?.shift,
        preventDefault: () => event?.preventDefault?.(),
      });
    };
    const handleKeyDownInView = (event: Event) => {
      const ev = event as unknown as HotkeyEventLike;
      handleHotkey(ev);
    };

    let webContentsCleanup: (() => void) | null = null;
    const attachWebContentsHotkey = () => {
      if (webContentsCleanup) return;
      const wc = electronView.getWebContents?.() ?? null;
      if (wc && typeof wc.on === "function") {
        const wcHandler = (_event: unknown, input: WebContentsInput) => {
          handleHotkey({
            key: input?.key,
            code: input?.code,
            ctrlKey: input?.ctrl ?? input?.control ?? input?.ctrlKey ?? input?.meta,
            metaKey: input?.meta ?? input?.metaKey,
            shiftKey: input?.shift ?? input?.shiftKey,
            control: input?.control,
            shift: input?.shift,
            preventDefault: () => input?.preventDefault?.(),
          });
        };
        wc.on("before-input-event", wcHandler);
        webContentsCleanup = () => {
          wc.removeListener("before-input-event", wcHandler);
        };
      }
    };

    const handleIpcMessage = (event: Event) => {
      const anyEvt = event as unknown as {
        channel?: string;
        args?: Array<{ key?: string; ctrl?: boolean; shift?: boolean }>;
      };
      if (!anyEvt.channel || anyEvt.channel !== "smartwork-hotkey") return;
      const payload = anyEvt.args?.[0];
      if (!payload) return;
      handleHotkey({
        key: payload.key,
        ctrlKey: payload.ctrl,
        shiftKey: payload.shift,
      });
    };

    const handleConsoleMessage = (evt: Event) => {
      const anyEvt = evt as unknown as {
        message?: string;
        level?: number;
        sourceId?: string;
        line?: number;
      };
      const msg = (anyEvt.message || "").toString();
      if (!msg) return;
      if (msg.includes("[smartwork]")) {
        if (msg.includes("hotkey")) {
          const keyMatch = msg.match(/key=([a-z]+)/i);
          const key = keyMatch?.[1];
          if (key) {
            handleHotkey({
              key,
              ctrlKey: true,
              shiftKey: true,
            });
          }
        }
        return;
      }
      const autofillMarkers = ["[AI Prompt]", "[AI Response]"];
      if (!autofillMarkers.some((marker) => msg.includes(marker))) {
        return;
      }
      const location =
        anyEvt.sourceId && anyEvt.line
          ? ` (${anyEvt.sourceId}:${anyEvt.line})`
          : "";
      console.log(`[webview] ${msg}${location}`);
    };

    const messageHandler = (evt: MessageEvent) => {
      const data = evt.data as { __smartworkHotkey?: { key?: string; ctrl?: boolean; shift?: boolean } };
      const payload = data.__smartworkHotkey;
      if (!payload) return;
      handleHotkey({
        key: payload.key,
        ctrlKey: payload.ctrl,
        shiftKey: payload.shift,
      });
    };

    view.addEventListener("dom-ready", handleDomReady);
    view.addEventListener("did-stop-loading", handleStop);
    view.addEventListener("did-finish-load", handleReady);
    view.addEventListener("did-fail-load", handleFail);
    view.addEventListener("did-start-loading", handleStart);
    view.addEventListener("did-navigate", handleNavigate);
    view.addEventListener("did-navigate-in-page", handleNavigate);
    view.addEventListener("new-window", handleNewWindow);
    view.addEventListener("before-input-event", handleBeforeInput as unknown as EventListener);
    view.addEventListener("keydown", handleKeyDownInView as unknown as EventListener, true);
    view.addEventListener("ipc-message", handleIpcMessage as unknown as EventListener);
    view.addEventListener("console-message", handleConsoleMessage as unknown as EventListener);
    window.addEventListener("message", messageHandler);
    return () => {
      view.removeEventListener("dom-ready", handleDomReady);
      view.removeEventListener("did-stop-loading", handleStop);
      view.removeEventListener("did-finish-load", handleReady);
      view.removeEventListener("did-fail-load", handleFail);
      view.removeEventListener("did-start-loading", handleStart);
      view.removeEventListener("did-navigate", handleNavigate);
      view.removeEventListener("did-navigate-in-page", handleNavigate);
      view.removeEventListener("new-window", handleNewWindow);
      view.removeEventListener("before-input-event", handleBeforeInput as unknown as EventListener);
      view.removeEventListener("keydown", handleKeyDownInView as unknown as EventListener, true);
      view.removeEventListener("ipc-message", handleIpcMessage as unknown as EventListener);
      view.removeEventListener("console-message", handleConsoleMessage as unknown as EventListener);
      if (webContentsCleanup) webContentsCleanup();
      window.removeEventListener("message", messageHandler);
    };
  }, [isElectron, browserSrc, installSelectionCache, installHotkeyBridge, handleHotkey, setCheckEnabled]);

  const collectWebviewText = useCallback(async (): Promise<string> => {
    const view = webviewRef.current;
    if (!view) return "";
    const script = buildCollectWebviewTextScript();
    try {
      const result = await view.executeJavaScript(script, true);
      setWebviewStatus("ready");
      return typeof result === "string" ? result : "";
    } catch (err) {
      console.error("Failed to read webview text", err);
      return "";
    }
  }, []);

  const collectWebviewFields = useCallback(async (): Promise<PageFieldCandidate[]> => {
    const view = webviewRef.current;
    if (!view) return [];
    const script = buildCollectWebviewFieldsScript();
    try {
      const result = await view.executeJavaScript(script, true);
      setWebviewStatus("ready");
      return Array.isArray(result) ? (result as PageFieldCandidate[]) : [];
    } catch (err) {
      console.error("Failed to read webview fields", err);
      return [];
    }
  }, []);

  const applyAutofillActions = useCallback(async (actions: FillPlanAction[]) => {
    const view = webviewRef.current;
    if (!view || !actions?.length) return null;
    const script = buildApplyAutofillActionsScript(actions);
    try {
      const result = await view.executeJavaScript(script, true);
      if (result && typeof result === "object") {
        return result as { filled?: { field: string; value: string }[]; blocked?: string[] };
      }
      return null;
    } catch (err) {
      console.error("Failed to apply autofill in webview", err);
      return null;
    }
  }, []);

  const captureWebviewStorage = useCallback(async (): Promise<WebviewStorageSnapshot | null> => {
    const view = webviewRef.current;
    if (!view) return null;
    const script = `
      (() => {
        try {
          const toObject = (storage) => {
            const out = {};
            for (let i = 0; i < storage.length; i += 1) {
              const key = storage.key(i);
              if (key != null) {
                out[key] = storage.getItem(key);
              }
            }
            return out;
          };
          return {
            cookie: typeof document !== "undefined" ? document.cookie : "",
            sessionStorage: typeof window !== "undefined" ? toObject(window.sessionStorage) : {},
            localStorage: typeof window !== "undefined" ? toObject(window.localStorage) : {},
          };
        } catch (err) {
          return { error: String(err && err.message ? err.message : err) };
        }
      })();
    `;
    try {
      const result = await view.executeJavaScript(script, true);
      if (!result || typeof result !== "object") return null;
      if ("error" in (result as { error?: string })) {
        return null;
      }
      return result as WebviewStorageSnapshot;
    } catch (err) {
      console.error("Failed to capture webview storage", err);
      return null;
    }
  }, []);

  const restoreWebviewStorage = useCallback(
    async (snapshot: WebviewStorageSnapshot | null) => {
      const view = webviewRef.current;
      if (!view || !snapshot) return;
      const payload = JSON.stringify(snapshot);
      const script = `
        (() => {
          try {
            const data = ${payload};
            const assignStorage = (storage, entries) => {
              if (!entries || typeof entries !== "object") return;
              Object.entries(entries).forEach(([key, value]) => {
                if (typeof value === "string") {
                  storage.setItem(key, value);
                }
              });
            };
            if (data.localStorage && typeof window !== "undefined") {
              assignStorage(window.localStorage, data.localStorage);
            }
            if (data.sessionStorage && typeof window !== "undefined") {
              assignStorage(window.sessionStorage, data.sessionStorage);
            }
            if (typeof data.cookie === "string" && data.cookie) {
              data.cookie.split(";").forEach((cookie) => {
                const trimmed = cookie.trim();
                if (trimmed) {
                  document.cookie = trimmed;
                }
              });
            }
            return true;
          } catch (err) {
            return false;
          }
        })();
      `;
      try {
        await view.executeJavaScript(script, true);
      } catch (err) {
        console.error("Failed to restore webview storage", err);
      }
    },
    []
  );

  const readWebviewSelection = useCallback(async () => {
    if (!isElectron || !webviewRef.current) return "";
    try {
      const script = buildReadWebviewSelectionScript();
      const result = await webviewRef.current.executeJavaScript(script, true);
      return typeof result === "string" ? result.trim() : "";
    } catch {
      return "";
    }
  }, [isElectron]);

  const handleGoBack = useCallback(() => {
    if (!canGoBack) return;
    const view = webviewRef.current;
    if (isElectron && view) {
      const electronView = view as ElectronWebviewHandle;
      if (typeof electronView.goBack === "function") {
        electronView.goBack();
      } else {
        view.executeJavaScript("window.history.back()", true).catch(console.error);
      }
      // Update navigation state after a short delay
      setTimeout(() => {
        if (typeof electronView.canGoBack === "function") {
          setCanGoBack(electronView.canGoBack());
        }
        if (typeof electronView.canGoForward === "function") {
          setCanGoForward(electronView.canGoForward());
        }
      }, 100);
    } else if (!isElectron && typeof window !== "undefined") {
      // For iframe, we can't directly control history due to cross-origin restrictions
      // But we can try
      const iframe = document.querySelector("iframe");
      if (iframe?.contentWindow) {
        try {
          iframe.contentWindow.history.back();
        } catch {
          // Cross-origin restrictions may prevent this
          console.warn("Cannot navigate iframe history due to cross-origin restrictions");
        }
      }
    }
  }, [canGoBack, isElectron]);

  const handleGoForward = useCallback(() => {
    if (!canGoForward) return;
    const view = webviewRef.current;
    if (isElectron && view) {
      const electronView = view as ElectronWebviewHandle;
      if (typeof electronView.goForward === "function") {
        electronView.goForward();
      } else {
        view.executeJavaScript("window.history.forward()", true).catch(console.error);
      }
      // Update navigation state after a short delay
      setTimeout(() => {
        if (typeof electronView.canGoBack === "function") {
          setCanGoBack(electronView.canGoBack());
        }
        if (typeof electronView.canGoForward === "function") {
          setCanGoForward(electronView.canGoForward());
        }
      }, 100);
    } else if (!isElectron && typeof window !== "undefined") {
      // For iframe, we can't directly control history due to cross-origin restrictions
      // But we can try
      const iframe = document.querySelector("iframe");
      if (iframe?.contentWindow) {
        try {
          iframe.contentWindow.history.forward();
        } catch {
          // Cross-origin restrictions may prevent this
          console.warn("Cannot navigate iframe history due to cross-origin restrictions");
        }
      }
    }
  }, [canGoForward, isElectron]);

  return {
    webviewRef,
    setWebviewRef,
    webviewStatus,
    setWebviewStatus,
    canGoBack,
    setCanGoBack,
    canGoForward,
    setCanGoForward,
    collectWebviewText,
    collectWebviewFields,
    applyAutofillActions,
    captureWebviewStorage,
    restoreWebviewStorage,
    readWebviewSelection,
    handleGoBack,
    handleGoForward,
  };
}
