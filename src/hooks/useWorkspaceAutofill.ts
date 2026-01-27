import { useCallback, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
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
  webviewRefsByTab?: MutableRefObject<Record<string, WebviewHandle | null>>;
  activeTabId?: string | null;
  webviewStatus: "idle" | "loading" | "ready" | "failed";
  collectWebviewFields: () => Promise<PageFieldCandidate[]>;
  applyAutofillActions: (actions: FillPlanAction[]) => Promise<{
    filled?: { field: string; value: string }[];
    blocked?: string[];
  } | null>;
  setLoadingAction: (value: string) => void;
  setSession: (value: ApplicationSession | null) => void;
  showError: (message: string) => void;
  setAutofillTabIds?: Dispatch<SetStateAction<string[]>>;
};

export function useWorkspaceAutofill({
  api,
  session,
  selectedProfile,
  isElectron,
  browserSrc,
  webviewRef,
  webviewRefsByTab,
  activeTabId,
  webviewStatus,
  collectWebviewFields,
  applyAutofillActions,
  setLoadingAction,
  setSession,
  showError,
  setAutofillTabIds,
}: UseWorkspaceAutofillOptions) {
  type DomainAiResponse = {
    answers: AIQuestionResponse[];
    prompt?: string;
    rawResponse?: string;
    provider?: string;
    model?: string;
  };
  const runtimeSourceRef = useRef<string | null>(null);
  const runtimeSourcePromiseRef = useRef<Promise<string | null> | null>(null);
  const activeAutofillCountRef = useRef(0);
  const debug = (message: string, data?: Record<string, unknown>) => {
    if (data) {
      console.log("[autofill]", message, data);
    } else {
      console.log("[autofill]", message);
    }
  };
  const logLargeText = (label: string, text: string) => {
    if (!text) return;
    console.log(`[autofill] ${label}\n${text}`);
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
    activeAutofillCountRef.current += 1;
    setLoadingAction("autofill");
    const resolvedTabId = activeTabId ?? "";
    const resolvedView =
      (isElectron &&
        resolvedTabId &&
        webviewRefsByTab?.current?.[resolvedTabId]) ||
      webviewRef.current;
    try {
      const isDesktop = isElectron;
      if (isDesktop && !resolvedView) {
        debug("blocked: webview not ready");
        showError("Embedded browser is not ready yet. Try again in a moment.");
        return;
      }
      if (isDesktop && webviewStatus === "failed") {
        debug("blocked: webview failed to load");
        showError("Embedded browser failed to load. Try again or open in a browser tab.");
        return;
      }

      if (isDesktop && selectedProfile) {
        debug("building autofill profile", { profileId: selectedProfile.id });
        const autofillProfile = buildWorkspaceAutofillProfile(selectedProfile);
        if (autofillProfile && resolvedView) {
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
          const runRuntimeAutofill = async (
            view: WebviewHandle,
            label: string
          ): Promise<AutofillRuntimeResult | undefined> => {
            let aiAnswerOverrides: AIQuestionResponse[] | undefined;
            let aiAnswerDebug:
              | {
                  prompt?: string;
                  rawResponse?: string;
                }
              | undefined;
            const debugTag = label || "";

            try {
              const collectScript = buildCollectDomainQuestionsScript(
                autofillProfile,
                { engineMode: "auto", debug: true, debugTag },
                runtimeUrl,
                runtimeSource || undefined
              );
              const aiQuestions = (await view.executeJavaScript(
                collectScript,
                true
              )) as DomainAiQuestionPayload[] | undefined;
              if (Array.isArray(aiQuestions) && aiQuestions.length > 0) {
                debug("requesting autofill AI answers", {
                  tab: label,
                  count: aiQuestions.length,
                  questions: aiQuestions.map((question) => ({
                    id: question.id,
                    type: question.type,
                    label: question.label,
                    required: question.required,
                    optionsLength: question.options?.length ?? 0,
                  })),
                });
                const aiResponse = (await api("/autofill/ai", {
                  method: "POST",
                  body: JSON.stringify({
                    questions: aiQuestions,
                    profile: autofillProfile,
                    debug: true,
                  }),
                })) as DomainAiResponse;
                if (Array.isArray(aiResponse?.answers)) {
                  aiAnswerOverrides = aiResponse.answers;
                  debug("received autofill AI answers", {
                    tab: label,
                    count: aiAnswerOverrides.length,
                  });
                  if (aiResponse.prompt || aiResponse.rawResponse) {
                    aiAnswerDebug = {
                      prompt: aiResponse.prompt,
                      rawResponse: aiResponse.rawResponse,
                    };
                  }
                  if (aiResponse.prompt) {
                    logLargeText(`autofill AI prompt${label ? ` (${label})` : ""}`, aiResponse.prompt);
                  }
                  if (aiResponse.rawResponse) {
                    logLargeText(
                      `autofill AI raw response${label ? ` (${label})` : ""}`,
                      aiResponse.rawResponse
                    );
                  }
                }
              } else {
                debug("autofill AI skipped: no custom questions detected", { tab: label });
              }
            } catch (err) {
              debug("autofill AI answers failed", {
                tab: label,
                message: err instanceof Error ? err.message : "unknown",
              });
            }

            const script = buildAutofillScript(
              autofillProfile,
              {
                engineMode: "auto",
                aiAnswerOverrides,
                aiAnswerDebug,
                debug: true,
                debugTag,
              },
              runtimeUrl,
              runtimeSource || undefined
            );
            debug("executing autofill runtime in webview", {
              tab: label,
              scriptBytes: script.length,
            });
            const result = (await view.executeJavaScript(
              script,
              true
            )) as AutofillRuntimeResult | undefined;
            debug("autofill runtime result", {
              tab: label,
              success: result?.success,
              engine: result?.engine,
              redirect: Boolean(result?.redirectUrl),
              error: result?.error,
              aiQuestionsHandled: result?.aiQuestionsHandled,
            });
            if (result?.redirectUrl) {
              debug("redirecting to greenhouse form", {
                tab: label,
                redirectUrl: result.redirectUrl,
              });
              if (view?.loadURL) {
                view.loadURL(result.redirectUrl);
              } else {
                view.setAttribute("src", result.redirectUrl);
              }
              showError(
                "Detected an embedded Greenhouse form. Opened the Greenhouse page directly; run autofill again once it loads."
              );
            }
            return result;
          };

          let activeRuntimeResult: AutofillRuntimeResult | undefined;
          if (resolvedView) {
            if (resolvedTabId) {
              setAutofillTabIds?.((prev) =>
                prev.includes(resolvedTabId) ? prev : [...prev, resolvedTabId]
              );
            }
            activeRuntimeResult = await runRuntimeAutofill(
              resolvedView,
              resolvedTabId
            );
          }

          if (activeRuntimeResult?.success) {
            debug("autofill runtime succeeded");
            setSession({
              ...session,
              status: "FILLED",
            });
            return;
          }
          if (activeRuntimeResult?.engine === "greenhouse") {
            debug("greenhouse autofill failed", {
              error: activeRuntimeResult.error || "unknown",
            });
            showError(activeRuntimeResult.error || "Greenhouse autofill failed.");
            return;
          }
        }
      }

      const pageFields = isDesktop ? await collectWebviewFields() : [];
      debug("collected page fields", { count: pageFields.length, isDesktop });
      if (isDesktop && pageFields.length === 0) {
        debug("blocked: no fields detected");
        showError("No form fields detected in the embedded browser. Try again after the form loads.");
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
      if (resolvedTabId) {
        setAutofillTabIds?.((prev) => prev.filter((id) => id !== resolvedTabId));
      }
      activeAutofillCountRef.current = Math.max(activeAutofillCountRef.current - 1, 0);
      if (activeAutofillCountRef.current === 0) {
        setLoadingAction("");
      }
    }
  }, [
    activeTabId,
    api,
    applyAutofillActions,
    browserSrc,
    collectWebviewFields,
    isElectron,
    selectedProfile,
    session,
    setAutofillTabIds,
    setLoadingAction,
    setSession,
    showError,
    webviewRef,
    webviewRefsByTab,
    webviewStatus,
  ]);

  return { handleAutofill };
}
