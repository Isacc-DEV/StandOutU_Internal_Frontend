'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../../components/TopNav";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import ChatWidget from "./components/ChatWidget";
import JdPreviewModal from "./components/JdPreviewModal";
import ResumePreviewModal from "./components/ResumePreviewModal";
import WorkspaceBrowser from "./components/WorkspaceBrowser";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import type {
  DesktopBridge,
  WebviewHandle,
  User,
  BaseInfo,
  BaseResume,
  WorkExperience,
  EducationEntry,
  Profile,
  ResumeTemplate,
  TailorResumeResponse,
  BulletAugmentation,
  CompanyBulletMap,
  ApplicationSession,
  FillPlan,
  FillPlanAction,
  PageFieldCandidate,
  AutofillResponse,
  ApplicationPhraseResponse,
  Metrics,
} from "./types";

const CONNECT_TIMEOUT_MS = 20000;
const CHECK_TIMEOUT_MS = 10000;
const TAILOR_TIMEOUT_MS = 20000;
const EMPTY_RESUME_PREVIEW = `<!doctype html>
<html>
<body style="font-family: Arial, sans-serif; padding: 24px; color: #475569;">
  <div style="max-width: 520px;">
    <h2 style="margin: 0 0 8px; font-size: 18px;">Resume preview</h2>
    <p style="margin: 0; font-size: 13px; line-height: 1.5;">
      Generate a tailored resume to see the template preview.
    </p>
  </div>
</body>
</html>`;

async function api(path: string, init?: RequestInit) {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("smartwork_token") : null;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error contacting API (${API_BASE || "unknown"}): ${message}`);
  }
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("smartwork_token");
        window.localStorage.removeItem("smartwork_user");
        window.location.href = "/auth";
      }
      throw new Error("Unauthorized");
    }
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      // Ignore JSON parse errors and show raw text.
    }
    throw new Error(message);
  }
  return res.json();
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [applicationPhrases, setApplicationPhrases] = useState<string[]>([]);
  const [checkEnabled, setCheckEnabled] = useState(false);
  const [session, setSession] = useState<ApplicationSession | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [fillPlan, setFillPlan] = useState<FillPlan | null>(null);
  const [capturedFields, setCapturedFields] = useState<PageFieldCandidate[]>([]);
  const [status, setStatus] = useState<string>("Disconnected");
  const [loadingAction, setLoadingAction] = useState<string>("");
  const [showBaseInfo, setShowBaseInfo] = useState(false);
  const [baseInfoView, setBaseInfoView] = useState<BaseInfo>(() => cleanBaseInfo({}));
  const [webviewStatus, setWebviewStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [resumeTemplates, setResumeTemplates] = useState<ResumeTemplate[]>([]);
  const [resumeTemplatesLoading, setResumeTemplatesLoading] = useState(false);
  const [resumeTemplatesError, setResumeTemplatesError] = useState("");
  const [resumeTemplateId, setResumeTemplateId] = useState("");
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
  const [jdPreviewOpen, setJdPreviewOpen] = useState(false);
  const [jdDraft, setJdDraft] = useState("");
  const [jdCaptureError, setJdCaptureError] = useState("");
  const [bulletCountByCompany, setBulletCountByCompany] = useState<Record<string, number>>({});
  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailorError, setTailorError] = useState("");
  const [tailorPdfLoading, setTailorPdfLoading] = useState(false);
  const [tailorPdfError, setTailorPdfError] = useState("");
  const [tailoredResume, setTailoredResume] = useState<BaseResume | null>(null);
  const [llmRawOutput, setLlmRawOutput] = useState("");
  const [llmMeta, setLlmMeta] = useState<{ provider?: string; model?: string } | null>(null);
  const [aiProvider, setAiProvider] = useState<"HUGGINGFACE" | "OPENAI" | "GEMINI">(
    "HUGGINGFACE"
  );
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatProvider, setChatProvider] = useState<"HUGGINGFACE" | "OPENAI" | "GEMINI">("HUGGINGFACE");
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const handleManualJdInputRef = useRef<() => void>(() => {});
  const handleAutofillRef = useRef<() => void>(() => {});
  const webviewRef = useRef<WebviewHandle | null>(null);
  const { token } = useAuth();
  const setWebviewRef = useCallback((node: WebviewHandle | null) => {
    webviewRef.current = node;
    if (node) {
      node.setAttribute("allowpopups", "true");
    }
  }, []);
  const [isClient, setIsClient] = useState(false);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string>("");
  const router = useRouter();
  const showError = useCallback((message: string) => {
    if (!message) return;
    if (typeof window !== "undefined") {
      window.alert(message);
    }
  }, []);
  const isBidder = user?.role === "BIDDER";
  const browserSrc = navigationStarted ? (session?.url || loadedUrl || "") : "";
  const webviewPartition = "persist:smartwork-jobview";

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const jobUrl = params.get("jobUrl");
    if (!jobUrl) return;
    setUrl(jobUrl);
  }, [isClient]);

  useEffect(() => {
    if (!isClient || typeof window === "undefined") return;
    const storedProvider = window.localStorage.getItem("smartwork_ai_provider") ?? "";
    if (
      storedProvider === "OPENAI" ||
      storedProvider === "HUGGINGFACE" ||
      storedProvider === "GEMINI"
    ) {
      setAiProvider(storedProvider);
    }
  }, [isClient]);

  useEffect(() => {
    if (!isClient || typeof window === "undefined") return;
    window.localStorage.setItem("smartwork_ai_provider", aiProvider);
  }, [aiProvider, isClient]);

  useEffect(() => {
    if (!isClient) return;
    const stored = window.localStorage.getItem("smartwork_user");
    const storedToken = window.localStorage.getItem("smartwork_token");
    if (stored && storedToken) {
      try {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
      } catch {
        router.replace("/auth");
      }
    } else {
      router.replace("/auth");
    }
  }, [isClient, router]);

  useEffect(() => {
    if (!user) return;
    const loadPhrases = async () => {
      try {
        const data = (await api("/application-phrases")) as ApplicationPhraseResponse;
        if (data?.phrases?.length) {
          setApplicationPhrases(data.phrases);
        }
      } catch (err) {
        console.error("Failed to load application phrases", err);
      }
    };
    void loadPhrases();
  }, [user]);

  const loadResumeTemplates = useCallback(async () => {
    setResumeTemplatesLoading(true);
    setResumeTemplatesError("");
    try {
      const list = (await api("/resume-templates")) as ResumeTemplate[];
      setResumeTemplates(list);
    } catch (err) {
      console.error(err);
      setResumeTemplatesError("Failed to load resume templates.");
    } finally {
      setResumeTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role === "OBSERVER") return;
    void loadResumeTemplates();
  }, [user, loadResumeTemplates]);

  const desktopBridge: DesktopBridge | undefined =
    isClient && typeof window !== "undefined"
      ? (window as unknown as { smartwork?: DesktopBridge }).smartwork
      : undefined;
  const isElectron = isClient && Boolean(desktopBridge?.openJobWindow);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId),
    [profiles, selectedProfileId]
  );
  const baseResumeView = useMemo(
    () => normalizeBaseResume(selectedProfile?.baseResume),
    [selectedProfile]
  );
  const companyTitleKeys = useMemo(() => {
    return (baseResumeView.workExperience ?? [])
      .map((item) => buildPromptCompanyTitleKey(item))
      .filter(Boolean);
  }, [baseResumeView]);
  const selectedTemplate = useMemo(
    () => resumeTemplates.find((template) => template.id === resumeTemplateId),
    [resumeTemplates, resumeTemplateId]
  );
  const resumePreviewHtml = useMemo(() => {
    if (!selectedTemplate || !tailoredResume) return "";
    return renderResumeTemplate(selectedTemplate.html, tailoredResume);
  }, [selectedTemplate, tailoredResume]);
  const resumePreviewDoc = useMemo(() => {
    const html = resumePreviewHtml.trim();
    return html ? html : EMPTY_RESUME_PREVIEW;
  }, [resumePreviewHtml]);

  const appliedPct = metrics ? `${metrics.appliedPercentage}%` : "0%";
  const monthlyApplied = metrics?.monthlyApplied ?? 0;
  const baseDraft = cleanBaseInfo(baseInfoView);
  const phoneCombined = formatPhone(baseDraft.contact) || "N/A";
  const normalizedCheckPhrases = useMemo(() => {
    const merged = new Map<string, string>();
    applicationPhrases.forEach((phrase) => {
      const normalized = normalizeTextForMatch(phrase);
      if (!normalized) return;
      const squished = normalized.replace(/\s+/g, "");
      merged.set(normalized, squished);
    });
    return Array.from(merged.entries()).map(([normalized, squished]) => ({
      normalized,
      squished,
    }));
  }, [applicationPhrases]);
  const canCheck =
    isElectron &&
    Boolean(session) &&
    checkEnabled &&
    session?.status !== "SUBMITTED" &&
    loadingAction !== "check" &&
    loadingAction !== "go";

  const refreshMetrics = useCallback(
    async (bidderId?: string) => {
      if (!bidderId && !user) return;
      const id = bidderId ?? user?.id;
      if (!id) return;
      try {
        const m: Metrics = await api(`/metrics/my?bidderUserId=${id}`);
        setMetrics(m);
      } catch (err) {
        console.error(err);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!selectedProfileId || !user) return;
    setSession(null);
    setFillPlan(null);
    setCapturedFields([]);
    setCheckEnabled(false);
    setNavigationStarted(false);
    setCanGoBack(false);
    setCanGoForward(false);
    setLoadedUrl("");
    const base = profiles.find((p) => p.id === selectedProfileId)?.baseInfo;
    setBaseInfoView(cleanBaseInfo(base ?? {}));
    setShowBaseInfo(false);
  }, [selectedProfileId, user, profiles]);

  useEffect(() => {
    setTailoredResume(null);
    setTailorError("");
    setTailorPdfError("");
    setResumePreviewOpen(false);
    setJdPreviewOpen(false);
    setJdDraft("");
    setJdCaptureError("");
    setLlmRawOutput("");
    setLlmMeta(null);
  }, [selectedProfileId]);

  useEffect(() => {
    if (!selectedProfileId || !selectedProfile) {
      setBulletCountByCompany({});
      return;
    }
    if (companyTitleKeys.length === 0) {
      setBulletCountByCompany({});
      return;
    }
    setBulletCountByCompany(buildBulletCountDefaults(companyTitleKeys, selectedProfile.baseAdditionalBullets));
  }, [selectedProfileId, companyTitleKeys, selectedProfile]);

  useEffect(() => {
    if (!resumeTemplates.length) {
      setResumeTemplateId("");
      return;
    }
    if (!resumeTemplateId || !resumeTemplates.some((t) => t.id === resumeTemplateId)) {
      setResumeTemplateId(resumeTemplates[0].id);
    }
  }, [resumeTemplates, resumeTemplateId]);

  useEffect(() => {
    setWebviewStatus("idle");
    setCheckEnabled(false);
    // Reset navigation state if URL changes after navigation started
    if (navigationStarted && url !== loadedUrl && url !== session?.url) {
      setNavigationStarted(false);
      setCanGoBack(false);
      setCanGoForward(false);
    }
  }, [url, navigationStarted, loadedUrl, session?.url]);

  useEffect(() => {
    if (!isElectron) return;
    setWebviewStatus("loading");
    setCheckEnabled(false);
  }, [browserSrc, isElectron]);

  const handleHotkey = useCallback(
    (eventLike: {
      key?: string;
      code?: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      shiftKey?: boolean;
      control?: boolean;
      shift?: boolean;
      preventDefault?: () => void;
    }) => {
      const keyRaw = (eventLike.key || eventLike.code || "").toString().toLowerCase();
      const ctrl = Boolean(eventLike.ctrlKey || eventLike.metaKey || eventLike.control);
      const shift = Boolean(eventLike.shiftKey || eventLike.shift);
      if (!ctrl || !shift) return;
      if (keyRaw === "g" || keyRaw === "keyg") {
        eventLike.preventDefault?.();
        handleManualJdInputRef.current();
      } else if (keyRaw === "f" || keyRaw === "keyf") {
        eventLike.preventDefault?.();
        handleAutofillRef.current();
      }
    },
    []
  );

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
    const script = `(() => {
      try {
        if (window.__smartworkSelectionCache) return true;
        window.__smartworkSelectionCache = true;
        const update = () => {
          try {
            const selection = window.getSelection ? window.getSelection().toString() : '';
            const text = selection ? selection.trim() : '';
            if (text) window.__smartworkLastSelection = text;
          } catch {
            /* ignore */
          }
        };
        document.addEventListener('mouseup', update);
        document.addEventListener('keyup', update);
        const attachFrame = (frame) => {
          try {
            const doc = frame.contentDocument;
            if (!doc) return;
            doc.addEventListener('mouseup', update);
            doc.addEventListener('keyup', update);
          } catch {
            /* ignore */
          }
        };
        Array.from(document.querySelectorAll('iframe')).forEach(attachFrame);
        const obs = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of Array.from(m.addedNodes || [])) {
              if (node && node.tagName && node.tagName.toLowerCase() === 'iframe') {
                attachFrame(node);
              }
            }
          }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
        return true;
      } catch {
        return false;
      }
    })()`;
    try {
      await view.executeJavaScript(script, true);
    } catch {
      // ignore selection cache errors
    }
  }, []);
  
  const installHotkeyBridge = useCallback(async () => {
    const view = webviewRef.current;
    if (!view) return;
    const script = `(() => {
      try {
        if (window.__smartworkHotkeysInstalled) return true;
        window.__smartworkHotkeysInstalled = true;
        const handler = (e) => {
          if (!e) return;
          const key = (e.key || '').toLowerCase();
          const ctrl = !!(e.ctrlKey || e.metaKey);
          const shift = !!e.shiftKey;
          if (!ctrl || !shift) return;
          if (key !== 'g' && key !== 'f') return;
          try { e.preventDefault(); } catch {}
          const payload = { key, ctrl: true, shift: true };
          try {
            window.postMessage({ __smartworkHotkey: payload }, '*');
          } catch { /* ignore */ }
          try {
            if (window.parent) {
              window.parent.postMessage({ __smartworkHotkey: payload }, '*');
            }
          } catch { /* ignore */ }
          try {
            // Electron guest -> host IPC
            if (window.ipcRenderer && typeof window.ipcRenderer.sendToHost === 'function') {
              window.ipcRenderer.sendToHost('smartwork-hotkey', payload);
            }
          } catch { /* ignore */ }
        };
        document.addEventListener('keydown', handler, true);
        const frames = Array.from(document.querySelectorAll('iframe'));
        frames.forEach((frame) => {
          try {
            const doc = frame.contentDocument;
            if (doc) {
              doc.addEventListener('keydown', handler, true);
            }
          } catch {
            /* ignore */
          }
        });
        return true;
      } catch {
        return false;
      }
    })()`;
    try {
      await view.executeJavaScript(script, true);
    } catch {
      // ignore hotkey bridge errors
    }
  }, []);

  useEffect(() => {
    if (!isElectron || !webviewRef.current || !browserSrc) return;
    const view = webviewRef.current;
    const checkNavigationState = () => {
      // Try Electron webview API methods first
      if (typeof (view as any).canGoBack === "function") {
        setCanGoBack((view as any).canGoBack());
      } else {
        setCanGoBack(false);
      }
      if (typeof (view as any).canGoForward === "function") {
        setCanGoForward((view as any).canGoForward());
      } else {
        setCanGoForward(false);
      }
      // Also try checking via JavaScript as fallback
      view.executeJavaScript("window.history.length > 1", true).then((result) => {
        if (typeof result === "number" && result > 1) {
          // Check if we can go back by trying to access history state
          view.executeJavaScript("window.history.state !== null", true).then((canBack) => {
            setCanGoBack(Boolean(canBack));
          }).catch(() => { });
        }
      }).catch(() => { });
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
    const handleBeforeInput = (event: any) => {
      const input = event?.input || event;
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
      const ev = event as unknown as {
        key?: string;
        code?: string;
        ctrlKey?: boolean;
        metaKey?: boolean;
        shiftKey?: boolean;
        control?: boolean;
        shift?: boolean;
        preventDefault?: () => void;
      };
      handleHotkey(ev);
    };

    let webContentsCleanup: (() => void) | null = null;
    const attachWebContentsHotkey = () => {
      if (webContentsCleanup) return;
      const wc = (view as any).getWebContents ? (view as any).getWebContents() : null;
      if (wc && typeof wc.on === "function") {
        const wcHandler = (_event: unknown, input: { key?: string; code?: string; ctrl?: boolean; control?: boolean; shift?: boolean; meta?: boolean; ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean; preventDefault?: () => void }) => {
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
    const handleIpcMessage = (event: Event) => {
      const anyEvt = event as unknown as { channel?: string; args?: Array<{ key?: string; ctrl?: boolean; shift?: boolean }> };
      if (anyEvt.channel !== "smartwork-hotkey") return;
      const payload = anyEvt.args?.[0];
      if (!payload) return;
      handleHotkey({
        key: payload.key,
        ctrlKey: payload.ctrl,
        shiftKey: payload.shift,
      });
    };
    view.addEventListener("ipc-message", handleIpcMessage as unknown as EventListener);
    const handleConsoleMessage = (evt: Event) => {
      const anyEvt = evt as unknown as { message?: string };
      const msg = (anyEvt.message || "").toString();
      if (msg.includes("__smartwork_hotkey:g")) {
        handleHotkey({ key: "g", ctrlKey: true, shiftKey: true });
      } else if (msg.includes("__smartwork_hotkey:f")) {
        handleHotkey({ key: "f", ctrlKey: true, shiftKey: true });
      }
    };
    view.addEventListener("console-message", handleConsoleMessage as unknown as EventListener);
    const messageHandler = (evt: MessageEvent) => {
      const data = evt.data as { __smartworkHotkey?: { key?: string; ctrl?: boolean; shift?: boolean } };
      if (!data || !data.__smartworkHotkey) return;
      const payload = data.__smartworkHotkey;
      handleHotkey({
        key: payload.key,
        ctrlKey: payload.ctrl,
        shiftKey: payload.shift,
      });
    };
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
  }, [isElectron, browserSrc, installSelectionCache, installHotkeyBridge, handleHotkey]);

  const collectWebviewText = useCallback(async (): Promise<string> => {
    const view = webviewRef.current;
    if (!view) return "";
    const script = `(() => {
      const readText = (doc) => {
        if (!doc) return '';
        const body = doc.body;
        const inner = body ? body.innerText || '' : '';
        const content = body ? body.textContent || '' : '';
        const title = doc.title || '';
        return [title, inner, content].filter(Boolean).join('\\n');
      };
      const mainText = readText(document);
      const frames = Array.from(document.querySelectorAll('iframe'));
      const frameText = frames
        .map((frame) => {
          try {
            const doc = frame.contentDocument;
            return readText(doc);
          } catch {
            return '';
          }
        })
        .filter(Boolean)
        .join('\\n');
      return [mainText, frameText].filter(Boolean).join('\\n');
    })()`;
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
    const script = `(() => {
      const fields = [];
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const textOf = (el) => norm(el && (el.textContent || el.innerText || ''));
      const getWin = (el) =>
        (el && el.ownerDocument && el.ownerDocument.defaultView ? el.ownerDocument.defaultView : window);
      const isVisible = (el) => {
        const win = getWin(el);
        const cs = win.getComputedStyle(el);
        if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const esc = (doc, v) => {
        const css = doc.defaultView && doc.defaultView.CSS;
        return css && css.escape ? css.escape(v) : v.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
      };
      const getLabelText = (el, doc) => {
        try {
          const labels = el.labels;
          if (labels && labels.length) {
            const t = Array.from(labels).map((n) => textOf(n)).filter(Boolean);
            if (t.length) return t.join(' ');
          }
        } catch {
          /* ignore */
        }
        const id = el.getAttribute('id');
        if (id) {
          const lab = doc.querySelector('label[for="' + esc(doc, id) + '"]');
          const t = textOf(lab);
          if (t) return t;
        }
        const wrap = el.closest('label');
        const t2 = textOf(wrap);
        return t2 || '';
      };
      const getAriaName = (el, doc) => {
        const direct = norm(el.getAttribute('aria-label'));
        if (direct) return direct;
        const labelledBy = norm(el.getAttribute('aria-labelledby'));
        if (labelledBy) {
          const parts = labelledBy
            .split(/\\s+/)
            .map((id) => textOf(doc.getElementById(id)))
            .filter(Boolean);
          return norm(parts.join(' '));
        }
        return '';
      };
      let uid = 0;
      const collectFrom = (doc, prefix) => {
        const nodes = Array.from(
          doc.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
        );
        for (const el of nodes) {
          const tag = el.tagName.toLowerCase();
          const typeAttr = (el.getAttribute('type') || '').toLowerCase();
          const isRich = el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox';
          let type = 'text';
          if (tag === 'select') type = 'select';
          else if (tag === 'textarea') type = 'textarea';
          else if (tag === 'input') type = typeAttr || el.type || 'text';
          else if (isRich) type = 'richtext';
          else type = tag;
          if (['submit', 'button', 'reset', 'image', 'hidden', 'file'].includes(type)) continue;
          if (el.disabled) continue;
          if (!isVisible(el)) continue;
          let key = el.getAttribute('data-smartwork-field');
          if (!key) {
            key = 'sw-' + prefix + '-' + uid;
            uid += 1;
            el.setAttribute('data-smartwork-field', key);
          }
          fields.push({
            field_id: el.getAttribute('name') || null,
            id: el.id || null,
            name: el.getAttribute('name') || null,
            label: getLabelText(el, doc) || null,
            ariaName: getAriaName(el, doc) || null,
            placeholder: el.getAttribute('placeholder') || null,
            type: type || null,
            required: Boolean(el.required),
            selector: '[data-smartwork-field="' + key + '"]',
          });
          if (fields.length >= 300) break;
        }
      };
      collectFrom(document, 'main');
      const frames = Array.from(document.querySelectorAll('iframe'));
      frames.forEach((frame, idx) => {
        try {
          const doc = frame.contentDocument;
          if (doc) collectFrom(doc, 'frame' + idx);
        } catch {
          /* ignore */
        }
      });
      return fields;
    })()`;
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
    const payload = JSON.stringify(actions);
    const script = `(() => {
      const actions = ${payload};
      const results = { filled: [], blocked: [] };
      const norm = (s) => (s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
      const escAttr = (doc, v) => {
        const css = doc.defaultView && doc.defaultView.CSS;
        return css && css.escape ? css.escape(v) : v.replace(/["\\\\]/g, '\\\\$&');
      };
      const collectDocs = () => {
        const docs = [document];
        const frames = Array.from(document.querySelectorAll('iframe'));
        frames.forEach((frame) => {
          try {
            const doc = frame.contentDocument;
            if (doc) docs.push(doc);
          } catch {
            /* ignore */
          }
        });
        return docs;
      };
      const dispatch = (el) => {
        const win =
          (el.ownerDocument && el.ownerDocument.defaultView ? el.ownerDocument.defaultView : window);
        el.dispatchEvent(new win.Event('input', { bubbles: true }));
        el.dispatchEvent(new win.Event('change', { bubbles: true }));
      };
      const selectOption = (el, value) => {
        const val = String(value ?? '');
        const options = Array.from(el.options || []);
        const exact = options.find((o) => o.value === val || o.label === val);
        const soft = options.find((o) => o.label && o.label.toLowerCase() === val.toLowerCase());
        const match = exact || soft;
        if (match) {
          el.value = match.value;
          dispatch(el);
          return true;
        }
        el.value = val;
        dispatch(el);
        return false;
      };
      const setValue = (el, value) => {
        const val = String(value ?? '');
        if (typeof el.focus === 'function') el.focus();
        if (el.isContentEditable) {
          el.textContent = val;
        } else {
          el.value = val;
        }
        dispatch(el);
      };
      const findByLabel = (doc, label) => {
        if (!label) return null;
        const target = norm(label);
        if (!target) return null;
        const labels = Array.from(doc.querySelectorAll('label'));
        for (const lab of labels) {
          const text = norm(lab.textContent || '');
          if (!text) continue;
          if (text === target || text.includes(target)) {
            if (lab.control) return lab.control;
            const forId = lab.getAttribute('for');
            if (forId) return doc.getElementById(forId);
          }
        }
        return null;
      };
      const findByNameOrId = (doc, value) => {
        if (!value) return null;
        const esc = escAttr(doc, String(value));
        return (
          doc.querySelector('[name="' + esc + '"]') ||
          doc.getElementById(value) ||
          doc.querySelector('#' + esc)
        );
      };
      const findByHint = (doc, hint) => {
        if (!hint) return null;
        const target = norm(hint);
        if (!target) return null;
        const nodes = Array.from(
          doc.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
        );
        for (const el of nodes) {
          const placeholder = norm(el.getAttribute('placeholder'));
          const aria = norm(el.getAttribute('aria-label'));
          const name = norm(el.getAttribute('name'));
          const id = norm(el.getAttribute('id'));
          if ([placeholder, aria, name, id].some((v) => v && v.includes(target))) {
            return el;
          }
        }
        return null;
      };
      const findElement = (doc, step) => {
        let el = null;
        if (step.selector && typeof step.selector === 'string') {
          try {
            el = doc.querySelector(step.selector);
          } catch {
            el = null;
          }
        }
        if (!el) el = findByNameOrId(doc, step.field_id || step.field);
        if (!el) el = findByLabel(doc, step.label);
        if (!el) el = findByHint(doc, step.label || step.field_id || step.field);
        return el;
      };
      const docs = collectDocs();
      for (const step of actions) {
        const action = step.action || 'fill';
        if (action === 'skip') continue;
        let el = null;
        for (const doc of docs) {
          el = findElement(doc, step);
          if (el) break;
        }
        if (!el) {
          results.blocked.push(step.field || step.selector || step.label || 'field');
          continue;
        }
        if (action === 'upload') {
          results.blocked.push(step.field || step.selector || 'upload');
          continue;
        }
        if (action === 'click') {
          el.click();
          results.filled.push({ field: step.field || step.selector || 'field', value: 'click' });
          continue;
        }
        if (action === 'check' || action === 'uncheck') {
          if ('checked' in el) {
            el.checked = action === 'check';
            dispatch(el);
            results.filled.push({ field: step.field || step.selector || 'field', value: action });
          } else {
            results.blocked.push(step.field || step.selector || 'field');
          }
          continue;
        }
        if (action === 'select') {
          if (el.tagName.toLowerCase() === 'select') {
            selectOption(el, step.value);
          } else {
            setValue(el, step.value);
          }
          results.filled.push({ field: step.field || step.selector || 'field', value: String(step.value ?? '') });
          continue;
        }
        if (el.tagName.toLowerCase() === 'select') {
          selectOption(el, step.value);
          results.filled.push({ field: step.field || step.selector || 'field', value: String(step.value ?? '') });
          continue;
        }
        setValue(el, step.value);
        results.filled.push({ field: step.field || step.selector || 'field', value: String(step.value ?? '') });
      }
      return results;
    })()`;
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

  async function handleGo() {
    if (!user || !selectedProfileId || !url) return;
    setLoadingAction("go");
    setCheckEnabled(false);
    setNavigationStarted(true);
    setLoadedUrl(url);
    try {
      const newSession: ApplicationSession = await withTimeout(
        api("/sessions", {
          method: "POST",
          body: JSON.stringify({
            bidderUserId: user.id,
            profileId: selectedProfileId,
            url,
          }),
        }),
        CONNECT_TIMEOUT_MS,
        "Connecting timed out. Please try again."
      );
      setSession(newSession);
      setStatus("Connecting to remote browser...");
      await withTimeout(
        api(`/sessions/${newSession.id}/go`, { method: "POST" }),
        CONNECT_TIMEOUT_MS,
        "Connecting timed out. Please try again."
      );
      setStatus("Connected to remote browser");
      void refreshMetrics();
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to start session. Check backend logs.";
      showError(message);
      setStatus("Connection failed");
    } finally {
      setLoadingAction("");
    }
  }

  const handleGoBack = useCallback(() => {
    if (!canGoBack) return;
    const view = webviewRef.current;
    if (isElectron && view) {
      if (typeof (view as any).goBack === "function") {
        (view as any).goBack();
      } else {
        view.executeJavaScript("window.history.back()", true).catch(console.error);
      }
      // Update navigation state after a short delay
      setTimeout(() => {
        if (typeof (view as any).canGoBack === "function") {
          setCanGoBack((view as any).canGoBack());
        }
        if (typeof (view as any).canGoForward === "function") {
          setCanGoForward((view as any).canGoForward());
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
      if (typeof (view as any).goForward === "function") {
        (view as any).goForward();
      } else {
        view.executeJavaScript("window.history.forward()", true).catch(console.error);
      }
      // Update navigation state after a short delay
      setTimeout(() => {
        if (typeof (view as any).canGoBack === "function") {
          setCanGoBack((view as any).canGoBack());
        }
        if (typeof (view as any).canGoForward === "function") {
          setCanGoForward((view as any).canGoForward());
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

  const handleRefresh = useCallback(async () => {
    if (!navigationStarted) {
      await handleGo();
      return;
    }
    const view = webviewRef.current;
    if (isElectron && view) {
      if (typeof (view as any).reload === "function") {
        (view as any).reload();
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
  }, [handleGo, isElectron, navigationStarted]);

  async function handleCheck() {
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
      if (!applicationPhrases.length) {
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
  }

  async function handleAutofill() {
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
  }

  async function readWebviewSelection() {
    if (!isElectron || !webviewRef.current) return "";
    try {
      const script = `(() => {
        const readSelection = (win) => {
          try {
            const sel = win && win.getSelection ? win.getSelection().toString() : '';
            return sel ? sel.trim() : '';
          } catch {
            return '';
          }
        };
        const main = readSelection(window);
        if (main) return main;
        const frames = Array.from(document.querySelectorAll('iframe'));
        for (const frame of frames) {
          try {
            const win = frame.contentWindow;
            const frameSel = readSelection(win);
            if (frameSel) return frameSel;
          } catch {
            /* ignore */
          }
        }
        return window.__smartworkLastSelection || '';
      })()`;
      const result = await webviewRef.current.executeJavaScript(script, true);
      return typeof result === "string" ? result.trim() : "";
    } catch {
      return "";
    }
  }

  async function handleManualJdInput() {
    if (!selectedProfile || !selectedProfileId) {
      showError("Select a profile before generating a resume.");
      return;
    }
    setJdPreviewOpen(true);
    setJdCaptureError("");
    setJdDraft("");
    const selection = await readWebviewSelection();
    if (selection) {
      setJdDraft(selection);
    }
  }

  useEffect(() => {
    handleManualJdInputRef.current = () => {
      void handleManualJdInput();
    };
    handleAutofillRef.current = () => {
      void handleAutofill();
    };
  }, [handleManualJdInput, handleAutofill]);

  function handleCancelJd() {
    setJdPreviewOpen(false);
    setJdCaptureError("");
    setJdDraft("");
  }

  async function handleConfirmJd() {
    if (!jdDraft.trim()) {
      setJdCaptureError("Job description is empty.");
      return;
    }
    setResumePreviewOpen(true);
    setJdPreviewOpen(false);
    if (!resumeTemplates.length && !resumeTemplatesLoading) {
      void loadResumeTemplates();
    }
    setTailorError("");
    setTailorPdfError("");
    setLlmRawOutput("");
    setLlmMeta(null);
    setTailorLoading(true);
    try {
      const baseResume = baseResumeView;
      const baseResumeText = JSON.stringify(baseResume, null, 2);
      const bulletCountByCompanyPayload = buildBulletCountByCompanyPayload(
        companyTitleKeys,
        bulletCountByCompany
      );
      const payload: Record<string, unknown> = {
        jobDescriptionText: jdDraft.trim(),
        baseResume,
        baseResumeText,
        bulletCountByCompany: bulletCountByCompanyPayload,
        provider: aiProvider,
      };
      const response = (await api("/llm/tailor-resume", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as TailorResumeResponse;
      setLlmRawOutput(response.content ?? "");
      setLlmMeta({ provider: response.provider, model: response.model });
      const parsed = extractTailorPayload(response);
      if (!parsed) {
        throw new Error("LLM did not return JSON output.");
      }
      const patchCandidate = selectResumePatch(parsed);
      const nextResume = isBulletAugmentation(patchCandidate)
        ? applyBulletAugmentation(baseResume, patchCandidate)
        : isCompanyBulletMap(patchCandidate)
          ? applyCompanyBulletMap(baseResume, patchCandidate)
          : mergeResumeData(baseResume, normalizeResumePatch(patchCandidate));
      const normalized = normalizeBaseResume(nextResume);
      setTailoredResume(normalized);
      // Save resume_json and job_description for chat
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("last_resume_json", JSON.stringify(normalized));
          localStorage.setItem("last_job_description", jdDraft.trim());
          // Clear chat messages since resume and JD are updated
          setChatMessages([]);
        } catch (e) {
          console.error("Failed to save resume data for chat", e);
        }
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Resume generation failed.";
      setTailorError(message);
    } finally {
      setTailorLoading(false);
    }
  }

  async function handleRegenerateResume() {
    if (!jdDraft.trim()) {
      setTailorError("Job description is empty.");
      return;
    }
    if (!selectedProfile) {
      setTailorError("Select a profile before generating a resume.");
      return;
    }
    setTailorError("");
    setTailorPdfError("");
    setLlmRawOutput("");
    setLlmMeta(null);
    setTailorLoading(true);
    try {
      const baseResume = baseResumeView;
      const baseResumeText = JSON.stringify(baseResume, null, 2);
      const bulletCountByCompanyPayload = buildBulletCountByCompanyPayload(
        companyTitleKeys,
        bulletCountByCompany
      );
      const payload: Record<string, unknown> = {
        jobDescriptionText: jdDraft.trim(),
        baseResume,
        baseResumeText,
        bulletCountByCompany: bulletCountByCompanyPayload,
        provider: aiProvider,
      };
      const response = (await api("/llm/tailor-resume", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as TailorResumeResponse;
      setLlmRawOutput(response.content ?? "");
      setLlmMeta({ provider: response.provider, model: response.model });
      const parsed = extractTailorPayload(response);
      if (!parsed) {
        throw new Error("LLM did not return JSON output.");
      }
      const patchCandidate = selectResumePatch(parsed);
      const nextResume = isBulletAugmentation(patchCandidate)
        ? applyBulletAugmentation(baseResume, patchCandidate)
        : isCompanyBulletMap(patchCandidate)
          ? applyCompanyBulletMap(baseResume, patchCandidate)
          : mergeResumeData(baseResume, normalizeResumePatch(patchCandidate));
      const normalized = normalizeBaseResume(nextResume);
      setTailoredResume(normalized);
      // Save resume_json and job_description for chat
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("last_resume_json", JSON.stringify(normalized));
          localStorage.setItem("last_job_description", jdDraft.trim());
          // Clear chat messages since resume and JD are updated
          setChatMessages([]);
        } catch (e) {
          console.error("Failed to save resume data for chat", e);
        }
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Resume generation failed.";
      setTailorError(message);
    } finally {
      setTailorLoading(false);
    }
  }

  async function handleDownloadTailoredPdf() {
    if (!resumePreviewHtml.trim()) {
      setTailorPdfError("Select a template to export.");
      return;
    }
    setTailorPdfLoading(true);
    setTailorPdfError("");
    try {
      const base = API_BASE || (typeof window !== "undefined" ? window.location.origin : "");
      const url = new URL("/resume-templates/render-pdf", base).toString();
      const fileName = buildResumePdfName(selectedProfile?.displayName, selectedTemplate?.name);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${window.localStorage.getItem("smartwork_token") ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ html: resumePreviewHtml, filename: fileName }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to export PDF.");
      }
      const blob = await res.blob();
      const headerName = getPdfFilenameFromHeader(res.headers.get("content-disposition"));
      const downloadName = headerName || `${fileName}.pdf`;
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unable to export PDF.";
      setTailorPdfError(message);
    } finally {
      setTailorPdfLoading(false);
    }
  }

  async function handleOpenChatModal() {
    setChatModalOpen(true);
    setChatMessages([]);
    setChatInput("");

    // Restore last generated resume_json and job_description
    if (typeof window !== "undefined") {
      try {
        const savedResumeJson = localStorage.getItem("last_resume_json");
        const savedJobDescription = localStorage.getItem("last_job_description");

        if (savedResumeJson && savedJobDescription) {
          const resumeJson = JSON.parse(savedResumeJson);
          // Send initial context
          setChatMessages([
            {
              role: "assistant",
              content: "I'm ready. I have your resume and job description. Ask me any interview questions!",
            },
          ]);
        } else {
          setChatMessages([
            {
              role: "assistant",
              content: "I'm ready, but I don't have your resume or job description yet. Please generate a resume first, or provide them manually.",
            },
          ]);
        }
      } catch (e) {
        console.error("Failed to restore resume data", e);
        setChatMessages([
          {
            role: "assistant",
            content: "I'm ready. Please provide your resume and job description.",
          },
        ]);
      }
    }
  }

  async function handleSendChatMessage() {
    if (!chatInput.trim() || chatLoading) return;

    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatLoading(true);

    try {
      // Get saved resume_json and job_description
      let resumeJson: BaseResume | null = null;
      let jobDescription = "";

      if (typeof window !== "undefined") {
        try {
          const savedResumeJson = localStorage.getItem("last_resume_json");
          const savedJobDescription = localStorage.getItem("last_job_description");

          if (savedResumeJson) {
            resumeJson = JSON.parse(savedResumeJson);
          }
          if (savedJobDescription) {
            jobDescription = savedJobDescription;
          }
        } catch (e) {
          console.error("Failed to load saved data", e);
        }
      }

      // Fallback to current state if not in localStorage
      if (!resumeJson && tailoredResume) {
        resumeJson = tailoredResume;
      }
      if (!jobDescription && jdDraft.trim()) {
        jobDescription = jdDraft.trim();
      }

      if (!jobDescription) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I need a job description to answer your question. Please generate a resume with a job description first.",
          },
        ]);
        return;
      }

      const payload: Record<string, unknown> = {
        resumeJson: resumeJson || {},
        jobDescription,
        question,
        provider: chatProvider,
      };

      const response = (await api("/llm/interview-chat", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as { content?: string; provider?: string; model?: string };

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.content || "I'm sorry, I couldn't generate a response.",
        },
      ]);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to get response.";
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${message}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  useEffect(() => {
    if (chatModalOpen) {
      if (chatMessagesEndRef.current) {
        chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
      // Auto-focus input when modal opens
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
    }
  }, [chatModalOpen, chatMessages]);

  useEffect(() => {
    const fetchForUser = async () => {
      if (!user || user.role === "OBSERVER") return;
      try {
        const profs: Profile[] = await api(`/profiles`);
        const visible =
          user.role === "BIDDER"
            ? profs.filter((p) => p.assignedBidderId === user.id)
            : profs;
        const normalized = visible.map((p) => ({
          ...p,
          baseInfo: cleanBaseInfo(p.baseInfo ?? {}),
          baseAdditionalBullets: p.baseAdditionalBullets ?? {},
        }));
        setProfiles(normalized);
        const defaultProfileId = normalized[0]?.id ?? "";
        setSelectedProfileId(defaultProfileId);
        void refreshMetrics(user.id);
      } catch (err) {
        console.error(err);
      }
    };
    void fetchForUser();
  }, [user, refreshMetrics]);

  if (!user) {
    return (
      <main className="min-h-screen w-full bg-gray-100 text-slate-900">
        <TopNav />
        <div className="mx-auto max-w-screen-md px-4 py-10 text-center text-sm text-slate-800">
          Redirecting to login...
        </div>
      </main>
    );
  }

  if (user.role === "OBSERVER") {
    return (
      <main className="min-h-screen w-full bg-gray-100 text-slate-900">
        <TopNav />
        <div className="mx-auto max-w-screen-md px-4 py-12 text-center space-y-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-700">Observer</p>
          <h1 className="text-2xl font-semibold">Welcome aboard</h1>
          <p className="text-sm text-slate-700">
            Observers can browse announcements. Workspace actions are disabled.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-800">
            <p className="text-sm font-semibold">Stay tuned</p>
            <p className="text-sm text-slate-700">
              Ask an admin to upgrade your role to start bidding.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen w-full bg-gray-100 text-slate-900">
        <TopNav />
        <div className="mx-auto w-full min-h-screen space-y-4 pt-[57px]">
          {user ? null : null}

          {user ? (
            <div className="relative min-h-[calc(100vh-57px)] xl:space-y-0">
              <WorkspaceSidebar
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                onSelectProfile={setSelectedProfileId}
                aiProvider={aiProvider}
                onAiProviderChange={setAiProvider}
                onOpenJdModal={handleManualJdInput}
                tailorLoading={tailorLoading}
                onAutofill={handleAutofill}
                autofillDisabled={!session || loadingAction === "autofill"}
                loadingAction={loadingAction}
                showBaseInfo={showBaseInfo}
                onToggleBaseInfo={() => setShowBaseInfo((v) => !v)}
                baseDraft={baseDraft}
                phoneCombined={phoneCombined}
              />
              <WorkspaceBrowser
                onGoBack={handleGoBack}
                onGoForward={handleGoForward}
                onRefresh={handleRefresh}
                onGo={handleGo}
                onCheck={handleCheck}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                canCheck={canCheck}
                loadingAction={loadingAction}
                selectedProfileId={selectedProfileId}
                url={url}
                onUrlChange={setUrl}
                navigationStarted={navigationStarted}
                isElectron={isElectron}
                browserSrc={browserSrc}
                setWebviewRef={setWebviewRef}
                webviewPartition={webviewPartition}
              />
            </div>
          ) : (
            <div />
          )}

        </div>
        <JdPreviewModal
          open={jdPreviewOpen}
          onClose={() => setJdPreviewOpen(false)}
          onCancel={handleCancelJd}
          onConfirm={handleConfirmJd}
          jdDraft={jdDraft}
          onJdDraftChange={setJdDraft}
          jdCaptureError={jdCaptureError}
          companyTitleKeys={companyTitleKeys}
          baseResumeView={baseResumeView}
          bulletCountByCompany={bulletCountByCompany}
          onBulletCountChange={setBulletCountByCompany}
          tailorLoading={tailorLoading}
        />
        <ResumePreviewModal
          open={resumePreviewOpen}
          onClose={() => setResumePreviewOpen(false)}
          onDownloadPdf={handleDownloadTailoredPdf}
          onRegenerate={handleRegenerateResume}
          onReselectJd={handleManualJdInput}
          resumeTemplates={resumeTemplates}
          resumeTemplatesLoading={resumeTemplatesLoading}
          resumeTemplatesError={resumeTemplatesError}
          resumeTemplateId={resumeTemplateId}
          onResumeTemplateChange={setResumeTemplateId}
          selectedProfile={selectedProfile}
          tailorLoading={tailorLoading}
          tailorError={tailorError}
          tailorPdfLoading={tailorPdfLoading}
          tailorPdfError={tailorPdfError}
          resumePreviewHtml={resumePreviewHtml}
          resumePreviewDoc={resumePreviewDoc}
          jdDraft={jdDraft}
          llmRawOutput={llmRawOutput}
          llmMeta={llmMeta}
        />
        <ChatWidget
          open={chatModalOpen}
          onOpen={handleOpenChatModal}
          onClose={() => setChatModalOpen(false)}
          chatProvider={chatProvider}
          onChatProviderChange={setChatProvider}
          chatMessages={chatMessages}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          chatLoading={chatLoading}
          onSendMessage={handleSendChatMessage}
          chatMessagesEndRef={chatMessagesEndRef}
          chatInputRef={chatInputRef}
        />
      </main>
    </>
  );
}

function cleanString(val?: string | number | null) {
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return val.trim();
  return "";
}

function formatPhone(contact?: BaseInfo["contact"]) {
  if (!contact) return "";
  const parts = [contact.phoneCode, contact.phoneNumber].map((p) => cleanString(p)).filter(Boolean);
  const combined = parts.join(" ").trim();
  const fallback = cleanString(contact.phone);
  return combined || fallback;
}

function cleanBaseInfo(base: BaseInfo): BaseInfo {
  const links = { ...(base?.links ?? {}) } as Record<string, string> & { linkedin?: string };
  if (typeof links.linkedin === "string") links.linkedin = links.linkedin.trim();
  return {
    name: { first: cleanString(base?.name?.first), last: cleanString(base?.name?.last) },
    contact: {
      email: cleanString(base?.contact?.email),
      phone: formatPhone(base?.contact),
      phoneCode: cleanString(base?.contact?.phoneCode),
      phoneNumber: cleanString(base?.contact?.phoneNumber),
    },
    links,
    location: {
      address: cleanString(base?.location?.address),
      city: cleanString(base?.location?.city),
      state: cleanString(base?.location?.state),
      country: cleanString(base?.location?.country),
      postalCode: cleanString(base?.location?.postalCode),
    },
    career: {
      jobTitle: cleanString(base?.career?.jobTitle),
      currentCompany: cleanString(base?.career?.currentCompany),
      yearsExp: cleanString(base?.career?.yearsExp as string | number | undefined),
      desiredSalary: cleanString(base?.career?.desiredSalary),
    },
    education: {
      school: cleanString(base?.education?.school),
      degree: cleanString(base?.education?.degree),
      majorField: cleanString(base?.education?.majorField),
      graduationAt: cleanString(base?.education?.graduationAt),
    },
    workAuth: {
      authorized: base?.workAuth?.authorized ?? false,
      needsSponsorship: base?.workAuth?.needsSponsorship ?? false,
    },
    preferences: base?.preferences ?? {},
    defaultAnswers: base?.defaultAnswers ?? {},
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  return Object.prototype.toString.call(value) === "[object Object]";
}

function getEmptyWorkExperience(): WorkExperience {
  return {
    companyTitle: "",
    roleTitle: "",
    employmentType: "",
    location: "",
    startDate: "",
    endDate: "",
    bullets: [""],
  };
}

function getEmptyEducation(): EducationEntry {
  return {
    institution: "",
    degree: "",
    field: "",
    date: "",
    coursework: [""],
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [""];
  const cleaned = value.map((item) => cleanString(item as string | number | null));
  return cleaned.length ? cleaned : [""];
}

function normalizeWorkExperience(value: unknown): WorkExperience {
  const source = isPlainObject(value) ? value : {};
  return {
    companyTitle: cleanString(source.companyTitle as string | number | null),
    roleTitle: cleanString(source.roleTitle as string | number | null),
    employmentType: cleanString(source.employmentType as string | number | null),
    location: cleanString(source.location as string | number | null),
    startDate: cleanString(source.startDate as string | number | null),
    endDate: cleanString(source.endDate as string | number | null),
    bullets: normalizeStringList(source.bullets),
  };
}

function normalizeEducation(value: unknown): EducationEntry {
  const source = isPlainObject(value) ? value : {};
  return {
    institution: cleanString(source.institution as string | number | null),
    degree: cleanString(source.degree as string | number | null),
    field: cleanString(source.field as string | number | null),
    date: cleanString(source.date as string | number | null),
    coursework: normalizeStringList(source.coursework),
  };
}

function getEmptyBaseResume(): BaseResume {
  return {
    Profile: {
      name: "",
      headline: "",
      contact: {
        location: "",
        email: "",
        phone: "",
        linkedin: "",
      },
    },
    summary: { text: "" },
    workExperience: [getEmptyWorkExperience()],
    education: [getEmptyEducation()],
    skills: { raw: [""] },
  };
}

function normalizeBaseResume(value?: BaseResume): BaseResume {
  if (!isPlainObject(value)) return getEmptyBaseResume();
  const profileAlias = isPlainObject((value as Record<string, unknown>).profile)
    ? ((value as Record<string, unknown>).profile as Record<string, unknown>)
    : {};
  const profileInput = isPlainObject(value.Profile) ? value.Profile : profileAlias;
  const contactInput = isPlainObject(profileInput.contact) ? profileInput.contact : {};
  const summaryInput = isPlainObject(value.summary) ? value.summary : {};
  const summaryText =
    typeof value.summary === "string"
      ? value.summary
      : cleanString(summaryInput.text as string | number | null);
  const workExperience =
    Array.isArray(value.workExperience) && value.workExperience.length
      ? value.workExperience.map(normalizeWorkExperience)
      : [getEmptyWorkExperience()];
  const education =
    Array.isArray(value.education) && value.education.length
      ? value.education.map(normalizeEducation)
      : [getEmptyEducation()];
  const skillsInput = isPlainObject(value.skills) ? value.skills : {};
  const rawSkills = Array.isArray(value.skills) ? value.skills : skillsInput.raw;

  return {
    Profile: {
      name: cleanString(profileInput.name as string | number | null),
      headline: cleanString(profileInput.headline as string | number | null),
      contact: {
        location: cleanString(contactInput.location as string | number | null),
        email: cleanString(contactInput.email as string | number | null),
        phone: cleanString(contactInput.phone as string | number | null),
        linkedin: cleanString(contactInput.linkedin as string | number | null),
      },
    },
    summary: { text: cleanString(summaryText) },
    workExperience,
    education,
    skills: { raw: normalizeStringList(rawSkills) },
  };
}

function parseJsonSafe(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractJsonPayload(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const direct = parseJsonSafe(trimmed);
  if (direct) return direct;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = parseJsonSafe(fenced[1].trim());
    if (parsed) return parsed;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = parseJsonSafe(trimmed.slice(start, end + 1));
    if (parsed) return parsed;
  }
  return null;
}

function extractTailorPayload(response: TailorResumeResponse) {
  const parsed = response.parsed ?? extractJsonPayload(response.content ?? "");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

function selectResumePatch(payload: Record<string, unknown>) {
  const candidates = [
    payload.tailored_resume,
    payload.tailoredResume,
    payload.resume,
    payload.updated_resume,
    payload.updates,
    payload.patch,
    payload.result,
    payload.output,
    payload.data,
  ];
  for (const candidate of candidates) {
    if (isPlainObject(candidate)) return candidate as Record<string, unknown>;
  }
  return payload;
}

function normalizeResumePatch(patch: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...patch };
  if (!next.Profile && isPlainObject(next.profile)) {
    next.Profile = next.profile as Record<string, unknown>;
  }
  if (!next.workExperience && Array.isArray(next.work_experience)) {
    next.workExperience = next.work_experience;
  }
  if (!next.workExperience && Array.isArray(next.experience)) {
    next.workExperience = next.experience;
  }
  if (typeof next.summary === "string") {
    next.summary = { text: next.summary };
  }
  if (Array.isArray(next.skills)) {
    next.skills = { raw: next.skills };
  }
  if (typeof next.skills === "string") {
    next.skills = { raw: [next.skills] };
  }
  return next;
}

function isBulletAugmentation(value: Record<string, unknown>): value is BulletAugmentation {
  return (
    "first_company" in value ||
    "second_company" in value ||
    "other_companies" in value
  );
}

function isCompanyBulletMap(value: Record<string, unknown>): value is CompanyBulletMap {
  if (isBulletAugmentation(value)) return false;
  const entries = Object.entries(value);
  if (!entries.length) return false;
  const hasArray = entries.some(([, v]) => Array.isArray(v));
  if (!hasArray) return false;
  return entries.every(
    ([, v]) =>
      Array.isArray(v) && v.every((item) => typeof item === "string")
  );
}

function normalizeBulletList(value?: string[]) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

function applyBulletAugmentation(base: BaseResume, augmentation: BulletAugmentation): BaseResume {
  const normalized = normalizeBaseResume(base);
  const workExperience = (normalized.workExperience ?? []).map((item) => ({
    ...item,
    bullets: Array.isArray(item.bullets) ? [...item.bullets] : [],
  }));

  const appendAt = (index: number, bullets?: string[]) => {
    if (index < 0 || index >= workExperience.length) return;
    const existing = normalizeBulletList(workExperience[index].bullets);
    const extras = normalizeBulletList(bullets);
    if (!extras.length) return;
    workExperience[index] = {
      ...workExperience[index],
      bullets: [...extras, ...existing],
    };
  };

  appendAt(0, augmentation.first_company);
  appendAt(1, augmentation.second_company);

  if (Array.isArray(augmentation.other_companies)) {
    augmentation.other_companies.forEach((entry) => {
      const rawIndex = entry?.experience_index;
      const index = typeof rawIndex === "number" ? rawIndex : Number(rawIndex);
      if (!Number.isFinite(index)) return;
      appendAt(index, entry?.bullets);
    });
  }

  return {
    ...normalized,
    workExperience,
  };
}

function buildPromptCompanyTitleKey(item: WorkExperience) {
  const source = item as Record<string, unknown>;
  const explicit = cleanString(
    (source.company_title ??
      source.companyTitle ??
      source.companyTitleText ??
      source.company_title_text ??
      source.display_title ??
      source.displayTitle ??
      source.heading) as string | number | null | undefined
  );
  if (explicit) return explicit;
  const title = cleanString(
    (source.title ?? source.roleTitle ?? source.role) as string | number | null | undefined
  );
  const company = cleanString(
    (source.company ?? source.companyTitle ?? source.company_name) as
    | string
    | number
    | null
    | undefined
  );
  if (title && company) return `${title} - ${company}`;
  return title || company || "";
}

function normalizeKeyForMatch(key: string): string {
  return cleanString(key)
    .replace(/[–—−]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildBulletCountDefaults(keys: string[], profileDefaults?: Record<string, number>) {
  const result: Record<string, number> = {};

  // Create a normalized lookup map from profile defaults
  const normalizedDefaults = new Map<string, { originalKey: string; value: number }>();
  if (profileDefaults) {
    Object.entries(profileDefaults).forEach(([key, value]) => {
      if (typeof value === "number") {
        const normalized = normalizeKeyForMatch(key);
        if (normalized) {
          normalizedDefaults.set(normalized, { originalKey: key, value });
        }
      }
    });
  }

  keys.forEach((key, index) => {
    if (!key) return;
    const normalizedKey = normalizeKeyForMatch(key);
    // Try exact match first
    if (profileDefaults && typeof profileDefaults[key] === "number") {
      result[key] = profileDefaults[key];
    }
    // Try normalized match
    else if (normalizedDefaults.has(normalizedKey)) {
      result[key] = normalizedDefaults.get(normalizedKey)!.value;
    }
    // Fall back to static defaults
    else {
      result[key] = index === 0 ? 3 : 1;
    }
  });
  return result;
}

function buildBulletCountByCompanyPayload(
  keys: string[],
  counts: Record<string, number>
) {
  const result: Record<string, number> = {};
  keys.forEach((key, index) => {
    if (!key) return;
    const raw = counts[key];
    const value =
      typeof raw === "number" && Number.isFinite(raw) ? raw : index === 0 ? 3 : 1;
    result[key] = value;
  });
  return result;
}

function buildExperienceKey(item: WorkExperience) {
  const title = cleanString(item.roleTitle);
  const company = cleanString(item.companyTitle);
  if (title && company) return `${title} - ${company}`;
  return title || company || "";
}

function normalizeCompanyKey(value: string) {
  return cleanString(value)
    .replace(/[–—−]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildExperienceKeyAliases(item: WorkExperience) {
  const aliases = new Set<string>();
  const key = buildExperienceKey(item);
  if (key) aliases.add(key);
  const title = cleanString(item.roleTitle);
  const company = cleanString(item.companyTitle);
  if (title) aliases.add(title);
  if (company) aliases.add(company);
  if (title && company) aliases.add(`${company} - ${title}`);
  return Array.from(aliases);
}

function applyCompanyBulletMap(base: BaseResume, map: CompanyBulletMap): BaseResume {
  const normalized = normalizeBaseResume(base);
  const workExperience = (normalized.workExperience ?? []).map((item) => ({
    ...item,
    bullets: Array.isArray(item.bullets) ? [...item.bullets] : [],
  }));
  const keyToIndex = new Map<string, number>();
  workExperience.forEach((item, index) => {
    buildExperienceKeyAliases(item).forEach((key) => {
      if (key && !keyToIndex.has(key)) {
        keyToIndex.set(key, index);
      }
      const normalizedKey = normalizeCompanyKey(key);
      if (normalizedKey && !keyToIndex.has(normalizedKey)) {
        keyToIndex.set(normalizedKey, index);
      }
    });
  });
  Object.entries(map).forEach(([key, bullets]) => {
    const cleanKey = cleanString(key);
    if (!cleanKey) return;
    const normalizedKey = normalizeCompanyKey(cleanKey);
    const index = keyToIndex.get(cleanKey) ?? keyToIndex.get(normalizedKey);
    if (index === undefined) return;
    const existing = normalizeBulletList(workExperience[index].bullets);
    const extras = normalizeBulletList(bullets);
    if (!extras.length) return;
    workExperience[index] = {
      ...workExperience[index],
      bullets: [...extras, ...existing],
    };
  });
  return { ...normalized, workExperience };
}

function mergeResumeData(base: BaseResume, patch: Record<string, unknown>) {
  if (!isPlainObject(patch)) return base;
  const target = isPlainObject(base) ? base : {};
  return deepMerge(target, patch) as BaseResume;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value;
      return;
    }
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value);
      return;
    }
    result[key] = value;
  });
  return result;
}

function renderResumeTemplate(templateHtml: string, resume: BaseResume) {
  if (!templateHtml.trim()) return "";
  const data = buildTemplateData(resume);
  return renderMustacheTemplate(templateHtml, data);
}

type SafeHtml = { __html: string };

function safeHtml(value: string): SafeHtml {
  return { __html: value };
}

function isSafeHtml(value: unknown): value is SafeHtml {
  return Boolean(value && typeof value === "object" && "__html" in (value as SafeHtml));
}

function buildTemplateData(resume: BaseResume) {
  const profile = resume.Profile ?? {};
  const summary = resume.summary ?? {};
  const skills = resume.skills ?? {};
  return {
    ...resume,
    Profile: profile,
    profile,
    summary,
    skills,
    work_experience: safeHtml(buildWorkExperienceHtml(resume.workExperience)),
  };
}

function buildWorkExperienceHtml(items?: WorkExperience[]) {
  const list = (items ?? []).filter(hasWorkExperience);
  if (!list.length) return "";
  return list
    .map((item, index) => {
      const title = [item.roleTitle, item.companyTitle]
        .map(cleanString)
        .filter(Boolean)
        .join(" - ");
      const dates = [item.startDate, item.endDate]
        .map(cleanString)
        .filter(Boolean)
        .join(" - ");
      const meta = [item.location, item.employmentType]
        .map(cleanString)
        .filter(Boolean)
        .join(" | ");
      const bullets = (item.bullets ?? []).map(cleanString).filter(Boolean);
      const bulletHtml = bullets.length
        ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
        : "";
      const header = escapeHtml(title || `Role ${index + 1}`);
      const datesHtml = dates ? `<div class="resume-meta">${escapeHtml(dates)}</div>` : "";
      const metaHtml = meta ? `<div class="resume-meta">${escapeHtml(meta)}</div>` : "";
      return `<div class="resume-item"><div><strong>${header}</strong></div>${datesHtml}${metaHtml}${bulletHtml}</div>`;
    })
    .join("");
}

function buildEducationHtml(items?: EducationEntry[]) {
  const list = (items ?? []).filter(hasEducationEntry);
  if (!list.length) return "";
  return list
    .map((item, index) => {
      const title = [item.degree, item.field].map(cleanString).filter(Boolean).join(" - ");
      const header = [item.institution, title].map(cleanString).filter(Boolean).join(" | ");
      const date = cleanString(item.date);
      const coursework = (item.coursework ?? []).map(cleanString).filter(Boolean);
      const courseworkText = coursework.length ? `Coursework: ${coursework.join(", ")}` : "";
      const dateHtml = date ? `<div class="resume-meta">${escapeHtml(date)}</div>` : "";
      const courseworkHtml = courseworkText
        ? `<div class="resume-meta">${escapeHtml(courseworkText)}</div>`
        : "";
      const label = escapeHtml(header || `Education ${index + 1}`);
      return `<div class="resume-item"><div><strong>${label}</strong></div>${dateHtml}${courseworkHtml}</div>`;
    })
    .join("");
}

function renderMustacheTemplate(template: string, data: Record<string, unknown>) {
  return renderTemplateWithContext(template, [data]);
}

function renderTemplateWithContext(template: string, stack: unknown[]): string {
  let output = "";
  let index = 0;

  while (index < template.length) {
    const openIndex = template.indexOf("{{", index);
    if (openIndex === -1) {
      output += template.slice(index);
      break;
    }
    output += template.slice(index, openIndex);
    const closeIndex = template.indexOf("}}", openIndex + 2);
    if (closeIndex === -1) {
      output += template.slice(openIndex);
      break;
    }
    const tag = template.slice(openIndex + 2, closeIndex).trim();
    index = closeIndex + 2;
    if (!tag) continue;

    const type = tag[0];
    if (type === "#" || type === "^") {
      const name = tag.slice(1).trim();
      if (!name) continue;
      const section = findSectionEnd(template, index, name);
      if (!section) continue;
      const inner = template.slice(index, section.start);
      index = section.end;
      const value = resolvePath(name, stack);
      const truthy = isSectionTruthy(value);

      if (type === "#") {
        if (Array.isArray(value)) {
          if (value.length) {
            value.forEach((item) => {
              output += renderTemplateWithContext(inner, pushContext(stack, item));
            });
          }
        } else if (truthy) {
          output += renderTemplateWithContext(inner, pushContext(stack, value));
        }
      } else if (!truthy) {
        output += renderTemplateWithContext(inner, stack);
      }
      continue;
    }

    if (type === "/") {
      continue;
    }

    const value = resolvePath(tag, stack);
    output += renderValue(value, tag);
  }

  return output;
}

function findSectionEnd(template: string, fromIndex: number, name: string) {
  let index = fromIndex;
  let depth = 1;
  while (index < template.length) {
    const openIndex = template.indexOf("{{", index);
    if (openIndex === -1) return null;
    const closeIndex = template.indexOf("}}", openIndex + 2);
    if (closeIndex === -1) return null;
    const tag = template.slice(openIndex + 2, closeIndex).trim();
    index = closeIndex + 2;
    if (!tag) continue;
    const type = tag[0];
    const tagName =
      type === "#" || type === "^" || type === "/" ? tag.slice(1).trim() : "";
    if (!tagName) continue;
    if ((type === "#" || type === "^") && tagName === name) {
      depth += 1;
    }
    if (type === "/" && tagName === name) {
      depth -= 1;
      if (depth === 0) {
        return { start: openIndex, end: closeIndex + 2 };
      }
    }
  }
  return null;
}

function resolvePath(path: string, stack: unknown[]) {
  if (path === ".") return resolveDot(stack);
  const parts = path.split(".");
  for (let i = 0; i < stack.length; i += 1) {
    const value = getPathValue(stack[i], parts);
    if (value !== undefined) return value;
  }
  return undefined;
}

function resolveDot(stack: unknown[]) {
  for (let i = 0; i < stack.length; i += 1) {
    const ctx = stack[i];
    if (ctx && typeof ctx === "object" && "." in (ctx as Record<string, unknown>)) {
      return (ctx as Record<string, unknown>)["."];
    }
    if (typeof ctx === "string" || typeof ctx === "number" || typeof ctx === "boolean") {
      return ctx;
    }
  }
  return undefined;
}

function getPathValue(context: unknown, parts: string[]) {
  if (!context || typeof context !== "object") return undefined;
  let current: any = context;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

function pushContext(stack: unknown[], value: unknown) {
  if (value === null || value === undefined) return stack;
  if (value && typeof value === "object") {
    return [value, ...stack];
  }
  return [{ ".": value }, ...stack];
}

function isSectionTruthy(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (isSafeHtml(value)) return Boolean(value.__html);
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "object") return true;
  return Boolean(value);
}

function renderValue(value: unknown, path: string) {
  if (isSafeHtml(value)) return value.__html;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (path === "workExperience" || path === "work_experience") {
      return buildWorkExperienceHtml(value as WorkExperience[]);
    }
    if (path === "education") {
      return buildEducationHtml(value as EducationEntry[]);
    }
    if (path === "skills.raw") {
      const joined = value.map((item) => cleanString(item as string)).filter(Boolean).join(", ");
      return escapeHtml(joined);
    }
    const joined = value.map((item) => cleanString(item as string)).filter(Boolean).join(", ");
    return escapeHtml(joined);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return escapeHtml(record.text);
    if (Array.isArray(record.raw)) {
      const joined = record.raw.map((item) => cleanString(item as string)).filter(Boolean).join(", ");
      return escapeHtml(joined);
    }
    return "";
  }
  if (typeof value === "boolean") return value ? "true" : "";
  return escapeHtml(String(value));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasWorkExperience(item: WorkExperience) {
  if (!item) return false;
  const fields = [
    cleanString(item.companyTitle),
    cleanString(item.roleTitle),
    cleanString(item.employmentType),
    cleanString(item.location),
    cleanString(item.startDate),
    cleanString(item.endDate),
  ];
  if (fields.some(Boolean)) return true;
  return (item.bullets ?? []).some((bullet) => cleanString(bullet));
}

function hasEducationEntry(item: EducationEntry) {
  if (!item) return false;
  const fields = [
    cleanString(item.institution),
    cleanString(item.degree),
    cleanString(item.field),
    cleanString(item.date),
  ];
  if (fields.some(Boolean)) return true;
  return (item.coursework ?? []).some((course) => cleanString(course));
}

function buildResumePdfName(profileName?: string, templateName?: string) {
  const base = [profileName, templateName, "resume"].filter(Boolean).join("-");
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "resume";
}

function getPdfFilenameFromHeader(header: string | null) {
  if (!header) return "";
  const match = header.match(/filename=\"?([^\";]+)\"?/i);
  return match ? match[1] : "";
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "N/A";
  }
}

function normalizeTextForMatch(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
