import { useCallback } from "react";
import type { MutableRefObject } from "react";
import type {
  AutofillResponse,
  ApplicationSession,
  FillPlanAction,
  PageFieldCandidate,
  WebviewHandle,
} from "../app/workspace/types";

type UseWorkspaceAutofillOptions = {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  session: ApplicationSession | null;
  isElectron: boolean;
  browserSrc: string;
  webviewRef: MutableRefObject<WebviewHandle | null>;
  webviewStatus: "idle" | "loading" | "ready" | "failed";
  collectWebviewFields: () => Promise<PageFieldCandidate[]>;
  applyAutofillActions: (actions: FillPlanAction[]) => Promise<{
    filled?: { field: string; value: string }[];
    blocked?: string[];
  } | null>;
  setLoadingAction: (value: string) => void;
  setSession: (value: ApplicationSession | null) => void;
  showError: (message: string) => void;
};

export function useWorkspaceAutofill({
  api,
  session,
  isElectron,
  browserSrc,
  webviewRef,
  webviewStatus,
  collectWebviewFields,
  applyAutofillActions,
  setLoadingAction,
  setSession,
  showError,
}: UseWorkspaceAutofillOptions) {
  const handleAutofill = useCallback(async () => {
    if (!session) return;
    setLoadingAction("autofill");
    try {
      const isDesktop = isElectron;
      if (isDesktop && !webviewRef.current) {
        showError("Embedded browser is not ready yet. Try again in a moment.");
        setLoadingAction("");
        return;
      }
      if (isDesktop && webviewStatus === "failed") {
        showError("Embedded browser failed to load. Try again or open in a browser tab.");
        setLoadingAction("");
        return;
      }
      const pageFields = isDesktop ? await collectWebviewFields() : [];
      if (isDesktop && pageFields.length === 0) {
        showError("No form fields detected in the embedded browser. Try again after the form loads.");
        setLoadingAction("");
        return;
      }
      const res = (await api(`/sessions/${session.id}/autofill`, {
        method: "POST",
        body: JSON.stringify({
          useLlm: false,
          pageFields: isDesktop ? pageFields : undefined,
        }),
      })) as AutofillResponse;
      const canApply = isElectron && Boolean(webviewRef.current) && Boolean(browserSrc);
      if (canApply && res.fillPlan?.actions?.length) {
        await applyAutofillActions(res.fillPlan.actions);
      }
      setSession({
        ...session,
        status: "FILLED",
      });
    } catch (err) {
      console.error(err);
      showError("Autofill failed. Backend must be running.");
    } finally {
      setLoadingAction("");
    }
  }, [
    api,
    applyAutofillActions,
    browserSrc,
    collectWebviewFields,
    isElectron,
    session,
    setLoadingAction,
    setSession,
    showError,
    webviewRef,
    webviewStatus,
  ]);

  return { handleAutofill };
}
