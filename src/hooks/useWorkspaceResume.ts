import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { API_BASE } from "@/lib/api";
import type { BaseResume, Profile, ResumeTemplate, TailorResumeResponse } from "../app/workspace/types";
import {
  applyBulletAugmentation,
  applyCompanyBulletMap,
  buildBulletCountByCompanyPayload,
  buildResumePdfName,
  extractTailorPayload,
  getPdfFilenameFromHeader,
  isBulletAugmentation,
  isCompanyBulletMap,
  mergeResumeData,
  normalizeBaseResume,
  normalizeResumePatch,
  selectResumePatch,
} from "@/lib/resume";

type UseWorkspaceResumeOptions = {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  aiProvider: "HUGGINGFACE" | "OPENAI" | "GEMINI";
  baseResumeView: BaseResume;
  bulletCountByCompany: Record<string, number>;
  companyTitleKeys: string[];
  jdDraft: string;
  resumeTemplates: ResumeTemplate[];
  resumeTemplatesLoading: boolean;
  selectedProfile?: Profile;
  selectedProfileId: string;
  selectedTemplate?: ResumeTemplate;
  resumePreviewHtml: string;
  readWebviewSelection: () => Promise<string>;
  setChatMessages: Dispatch<SetStateAction<Array<{ role: "user" | "assistant"; content: string }>>>;
  setJdCaptureError: (value: string) => void;
  setJdDraft: (value: string) => void;
  setJdPreviewOpen: (value: boolean) => void;
  setLlmMeta: (value: { provider?: string; model?: string } | null) => void;
  setLlmRawOutput: (value: string) => void;
  setResumePreviewOpen: (value: boolean) => void;
  setTailorError: (value: string) => void;
  setTailorLoading: (value: boolean) => void;
  setTailorPdfError: (value: string) => void;
  setTailorPdfLoading: (value: boolean) => void;
  setTailoredResume: (value: BaseResume | null) => void;
  showError: (message: string) => void;
  loadResumeTemplates: () => Promise<void>;
};

export function useWorkspaceResume({
  api,
  aiProvider,
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
}: UseWorkspaceResumeOptions) {
  const requireProfileTemplate = useCallback((): string | null => {
    if (!selectedProfile?.resumeTemplateId) {
      showError("Assign a resume template to this profile first.");
      return null;
    }
    return selectedProfile.resumeTemplateId;
  }, [selectedProfile?.resumeTemplateId, showError]);

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
    setResumePreviewOpen(true);
    setJdPreviewOpen(false);
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
  }, [
    aiProvider,
    api,
    baseResumeView,
    bulletCountByCompany,
    companyTitleKeys,
    jdDraft,
    loadResumeTemplates,
    requireProfileTemplate,
    resumeTemplates.length,
    resumeTemplatesLoading,
    setChatMessages,
    setJdCaptureError,
    setJdPreviewOpen,
    setLlmMeta,
    setLlmRawOutput,
    setResumePreviewOpen,
    setTailorError,
    setTailorLoading,
    setTailorPdfError,
    setTailoredResume,
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
  }, [
    aiProvider,
    api,
    baseResumeView,
    bulletCountByCompany,
    companyTitleKeys,
    jdDraft,
    loadResumeTemplates,
    requireProfileTemplate,
    resumeTemplates.length,
    resumeTemplatesLoading,
    selectedProfile,
    setChatMessages,
    setLlmMeta,
    setLlmRawOutput,
    setTailorError,
    setTailorLoading,
    setTailorPdfError,
    setTailoredResume,
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
    if (!resumePreviewHtml.trim()) {
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
  }, [
    requireProfileTemplate,
    resumePreviewHtml,
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
