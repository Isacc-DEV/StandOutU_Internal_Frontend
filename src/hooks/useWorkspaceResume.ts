import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { API_BASE } from "@/lib/api";
import type {
  BaseResume,
  Profile,
  ResumePreviewTab,
  ResumeTemplate,
  TailorResumeResponse,
} from "../app/workspace/types";
import {
  applyTailorResumeUpdates,
  applyExperienceUpdates,
  buildBulletCountByCompanyPayload,
  buildResumePdfName,
  buildTailorBaseResume,
  extractTailorPayload,
  getPdfFilenameFromHeader,
  isBulletAugmentation,
  isExperienceUpdates,
  isCompanyBulletMap,
  isTailorResumeUpdates,
  mapBulletAugmentationToExperienceUpdates,
  mapCompanyBulletMapToExperienceUpdates,
  mergeResumeData,
  normalizeBaseResume,
  normalizeExperienceUpdates,
  normalizeResumePatch,
  selectResumePatch,
} from "@/lib/resume";

type UseWorkspaceResumeOptions = {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  activeResumePreviewHtml: string;
  baseResumeView: BaseResume;
  bulletCountByCompany: Record<string, number>;
  companyTitleKeys: string[];
  createResumePreviewTabId: () => string;
  jdDraft: string;
  profileDisplayName: string;
  resumeTemplates: ResumeTemplate[];
  resumeTemplatesLoading: boolean;
  selectedProfile?: Profile;
  selectedProfileId: string;
  selectedTemplate?: ResumeTemplate;
  readWebviewSelection: () => Promise<string>;
  setActiveResumeTabId: Dispatch<SetStateAction<string | null>>;
  setJdCaptureError: (value: string) => void;
  setJdDraft: (value: string) => void;
  setJdPreviewOpen: (value: boolean) => void;
  setResumePreviewTabs: Dispatch<SetStateAction<ResumePreviewTab[]>>;
  setTailorError: (value: string) => void;
  setTailorLoading: (value: boolean) => void;
  setTailorPdfError: (value: string) => void;
  setTailorPdfLoading: (value: boolean) => void;
  showError: (message: string) => void;
  loadResumeTemplates: () => Promise<void>;
};

export function useWorkspaceResume({
  api,
  activeResumePreviewHtml,
  baseResumeView,
  bulletCountByCompany,
  companyTitleKeys,
  createResumePreviewTabId,
  jdDraft,
  profileDisplayName,
  resumeTemplates,
  resumeTemplatesLoading,
  selectedProfile,
  selectedProfileId,
  selectedTemplate,
  readWebviewSelection,
  setActiveResumeTabId,
  setJdCaptureError,
  setJdDraft,
  setJdPreviewOpen,
  setResumePreviewTabs,
  setTailorError,
  setTailorLoading,
  setTailorPdfError,
  setTailorPdfLoading,
  showError,
  loadResumeTemplates,
}: UseWorkspaceResumeOptions) {
  const selectedProfileIdRef = useRef(selectedProfileId);

  useEffect(() => {
    selectedProfileIdRef.current = selectedProfileId;
  }, [selectedProfileId]);

  const requireProfileTemplate = useCallback((): string | null => {
    if (!selectedProfile?.resumeTemplateId) {
      showError("Assign a resume template to this profile first.");
      return null;
    }
    return selectedProfile.resumeTemplateId;
  }, [selectedProfile?.resumeTemplateId, showError]);

  const appendGeneratedResumeTab = useCallback(
    (
      resume: BaseResume,
      sourceJd: string,
      llmRawOutput: string,
      llmMeta: { provider?: string; model?: string }
    ) => {
      const nextTabId = createResumePreviewTabId();
      setResumePreviewTabs((prev) => {
        const nextIndex = prev.filter((tab) => tab.kind === "generated").length + 1;
        const nextTab: ResumePreviewTab = {
          id: nextTabId,
          label: `${profileDisplayName || "Resume"} ${nextIndex + 1}`,
          kind: "generated",
          profileId: selectedProfileIdRef.current,
          resume,
          jd: sourceJd,
          llmRawOutput,
          llmMeta,
        };
        return [...prev, nextTab];
      });
      setActiveResumeTabId(nextTabId);
    },
    [createResumePreviewTabId, profileDisplayName, setActiveResumeTabId, setResumePreviewTabs]
  );

  const generateResume = useCallback(
    async (requestProfileId: string) => {
      const baseResume = buildTailorBaseResume(baseResumeView);
      const sourceJd = jdDraft.trim();
      const baseResumeText = JSON.stringify(baseResume, null, 2);
      const bulletCountByCompanyPayload = buildBulletCountByCompanyPayload(
        companyTitleKeys,
        bulletCountByCompany
      );
      const payload: Record<string, unknown> = {
        jobDescriptionText: sourceJd,
        baseResume,
        baseResumeText,
        bulletCountByCompany: bulletCountByCompanyPayload,
        provider: "OPENAI",
      };
      const response = (await api("/llm/tailor-resume", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as TailorResumeResponse;
      const parsed = extractTailorPayload(response);
      if (!parsed) {
        throw new Error("LLM did not return JSON output.");
      }
      const directResume =
        response.resume && typeof response.resume === "object"
          ? normalizeBaseResume(response.resume as BaseResume)
          : null;
      const patchCandidate = selectResumePatch(parsed);
      const normalizedExperienceUpdates = isExperienceUpdates(patchCandidate)
        ? normalizeExperienceUpdates(patchCandidate, bulletCountByCompanyPayload)
        : isCompanyBulletMap(patchCandidate)
          ? normalizeExperienceUpdates(
              mapCompanyBulletMapToExperienceUpdates(baseResume, patchCandidate),
              bulletCountByCompanyPayload
            )
          : isBulletAugmentation(patchCandidate)
            ? normalizeExperienceUpdates(
                mapBulletAugmentationToExperienceUpdates(patchCandidate),
                bulletCountByCompanyPayload
              )
            : null;
      const nextResume = directResume
        ? directResume
        : normalizedExperienceUpdates
          ? applyExperienceUpdates(baseResume, normalizedExperienceUpdates)
          : isTailorResumeUpdates(patchCandidate)
            ? applyTailorResumeUpdates(baseResume, patchCandidate)
            : mergeResumeData(baseResume, normalizeResumePatch(patchCandidate));
      const normalized = normalizeBaseResume(nextResume);
      if (selectedProfileIdRef.current !== requestProfileId) {
        return null;
      }
      const rawOutput = response.content ?? "";
      const meta = { provider: response.provider, model: response.model };
      appendGeneratedResumeTab(normalized, sourceJd, rawOutput, meta);
      return normalized;
    },
    [
      api,
      appendGeneratedResumeTab,
      baseResumeView,
      bulletCountByCompany,
      companyTitleKeys,
      jdDraft,
    ]
  );

  const handleManualJdInput = useCallback(async () => {
    if (!selectedProfile || !selectedProfileId) {
      showError("Select a profile before generating a resume.");
      return;
    }
    const profileTemplateId = requireProfileTemplate();
    if (!profileTemplateId) return;
    setJdPreviewOpen(true);
    setJdCaptureError("");
    setJdDraft("");
    const selection = await readWebviewSelection();
    if (selection) {
      setJdDraft(selection);
    }
  }, [
    readWebviewSelection,
    requireProfileTemplate,
    selectedProfile,
    selectedProfileId,
    setJdCaptureError,
    setJdDraft,
    setJdPreviewOpen,
    showError,
  ]);

  const handleCancelJd = useCallback(() => {
    setJdPreviewOpen(false);
    setJdCaptureError("");
    setJdDraft("");
  }, [setJdCaptureError, setJdDraft, setJdPreviewOpen]);

  const handleConfirmJd = useCallback(async () => {
    if (!jdDraft.trim()) {
      setJdCaptureError("Job description is empty.");
      return;
    }
    const profileTemplateId = requireProfileTemplate();
    if (!profileTemplateId) {
      setTailorError("Assign a resume template to this profile first.");
      return;
    }
    if (!resumeTemplates.length && !resumeTemplatesLoading) {
      void loadResumeTemplates();
    }
    setJdPreviewOpen(false);
    setTailorError("");
    setTailorPdfError("");
    setTailorLoading(true);
    try {
      await generateResume(selectedProfileId);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Resume generation failed.";
      if (selectedProfileIdRef.current === selectedProfileId) {
        setTailorError(message);
      }
    } finally {
      setTailorLoading(false);
    }
  }, [
    generateResume,
    jdDraft,
    loadResumeTemplates,
    requireProfileTemplate,
    selectedProfileId,
    resumeTemplates.length,
    resumeTemplatesLoading,
    setJdCaptureError,
    setJdPreviewOpen,
    setTailorError,
    setTailorLoading,
    setTailorPdfError,
  ]);

  const handleRegenerateResume = useCallback(async () => {
    if (!jdDraft.trim()) {
      setTailorError("Job description is empty.");
      return;
    }
    if (!selectedProfile) {
      setTailorError("Select a profile before generating a resume.");
      return;
    }
    const profileTemplateId = requireProfileTemplate();
    if (!profileTemplateId) {
      setTailorError("Assign a resume template to this profile first.");
      return;
    }
    if (!resumeTemplates.length && !resumeTemplatesLoading) {
      void loadResumeTemplates();
    }
    setTailorError("");
    setTailorPdfError("");
    setTailorLoading(true);
    try {
      await generateResume(selectedProfileId);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Resume generation failed.";
      if (selectedProfileIdRef.current === selectedProfileId) {
        setTailorError(message);
      }
    } finally {
      setTailorLoading(false);
    }
  }, [
    generateResume,
    jdDraft,
    loadResumeTemplates,
    requireProfileTemplate,
    resumeTemplates.length,
    resumeTemplatesLoading,
    selectedProfile,
    selectedProfileId,
    setTailorError,
    setTailorLoading,
    setTailorPdfError,
  ]);

  const handleDownloadTailoredPdf = useCallback(async () => {
    const profileTemplateId = requireProfileTemplate();
    if (!profileTemplateId) {
      setTailorPdfError("Assign a resume template to this profile first.");
      return;
    }
    if (!selectedTemplate) {
      setTailorPdfError("Assigned resume template is unavailable. Please ask a manager to set it again.");
      return;
    }
    if (!activeResumePreviewHtml.trim()) {
      setTailorPdfError("Assign a resume template to this profile first.");
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
        body: JSON.stringify({ html: activeResumePreviewHtml, filename: fileName }),
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
  }, [
    activeResumePreviewHtml,
    requireProfileTemplate,
    selectedProfile?.displayName,
    selectedTemplate,
    setTailorPdfError,
    setTailorPdfLoading,
  ]);

  return {
    handleManualJdInput,
    handleCancelJd,
    handleConfirmJd,
    handleRegenerateResume,
    handleDownloadTailoredPdf,
  };
}
