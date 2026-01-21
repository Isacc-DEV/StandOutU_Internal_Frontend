import { useCallback } from "react";
import type { MutableRefObject } from "react";
import type { ApplicationSession, User, WebviewHandle } from "../app/workspace/types";
import { CONNECT_TIMEOUT_MS } from "@/lib/constants";
import { withTimeout } from "@/lib/utils";

type ReloadableWebview = WebviewHandle & {
  reload?: () => void;
};

type UseWorkspaceNavigationOptions = {
  api: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  user: User | null;
  selectedProfileId: string;
  url: string;
  navigationStarted: boolean;
  isElectron: boolean;
  webviewRef: MutableRefObject<WebviewHandle | null>;
  setLoadingAction: (value: string) => void;
  setCheckEnabled: (value: boolean) => void;
  setNavigationStarted: (value: boolean) => void;
  setLoadedUrl: (value: string) => void;
  setSession: (value: ApplicationSession | null) => void;
  showError: (message: string) => void;
  refreshMetrics: (bidderId?: string) => Promise<void>;
};

export function useWorkspaceNavigation({
  api,
  user,
  selectedProfileId,
  url,
  navigationStarted,
  isElectron,
  webviewRef,
  setLoadingAction,
  setCheckEnabled,
  setNavigationStarted,
  setLoadedUrl,
  setSession,
  showError,
  refreshMetrics,
}: UseWorkspaceNavigationOptions) {
  const normalizeWorkspaceUrl = (rawUrl: string): string | null => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      return new URL(withScheme).toString();
    } catch {
      return null;
    }
  };

  const handleGo = useCallback(async (nextUrl?: string) => {
    if (!user) {
      showError("Please sign in to continue.");
      return;
    }
    if (!selectedProfileId) {
      showError("Select a profile before opening a job URL.");
      return;
    }
    const targetUrl = typeof nextUrl === "string" ? nextUrl : url;
    if (!targetUrl.trim()) {
      showError("Enter a job URL to continue.");
      return;
    }
    const normalizedUrl = normalizeWorkspaceUrl(targetUrl);
    if (!normalizedUrl) {
      showError("Please enter a valid URL (include domain).");
      return;
    }
    setLoadingAction("go");
    setCheckEnabled(false);
    setNavigationStarted(true);
    setLoadedUrl(normalizedUrl);
    try {
      const newSession: ApplicationSession = await withTimeout(
        api<ApplicationSession>("/sessions", {
          method: "POST",
          body: JSON.stringify({
            bidderUserId: user.id,
            profileId: selectedProfileId,
            url: normalizedUrl,
          }),
        }),
        CONNECT_TIMEOUT_MS,
        "Connecting timed out. Please try again."
      );
      setSession(newSession);
      await withTimeout(
        api<void>(`/sessions/${newSession.id}/go`, { method: "POST" }),
        CONNECT_TIMEOUT_MS,
        "Connecting timed out. Please try again."
      );
      void refreshMetrics();
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to start session. Check backend logs.";
      showError(message);
    } finally {
      setLoadingAction("");
    }
  }, [
    api,
    refreshMetrics,
    selectedProfileId,
    setCheckEnabled,
    setLoadedUrl,
    setLoadingAction,
    setNavigationStarted,
    setSession,
    showError,
    url,
    user,
  ]);

  const handleRefresh = useCallback(async () => {
    if (!navigationStarted) {
      await handleGo();
      return;
    }
    const view = webviewRef.current;
    if (isElectron && view) {
      const electronView = view as ReloadableWebview;
      if (typeof electronView.reload === "function") {
        electronView.reload();
      } else {
        view.executeJavaScript("window.location.reload()", true).catch(console.error);
      }
      return;
    }
    if (typeof window === "undefined") return;
    const iframe = document.querySelector("iframe");
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.location.reload();
      } catch {
        console.warn("Cannot refresh iframe due to cross-origin restrictions");
      }
    }
  }, [handleGo, isElectron, navigationStarted, webviewRef]);

  return {
    handleGo,
    handleRefresh,
  };
}
