'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import ChatWidget from "@/components/workspace/ChatWidget";
import JdPreviewModal from "@/components/workspace/JdPreviewModal";
import ResumePreviewModal from "@/components/workspace/ResumePreviewModal";
import WorkspaceBrowser from "@/components/workspace/WorkspaceBrowser";
import WorkspaceSidebar from "@/components/workspace/WorkspaceSidebar";
import type {
  DesktopBridge,
  Profile,
  BaseInfo,
  BaseResume,
  ApplicationSession,
  ApplicationPhraseResponse,
} from "./types";
import { workspaceApi as api } from "@/lib/api";
import { EMPTY_RESUME_PREVIEW } from "@/lib/constants";
import {
  buildBulletCountDefaults,
  buildPromptCompanyTitleKey,
  cleanBaseInfo,
  formatPhone,
  normalizeBaseResume,
} from "@/lib/resume";
import { renderResumeTemplate } from "@/lib/resumeTemplate";
import { normalizeTextForMatch } from "@/lib/utils";
import { useWorkspaceChat } from "@/hooks/useWorkspaceChat";
import { useResumeTemplates } from "@/hooks/useResumeTemplates";
import { useWorkspaceProfiles } from "@/hooks/useWorkspaceProfiles";
import { useWorkspaceWebview } from "@/hooks/useWorkspaceWebview";
import { useWorkspaceNavigation } from "@/hooks/useWorkspaceNavigation";
import { useWorkspaceCheck } from "@/hooks/useWorkspaceCheck";
import { useWorkspaceAutofill } from "@/hooks/useWorkspaceAutofill";
import { useWorkspaceResume } from "@/hooks/useWorkspaceResume";
import {
  type AiProvider,
  getJobUrlSnapshot,
  getStoredAiProviderSnapshot,
  getStoredUserSnapshot,
  subscribeToLocation,
  subscribeToStorage,
} from "@/lib/externalStore";

export default function Page() {
  const user = useSyncExternalStore(subscribeToStorage, getStoredUserSnapshot, () => null);
  const jobUrlFromQuery = useSyncExternalStore(subscribeToLocation, getJobUrlSnapshot, () => "");
  const [url, setUrl] = useState<string>("");
  const [hasEditedUrl, setHasEditedUrl] = useState(false);
  const [applicationPhrases, setApplicationPhrases] = useState<string[]>([]);
  const [checkEnabled, setCheckEnabled] = useState(false);
  const [session, setSession] = useState<ApplicationSession | null>(null);
  const [loadingAction, setLoadingAction] = useState<string>("");
  const [showBaseInfo, setShowBaseInfo] = useState(false);
  const [baseInfoView, setBaseInfoView] = useState<BaseInfo>(() => cleanBaseInfo({}));
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
  const aiProvider = useSyncExternalStore(
    subscribeToStorage,
    getStoredAiProviderSnapshot,
    () => "HUGGINGFACE"
  );
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string>("");
  const autoGoUrlRef = useRef<string>("");
  const lastQueryUrlRef = useRef<string>("");

  const router = useRouter();
  const isClient = typeof window !== "undefined";
  const showError = useCallback((message: string) => {
    if (!message) return;
    if (typeof window !== "undefined") {
      window.alert(message);
    }
  }, []);

  const resetProfileState = useCallback((profileId: string, profilesList: Profile[]) => {
    setSession(null);
    setCheckEnabled(false);
    setNavigationStarted(false);
    setLoadedUrl("");
    setShowBaseInfo(false);

    const profile = profilesList.find((item) => item.id === profileId);
    setBaseInfoView(cleanBaseInfo(profile?.baseInfo ?? {}));

    setTailoredResume(null);
    setTailorError("");
    setTailorPdfError("");
    setResumePreviewOpen(false);
    setJdPreviewOpen(false);
    setJdDraft("");
    setJdCaptureError("");
    setLlmRawOutput("");
    setLlmMeta(null);

    if (!profile) {
      setBulletCountByCompany({});
      return;
    }
    const normalizedResume = normalizeBaseResume(profile.baseResume);
    const titleKeys = (normalizedResume.workExperience ?? [])
      .map((item) => buildPromptCompanyTitleKey(item))
      .filter(Boolean);
    setBulletCountByCompany(
      titleKeys.length
        ? buildBulletCountDefaults(titleKeys, profile.baseAdditionalBullets)
        : {}
    );
  }, []);

  const handleAiProviderChange = useCallback((value: AiProvider) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("smartwork_ai_provider", value);
    window.dispatchEvent(new Event("smartwork-storage"));
  }, []);

  const {
    profiles,
    selectedProfileId,
    setSelectedProfileId,
    selectedProfile,
    refreshMetrics,
  } = useWorkspaceProfiles({ api, user, onProfileChange: resetProfileState });

  const {
    resumeTemplates,
    resumeTemplatesLoading,
    selectedTemplate,
    templateStatusError,
    loadResumeTemplates,
  } = useResumeTemplates({ api, user, selectedProfile });

  const {
    chatModalOpen,
    setChatModalOpen,
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    chatProvider,
    setChatProvider,
    chatMessagesEndRef,
    chatInputRef,
    handleOpenChatModal,
    handleSendChatMessage,
  } = useWorkspaceChat({ api, tailoredResume, jdDraft });

  const handleManualJdInputRef = useRef<() => void>(() => {});
  const handleAutofillRef = useRef<() => void>(() => {});

  const effectiveUrl = hasEditedUrl ? url : url || jobUrlFromQuery;
  const browserSrc = navigationStarted ? (session?.url || loadedUrl || "") : "";
  const webviewPartition = "persist:smartwork-jobview";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) return;
    const stored = window.localStorage.getItem("smartwork_user");
    const storedToken = window.localStorage.getItem("smartwork_token");
    if (stored && storedToken) return;
    router.replace("/auth");
  }, [router, user]);

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

  const desktopBridge: DesktopBridge | undefined =
    isClient ? (window as unknown as { smartwork?: DesktopBridge }).smartwork : undefined;
  const isElectron = Boolean(desktopBridge?.openJobWindow);

  const baseResumeView = useMemo(
    () => normalizeBaseResume(selectedProfile?.baseResume),
    [selectedProfile]
  );
  const companyTitleKeys = useMemo(() => {
    return (baseResumeView.workExperience ?? [])
      .map((item) => buildPromptCompanyTitleKey(item))
      .filter(Boolean);
  }, [baseResumeView]);
  const resumePreviewHtml = useMemo(() => {
    if (!selectedTemplate || !tailoredResume) return "";
    return renderResumeTemplate(selectedTemplate.html, tailoredResume);
  }, [selectedTemplate, tailoredResume]);
  const resumePreviewDoc = useMemo(() => {
    const html = resumePreviewHtml.trim();
    return html ? html : EMPTY_RESUME_PREVIEW;
  }, [resumePreviewHtml]);

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


  const {
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
    readWebviewSelection,
    handleGoBack,
    handleGoForward,
  } = useWorkspaceWebview({
    isClient,
    isElectron,
    browserSrc,
    handleHotkey,
    setCheckEnabled,
  });

  const handleSelectProfile = useCallback(
    (profileId: string) => {
      setSelectedProfileId(profileId);
      resetProfileState(profileId, profiles);
    },
    [profiles, resetProfileState, setSelectedProfileId]
  );

  const handleUrlChange = useCallback(
    (nextUrl: string) => {
      setHasEditedUrl(true);
      setUrl(nextUrl);
      setWebviewStatus("idle");
      setCheckEnabled(false);
      // Reset navigation state if URL changes after navigation started
      if (navigationStarted && nextUrl !== loadedUrl && nextUrl !== session?.url) {
        setNavigationStarted(false);
        setCanGoBack(false);
        setCanGoForward(false);
      }
    },
    [
      loadedUrl,
      navigationStarted,
      session?.url,
      setHasEditedUrl,
      setCheckEnabled,
      setCanGoBack,
      setCanGoForward,
      setNavigationStarted,
      setUrl,
      setWebviewStatus,
    ]
  );

  useEffect(() => {
    if (!jobUrlFromQuery) return;
    if (lastQueryUrlRef.current === jobUrlFromQuery) return;
    lastQueryUrlRef.current = jobUrlFromQuery;
    setHasEditedUrl(false);
    setUrl(jobUrlFromQuery);
  }, [jobUrlFromQuery]);


  const { handleGo, handleRefresh } = useWorkspaceNavigation({
    api,
    user,
    selectedProfileId,
    url: effectiveUrl,
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
  });

  useEffect(() => {
    if (!jobUrlFromQuery) return;
    if (!user || !selectedProfileId) return;
    if (loadingAction === "go") return;
    if (hasEditedUrl) return;
    const trimmed = jobUrlFromQuery.trim();
    if (!trimmed) return;
    if (autoGoUrlRef.current === trimmed) return;
    autoGoUrlRef.current = trimmed;
    void handleGo();
  }, [
    handleGo,
    hasEditedUrl,
    jobUrlFromQuery,
    loadingAction,
    selectedProfileId,
    user,
  ]);

  const { handleCheck } = useWorkspaceCheck({
    api,
    session,
    user,
    isElectron,
    webviewRef,
    webviewStatus,
    applicationPhrasesLength: applicationPhrases.length,
    normalizedCheckPhrases,
    collectWebviewText,
    setLoadingAction,
    setCheckEnabled,
    setSession,
    showError,
    refreshMetrics,
  });

  const { handleAutofill } = useWorkspaceAutofill({
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
  });

  const {
    handleManualJdInput,
    handleCancelJd,
    handleConfirmJd,
    handleRegenerateResume,
    handleDownloadTailoredPdf,
  } = useWorkspaceResume({
    api,
    aiProvider: aiProvider as AiProvider,
    baseResumeView,
    bulletCountByCompany,
    companyTitleKeys,
    jdDraft,
    resumeTemplates,
    resumeTemplatesLoading,
    selectedProfile,
    selectedProfileId,
    selectedTemplate,
    resumePreviewHtml,
    readWebviewSelection,
    setChatMessages,
    setJdCaptureError,
    setJdDraft,
    setJdPreviewOpen,
    setLlmMeta,
    setLlmRawOutput,
    setResumePreviewOpen,
    setTailorError,
    setTailorLoading,
    setTailorPdfError,
    setTailorPdfLoading,
    setTailoredResume,
    showError,
    loadResumeTemplates,
  });

  useEffect(() => {
    handleManualJdInputRef.current = () => {
      void handleManualJdInput();
    };
    handleAutofillRef.current = () => {
      void handleAutofill();
    };
  }, [handleManualJdInput, handleAutofill]);


  if (!user) {
    return (
      <main className="min-h-screen w-full bg-gray-100 text-slate-900">
        <TopNav />
        <div className="mx-auto max-w-screen px-4 py-10 text-center text-sm text-slate-800">
          Redirecting to login...
        </div>
      </main>
    );
  }

  if (user.role === "OBSERVER") {
    return (
      <main className="min-h-screen w-full bg-gray-100 text-slate-900">
        <TopNav />
        <div className="mx-auto max-w-screen px-4 py-12 text-center space-y-3">
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
                onSelectProfile={handleSelectProfile}
                aiProvider={aiProvider as AiProvider}
                onAiProviderChange={handleAiProviderChange}
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
                url={effectiveUrl}
                onUrlChange={handleUrlChange}
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
          templateName={selectedTemplate?.name || selectedProfile?.resumeTemplateName || ""}
          templateLoading={resumeTemplatesLoading}
          templateError={templateStatusError}
          templateAssigned={Boolean(selectedProfile?.resumeTemplateId)}
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

