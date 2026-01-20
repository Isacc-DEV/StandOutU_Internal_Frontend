import { useCallback, useEffect, useMemo, useState } from "react";
import type { Profile, ResumeTemplate, User } from "../app/workspace/types";

type UseResumeTemplatesOptions = {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  user: User | null;
  selectedProfile?: Profile;
};

export function useResumeTemplates({
  api,
  user,
  selectedProfile,
}: UseResumeTemplatesOptions) {
  const [resumeTemplates, setResumeTemplates] = useState<ResumeTemplate[]>([]);
  const [resumeTemplatesLoading, setResumeTemplatesLoading] = useState(false);
  const [resumeTemplatesError, setResumeTemplatesError] = useState("");
  const [resumeTemplateId, setResumeTemplateId] = useState("");

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
  }, [api]);

  useEffect(() => {
    if (!user || user.role === "OBSERVER") return;
    void loadResumeTemplates();
  }, [user, loadResumeTemplates]);

  useEffect(() => {
    if (!resumeTemplates.length) {
      setResumeTemplateId(selectedProfile?.resumeTemplateId ?? "");
      return;
    }
    setResumeTemplateId(selectedProfile?.resumeTemplateId ?? "");
  }, [resumeTemplates, selectedProfile?.id, selectedProfile?.resumeTemplateId]);

  useEffect(() => {
    if (!selectedProfile?.resumeTemplateId) return;
    const hasTemplate = resumeTemplates.some(
      (template) => template.id === selectedProfile.resumeTemplateId
    );
    if (!hasTemplate && !resumeTemplatesLoading) {
      void loadResumeTemplates();
    }
  }, [loadResumeTemplates, resumeTemplates, resumeTemplatesLoading, selectedProfile?.resumeTemplateId]);

  const selectedTemplate = useMemo(
    () => resumeTemplates.find((template) => template.id === resumeTemplateId),
    [resumeTemplates, resumeTemplateId]
  );

  const templateStatusError = useMemo(() => {
    if (!selectedProfile?.resumeTemplateId) return resumeTemplatesError;
    if (!resumeTemplatesLoading && selectedProfile.resumeTemplateId && !selectedTemplate) {
      return "Assigned resume template is unavailable. Please ask a manager to update it.";
    }
    return resumeTemplatesError;
  }, [resumeTemplatesError, resumeTemplatesLoading, selectedProfile?.resumeTemplateId, selectedTemplate]);

  return {
    resumeTemplates,
    resumeTemplatesLoading,
    resumeTemplatesError,
    resumeTemplateId,
    setResumeTemplateId,
    selectedTemplate,
    templateStatusError,
    loadResumeTemplates,
  };
}
