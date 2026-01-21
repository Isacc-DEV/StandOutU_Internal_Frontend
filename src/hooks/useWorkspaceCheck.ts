import { useCallback } from "react";
import type { MutableRefObject } from "react";
import type { ApplicationSession, User, WebviewHandle } from "../app/workspace/types";
import { CHECK_TIMEOUT_MS } from "@/lib/constants";
import { normalizeTextForMatch, withTimeout } from "@/lib/utils";

type NormalizedPhrase = {
  normalized: string;
  squished?: string;
};

type UseWorkspaceCheckOptions = {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  session: ApplicationSession | null;
  user: User | null;
  isElectron: boolean;
  webviewRef: MutableRefObject<WebviewHandle | null>;
  webviewStatus: "idle" | "loading" | "ready" | "failed";
  applicationPhrasesLength: number;
  normalizedCheckPhrases: NormalizedPhrase[];
  collectWebviewText: () => Promise<string>;
  setLoadingAction: (value: string) => void;
  setCheckEnabled: (value: boolean) => void;
  setSession: (value: ApplicationSession | null) => void;
  showError: (message: string) => void;
  refreshMetrics: (bidderId?: string) => Promise<void>;
};

export function useWorkspaceCheck({
  api,
  session,
  user,
  isElectron,
  webviewRef,
  webviewStatus,
  applicationPhrasesLength,
  normalizedCheckPhrases,
  collectWebviewText,
  setLoadingAction,
  setCheckEnabled,
  setSession,
  showError,
  refreshMetrics,
}: UseWorkspaceCheckOptions) {
  const handleCheck = useCallback(async () => {
    if (!session) return;
    setLoadingAction("check");
    setCheckEnabled(false);
    let didSubmit = false;
    try {
      if (!isElectron) {
        showError("Check is only available in the desktop app.");
        return;
      }
      if (!webviewRef.current) {
        showError("Embedded browser is not ready yet. Try again in a moment.");
        return;
      }
      if (webviewStatus === "failed") {
        showError("Embedded browser failed to load. Try again or open in a browser tab.");
        return;
      }
      if (!applicationPhrasesLength) {
        showError("No check phrases configured. Ask an admin to add them.");
        return;
      }
      const pageText = await withTimeout(
        collectWebviewText(),
        CHECK_TIMEOUT_MS,
        "Check timed out. Please try again."
      );
      const normalizedPage = normalizeTextForMatch(pageText);
      if (!normalizedPage) {
        showError("No text found on the page to check yet.");
        return;
      }
      const squishedPage = normalizedPage.replace(/\s+/g, "");
      const matchedPhrase = normalizedCheckPhrases.find(
        (phrase) =>
          normalizedPage.includes(phrase.normalized) ||
          (phrase.squished && squishedPage.includes(phrase.squished))
      );
      if (!matchedPhrase) {
        showError("No submission confirmation detected yet.");
        return;
      }
      await withTimeout(
        api(`/sessions/${session.id}/mark-submitted`, { method: "POST" }),
        CHECK_TIMEOUT_MS,
        "Check timed out. Please try again."
      );
      setSession({ ...session, status: "SUBMITTED" });
      didSubmit = true;
      if (user?.id) {
        await refreshMetrics(user.id);
      }
    } catch (err) {
      console.error(err);
      showError("Check failed. Backend must be running.");
    } finally {
      setLoadingAction("");
      if (!didSubmit && isElectron && webviewStatus === "ready") {
        setCheckEnabled(true);
      }
    }
  }, [
    api,
    applicationPhrasesLength,
    collectWebviewText,
    isElectron,
    normalizedCheckPhrases,
    refreshMetrics,
    session,
    setCheckEnabled,
    setLoadingAction,
    setSession,
    showError,
    user?.id,
    webviewRef,
    webviewStatus,
  ]);

  return { handleCheck };
}
