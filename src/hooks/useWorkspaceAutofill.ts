import { useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import type {
  AutofillResponse,
  ApplicationSession,
  FillPlanAction,
  PageFieldCandidate,
  Profile,
  WebviewHandle,
} from "../app/workspace/types";
import type { AutofillRuntimeResult } from "@/lib/autofill-engine/webview";
import {
  buildAutofillScript,
  buildCollectDomainQuestionsScript,
  buildWorkspaceAutofillProfile,
} from "@/lib/autofill-engine/webview";
import type {
  AIQuestionResponse,
  DomainAiQuestionPayload,
} from "@/lib/autofill-engine/domainQuestionHandler";

type UseWorkspaceAutofillOptions = {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  session: ApplicationSession | null;
  selectedProfile: Profile | null;
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
  selectedProfile,
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
  type DomainAiResponse = {
    answers: AIQuestionResponse[];
  };
  const runtimeSourceRef = useRef<string | null>(null);
  const runtimeSourcePromiseRef = useRef<Promise<string | null> | null>(null);
  const debug = (message: string, data?: Record<string, unknown>) => {
    if (data) {
      console.log("[autofill]", message, data);
    } else {
      console.log("[autofill]", message);
    }
  };

  const handleAutofill = useCallback(async () => {
    if (!session) {
      debug("skipping: no active session");
      return;
    }
    debug("start", {
      sessionId: session.id,
      isElectron,
      webviewStatus,
    });
    setLoadingAction("autofill");
    try {
      const isDesktop = isElectron;
      if (isDesktop && !webviewRef.current) {
        debug("blocked: webview not ready");
        showError("Embedded browser is not ready yet. Try again in a moment.");
        setLoadingAction("");
        return;
      }
      if (isDesktop && webviewStatus === "failed") {
        debug("blocked: webview failed to load");
        showError("Embedded browser failed to load. Try again or open in a browser tab.");
        setLoadingAction("");
        return;
      }

      if (isDesktop && selectedProfile) {
        debug("building autofill profile", { profileId: selectedProfile.id });
        const autofillProfile = buildWorkspaceAutofillProfile(selectedProfile);
        if (autofillProfile && webviewRef.current) {
          debug("building autofill runtime script", { engineMode: "auto" });
          const runtimeUrl =
            (process.env.NEXT_PUBLIC_AUTOFILL_RUNTIME_URL || "").trim() ||
            (typeof window !== "undefined"
              ? new URL("/autofill/runtime.js", window.location.href).toString()
              : "");
          const loadRuntimeSource = async () => {
            if (runtimeSourceRef.current) return runtimeSourceRef.current;
            if (!runtimeUrl) return null;
            if (runtimeSourcePromiseRef.current) {
              return runtimeSourcePromiseRef.current;
            }
            runtimeSourcePromiseRef.current = fetch(runtimeUrl, { cache: "no-store" })
              .then((res) => (res.ok ? res.text() : null))
              .catch(() => null);
            const result = await runtimeSourcePromiseRef.current;
            runtimeSourcePromiseRef.current = null;
            if (result) {
              runtimeSourceRef.current = result;
            }
            return result;
          };
          const runtimeSource = await loadRuntimeSource();
          let aiAnswerOverrides: AIQuestionResponse[] | undefined;

          if (webviewRef.current) {
            try {
              const collectScript = buildCollectDomainQuestionsScript(
                autofillProfile,
                { engineMode: "auto" },
                runtimeUrl,
                runtimeSource || undefined
              );
              const aiQuestions = (await webviewRef.current.executeJavaScript(
                collectScript,
                true
              )) as DomainAiQuestionPayload[] | undefined;
              if (Array.isArray(aiQuestions) && aiQuestions.length > 0) {
                debug("requesting greenhouse AI answers", { count: aiQuestions.length });
                const aiResponse = (await api("/autofill/greenhouse-ai", {
                  method: "POST",
                  body: JSON.stringify({
                    questions: aiQuestions,
                    profile: autofillProfile,
                  }),
                })) as DomainAiResponse;
                if (Array.isArray(aiResponse?.answers)) {
                  aiAnswerOverrides = aiResponse.answers;
                  debug("received greenhouse AI answers", { count: aiAnswerOverrides.length });
                }
              }
            } catch (err) {
              debug("greenhouse AI answers failed", {
                message: err instanceof Error ? err.message : "unknown",
              });
            }
          }

          const script = buildAutofillScript(
            autofillProfile,
            {
              engineMode: "auto",
              aiAnswerOverrides,
            },
            runtimeUrl,
            runtimeSource || undefined
          );
          debug("executing autofill runtime in webview", { scriptBytes: script.length });
          const autofillResult = (await webviewRef.current.executeJavaScript(
            script,
            true
          )) as AutofillRuntimeResult | undefined;
          debug("autofill runtime result", {
            success: autofillResult?.success,
            engine: autofillResult?.engine,
            redirect: Boolean(autofillResult?.redirectUrl),
            error: autofillResult?.error,
          });
          if (autofillResult?.redirectUrl) {
            debug("redirecting to greenhouse form", {
              redirectUrl: autofillResult.redirectUrl,
            });
            const view = webviewRef.current;
            if (view?.loadURL) {
              view.loadURL(autofillResult.redirectUrl);
            } else if (view) {
              view.setAttribute("src", autofillResult.redirectUrl);
            }
            showError(
              "Detected an embedded Greenhouse form. Opened the Greenhouse page directly; run autofill again once it loads."
            );
            setLoadingAction("");
            return;
          }
          if (autofillResult?.success) {
            debug("autofill runtime succeeded");
            setSession({
              ...session,
              status: "FILLED",
            });
            setLoadingAction("");
            return;
          }
          if (autofillResult?.engine === "greenhouse") {
            debug("greenhouse autofill failed", {
              error: autofillResult.error || "unknown",
            });
            showError(autofillResult.error || "Greenhouse autofill failed.");
            setLoadingAction("");
            return;
          }
        }
      }

      const pageFields = isDesktop ? await collectWebviewFields() : [];
      debug("collected page fields", { count: pageFields.length, isDesktop });
      if (isDesktop && pageFields.length === 0) {
        debug("blocked: no fields detected");
        showError("No form fields detected in the embedded browser. Try again after the form loads.");
        setLoadingAction("");
        return;
      }
      debug("requesting backend autofill plan", { sessionId: session.id });
      const res = (await api(`/sessions/${session.id}/autofill`, {
        method: "POST",
        body: JSON.stringify({
          useLlm: false,
          pageFields: isDesktop ? pageFields : undefined,
        }),
      })) as AutofillResponse;
      debug("received backend fill plan", {
        filled: res.fillPlan?.filled?.length ?? 0,
        suggestions: res.fillPlan?.suggestions?.length ?? 0,
        blocked: res.fillPlan?.blocked?.length ?? 0,
        actions: res.fillPlan?.actions?.length ?? 0,
      });
      const canApply = isElectron && Boolean(webviewRef.current) && Boolean(browserSrc);
      if (canApply && res.fillPlan?.actions?.length) {
        debug("applying autofill actions", { count: res.fillPlan.actions.length });
        const applied = await applyAutofillActions(res.fillPlan.actions);
        debug("applied autofill actions", {
          filled: applied?.filled?.length ?? 0,
          blocked: applied?.blocked?.length ?? 0,
        });
      }
      debug("autofill completed");
      setSession({
        ...session,
        status: "FILLED",
      });
    } catch (err) {
      console.error(err);
      debug("autofill error", {
        message: err instanceof Error ? err.message : "unknown",
      });
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
    selectedProfile,
    session,
    setLoadingAction,
    setSession,
    showError,
    webviewRef,
    webviewStatus,
  ]);

  return { handleAutofill };
}
