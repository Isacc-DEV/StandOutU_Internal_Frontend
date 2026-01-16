'use client';

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Save, XCircle, Plus, X, Check, Eye, Trash2, FileCode } from "lucide-react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import ManagerShell from "../../../components/ManagerShell";

type ResumeTemplate = {
  id: string;
  name: string;
  description?: string | null;
  html: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
};

type BaseResume = {
  Profile?: {
    name?: string;
    headline?: string;
    contact?: {
      location?: string;
      email?: string;
      phone?: string;
      linkedin?: string;
    };
  };
  summary?: { text?: string };
  workExperience?: Array<{
    companyTitle?: string;
    roleTitle?: string;
    employmentType?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    bullets?: string[];
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    field?: string;
    date?: string;
    coursework?: string[];
  }>;
  skills?: { raw?: string[] };
};

type TemplateDraft = {
  name: string;
  description: string;
  html: string;
};

type EditorMode = "view" | "edit" | "create";

const DEFAULT_TEMPLATE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Resume</title>
  <style>
    body { font-family: "Arial", sans-serif; margin: 32px; color: #0f172a; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 12px; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: 2px; color: #475569; }
    p, li { font-size: 13px; line-height: 1.5; }
    .muted { color: #64748b; font-size: 12px; }
    .resume-item { margin-bottom: 12px; }
    .resume-meta { color: #64748b; font-size: 12px; }
    .section { margin-top: 16px; }
    .item { margin-bottom: 10px; }
  </style>
</head>
<body>
  <header>
    <h1>{{profile.name}}</h1>
    <div class="muted">{{profile.headline}} | {{profile.contact.location}}</div>
    <div class="muted">
      {{profile.contact.email}} | {{profile.contact.phone}} | {{profile.contact.linkedin}}
    </div>
  </header>
  <section class="section">
    <h2>Summary</h2>
    <p>{{summary}}</p>
  </section>
  <section class="section">
    <h2>Experience</h2>
    {{work_experience}}
  </section>
  <section class="section">
    <h2>Education</h2>
    {{education}}
  </section>
  <section class="section">
    <h2>Skills</h2>
    <p>{{skills}}</p>
  </section>
</body>
</html>`;

const EMPTY_PREVIEW_HTML = `<!doctype html>
<html>
<body style="font-family: Arial, sans-serif; padding: 24px; color: #475569;">
  <p>No HTML to preview yet.</p>
</body>
</html>`;

export default function ManagerResumeTemplatesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const modalRoot = typeof document !== "undefined" ? document.body : null;
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>("view");
  const [draft, setDraft] = useState<TemplateDraft>(getEmptyDraft());
  const [saving, setSaving] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace("/auth");
      return;
    }
    if (user.role !== "MANAGER" && user.role !== "ADMIN") {
      router.replace("/workspace");
      return;
    }
    void loadTemplates(token);
  }, [loading, user, token, router]);

  useEffect(() => {
    if (mode === "create") return;
    if (selectedId && templates.some((template) => template.id === selectedId)) return;
    setSelectedId(templates[0]?.id ?? null);
  }, [mode, selectedId, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );

  useEffect(() => {
    if (mode !== "view") return;
    if (!selectedTemplate) return;
    setDraft(buildDraftFromTemplate(selectedTemplate));
  }, [mode, selectedTemplate]);

  const isDirty = useMemo(() => {
    if (mode === "create") {
      return draft.name.trim() !== "" || draft.description.trim() !== "" || draft.html.trim() !== "";
    }
    if (mode === "edit" && selectedTemplate) {
      const original = buildDraftFromTemplate(selectedTemplate);
      return (
        draft.name.trim() !== original.name.trim() ||
        draft.description.trim() !== original.description.trim() ||
        draft.html.trim() !== original.html.trim()
      );
    }
    return false;
  }, [mode, draft, selectedTemplate]);

  const previewHtml = useMemo(() => {
    let rendered = "";
    if (mode === "view") {
      const templateHtml = selectedTemplate?.html ?? "";
      if (templateHtml.trim()) {
        rendered = renderResumeTemplate(templateHtml, getDemoResumeData());
      } else {
        return EMPTY_PREVIEW_HTML;
      }
    } else {
      const draftHtml = draft.html.trim();
      if (draftHtml) {
        rendered = renderResumeTemplate(draftHtml, getDemoResumeData());
      } else {
        return EMPTY_PREVIEW_HTML;
      }
    }
    
    // If the rendered HTML doesn't have <html> tag, wrap it
    if (rendered && !rendered.trim().toLowerCase().startsWith("<!doctype") && !rendered.trim().toLowerCase().startsWith("<html")) {
      return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Resume Preview</title>
</head>
<body>
${rendered}
</body>
</html>`;
    }
    return rendered || EMPTY_PREVIEW_HTML;
  }, [mode, selectedTemplate, draft.html]);
  const previewDoc = previewHtml;

  async function loadTemplates(authToken: string) {
    setLoadingTemplates(true);
    setError("");
    try {
      const data = await api<ResumeTemplate[]>("/resume-templates", undefined, authToken);
      setTemplates(sortTemplates(data));
    } catch (err) {
      console.error(err);
      setError("Failed to load templates.");
    } finally {
      setLoadingTemplates(false);
    }
  }

  function startCreate() {
    setMode("create");
    setSelectedId(null);
    setDraft(getEmptyDraft());
    setError("");
    setDetailOpen(true);
  }

  function selectTemplate(id: string) {
    setMode("view");
    setSelectedId(id);
    setError("");
    setDetailOpen(true);
  }

  function openPreview(id: string) {
    setMode("view");
    setSelectedId(id);
    setDetailOpen(true);
  }

  function openEdit(id: string) {
    setMode("edit");
    setSelectedId(id);
    setDetailOpen(true);
    const template = templates.find((t) => t.id === id);
    if (template) {
      setDraft(buildDraftFromTemplate(template));
    }
  }

  function startEdit() {
    if (!selectedTemplate) return;
    setMode("edit");
    setDraft(buildDraftFromTemplate(selectedTemplate));
    setError("");
  }

  function confirmCancel() {
    setConfirmCancelOpen(true);
  }

  function cancelEdit() {
    if (mode === "create") {
      setMode("view");
      setSelectedId(templates[0]?.id ?? null);
      setDraft(getEmptyDraft());
      setDetailOpen(false);
      setConfirmCancelOpen(false);
      return;
    }
    setMode("view");
    if (selectedTemplate) {
      setDraft(buildDraftFromTemplate(selectedTemplate));
    }
    setConfirmCancelOpen(false);
  }

  function confirmSave() {
    setConfirmSaveOpen(true);
  }

  async function executeSave() {
    if (!token) return;
    const name = draft.name.trim();
    const html = draft.html.trim();
    if (!name) {
      setError("Template name is required.");
      setConfirmSaveOpen(false);
      return;
    }
    if (!html) {
      setError("Template HTML is required.");
      setConfirmSaveOpen(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (mode === "create") {
        const created = await api<ResumeTemplate>(
          "/resume-templates",
          {
            method: "POST",
            body: JSON.stringify({
              name,
              description: normalizeDescription(draft.description),
              html: draft.html,
            }),
          },
          token,
        );
        setTemplates((prev) => sortTemplates([created, ...prev]));
        setSelectedId(created.id);
        setMode("view");
      }
      if (mode === "edit" && selectedTemplate) {
        const updated = await api<ResumeTemplate>(
          `/resume-templates/${selectedTemplate.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name,
              description: normalizeDescription(draft.description),
              html: draft.html,
            }),
          },
          token,
        );
        setTemplates((prev) =>
          sortTemplates(prev.map((item) => (item.id === updated.id ? updated : item))),
        );
        setSelectedId(updated.id);
        setMode("view");
      }
      setConfirmSaveOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to save template.");
      setConfirmSaveOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !pendingDeleteId) return;
    const template = templates.find((t) => t.id === pendingDeleteId);
    if (!template) return;
    setSaving(true);
    setError("");
    try {
      await api(`/resume-templates/${pendingDeleteId}`, { method: "DELETE" }, token);
      const remaining = templates.filter((item) => item.id !== pendingDeleteId);
      setTemplates(remaining);
      if (selectedId === pendingDeleteId) {
        setSelectedId(remaining[0]?.id ?? null);
        setMode("view");
        if (remaining.length === 0) {
          setDetailOpen(false);
        }
      }
      setConfirmDeleteOpen(false);
      setPendingDeleteId(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to delete template.");
      setConfirmDeleteOpen(false);
      setPendingDeleteId(null);
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(id: string) {
    setPendingDeleteId(id);
    setConfirmDeleteOpen(true);
  }

  return (
    <ManagerShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
              <FileCode className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                Manager
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                Resume templates
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Store HTML-based resume templates and preview them before use.
          </p>
        </header>
      <div className="space-y-6">

        {error ? (
          <div className="rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Templates</h2>
              <p className="text-xs text-slate-500">{templates.length} total</p>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_25px_-16px_rgba(99,102,241,0.8)] transition hover:brightness-110"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
          <div className="overflow-x-auto">
            {loadingTemplates ? (
              <div className="px-4 py-6 text-sm text-slate-600">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">
                No templates yet. Create one to get started.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Templates Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Created_by</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Created_at</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Updated_by</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Updated_at</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {templates.map((template, index) => {
                    const active = template.id === selectedId;
                    return (
                      <tr
                        key={template.id}
                        onClick={() => selectTemplate(template.id)}
                        className={`cursor-pointer transition ${
                          active
                            ? "bg-slate-100"
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-slate-700">{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{template.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{template.createdByName || template.createdBy || "N/A"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(template.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{template.updatedBy || "N/A"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(template.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openPreview(template.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-100"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(template.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-100"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDelete(template.id)}
                              disabled={saving}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {detailOpen && (
          <div
            className={`fixed top-[57px] right-0 z-40 h-[calc(100vh-57px)] w-full max-w-2xl transform border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ${
              detailOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex h-full flex-col overflow-y-auto">
              <section className="p-5">
                {!selectedTemplate && mode !== "create" ? (
                  <div className="text-sm text-slate-600">
                    Select a template from the list or create a new one.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          {mode === "create" ? "Create template" : "Template details"}
                        </p>
                        <h2 className="text-lg font-semibold text-slate-900 mt-1">
                          {mode === "view"
                            ? selectedTemplate?.name
                            : draft.name || "Untitled template"}
                        </h2>
                        {mode === "view" && selectedTemplate ? (
                          <p className="text-xs text-slate-500 mt-1">
                            Updated {formatDate(selectedTemplate.updatedAt)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {mode === "view" && selectedTemplate ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setDetailOpen(false)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-100"
                              title="Close"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={startEdit}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-100"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDelete(selectedTemplate.id)}
                              disabled={saving}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={confirmSave}
                              disabled={saving || !isDirty}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={confirmCancel}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-100"
                              title="Cancel"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                {mode !== "view" ? (
                  <div className="space-y-3">
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Name</span>
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, name: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Description
                      </span>
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, description: event.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">HTML</span>
                      <textarea
                        value={draft.html}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, html: event.target.value }))
                        }
                        rows={12}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {selectedTemplate?.description || "No description provided."}
                  </div>
                )}

                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Preview</div>
                  <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <iframe
                      title="Resume template preview"
                      srcDoc={previewDoc}
                      className="h-[480px] w-full"
                      sandbox=""
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>
            )}
              </section>
            </div>
          </div>
        )}

        {modalRoot && confirmDeleteOpen && pendingDeleteId
          ? createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-6">
            <div
              className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-700">Confirm delete</p>
                <h3 className="text-xl font-semibold text-amber-900 mt-1">
                  Are you sure to delete template '{templates.find((t) => t.id === pendingDeleteId)?.name || "Unknown"}'?
                </h3>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setConfirmDeleteOpen(false);
                    setPendingDeleteId(null);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-500 text-white shadow-sm transition hover:bg-rose-600 hover:border-rose-400"
                  title="No, cancel"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => void handleDelete()}
                  disabled={saving}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Yes, confirm"
                >
                  {saving ? (
                    <span className="w-5 h-5 animate-spin">⏳</span>
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
          , modalRoot)
          : null}

        {modalRoot && confirmSaveOpen
          ? createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-6">
            <div
              className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-700">Confirm save</p>
                <h3 className="text-xl font-semibold text-amber-900 mt-1">
                  Are you sure save with current detail?
                </h3>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setConfirmSaveOpen(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-500 text-white shadow-sm transition hover:bg-rose-600 hover:border-rose-400"
                  title="No, cancel"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => void executeSave()}
                  disabled={saving}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Yes, confirm"
                >
                  {saving ? (
                    <span className="w-5 h-5 animate-spin">⏳</span>
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
          , modalRoot)
          : null}

        {modalRoot && confirmCancelOpen
          ? createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-6">
            <div
              className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-700">Confirm cancel</p>
                <h3 className="text-xl font-semibold text-amber-900 mt-1">
                  Are you sure cancel editing template, that will cause lost edited data?
                </h3>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setConfirmCancelOpen(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-500 text-white shadow-sm transition hover:bg-rose-600 hover:border-rose-400"
                  title="No, cancel"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => cancelEdit()}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 hover:border-emerald-400"
                  title="Yes, confirm"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          , modalRoot)
          : null}
      </div>
      </div>
    </ManagerShell>
  );
}

function getEmptyDraft(): TemplateDraft {
  return { name: "", description: "", html: "" };
}

function buildDraftFromTemplate(template: ResumeTemplate): TemplateDraft {
  return {
    name: template.name ?? "",
    description: template.description ?? "",
    html: template.html ?? "",
  };
}

function normalizeDescription(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sortTemplates(items: ResumeTemplate[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt).getTime();
    return bTime - aTime;
  });
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDemoResumeData(): BaseResume {
  return {
    Profile: {
      name: "John Doe",
      headline: "Senior Software Engineer",
      contact: {
        location: "San Francisco, CA",
        email: "john.doe@example.com",
        phone: "+1 (555) 123-4567",
        linkedin: "linkedin.com/in/johndoe",
      },
    },
    summary: {
      text: "Experienced software engineer with 10+ years of expertise in full-stack development, cloud architecture, and team leadership. Proven track record of delivering scalable solutions and driving technical innovation.",
    },
    workExperience: [
      {
        companyTitle: "Tech Corp",
        roleTitle: "Senior Software Engineer",
        employmentType: "Full-time",
        location: "San Francisco, CA",
        startDate: "2020-01",
        endDate: "Present",
        bullets: [
          "Led development of microservices architecture serving 1M+ users",
          "Mentored team of 5 junior developers and improved code quality by 40%",
          "Implemented CI/CD pipelines reducing deployment time by 60%",
        ],
      },
      {
        companyTitle: "StartupXYZ",
        roleTitle: "Full Stack Developer",
        employmentType: "Full-time",
        location: "Remote",
        startDate: "2018-06",
        endDate: "2019-12",
        bullets: [
          "Built RESTful APIs and React frontend for SaaS platform",
          "Optimized database queries reducing response time by 50%",
          "Collaborated with cross-functional teams in agile environment",
        ],
      },
    ],
    education: [
      {
        institution: "University of Technology",
        degree: "Bachelor of Science",
        field: "Computer Science",
        date: "2018",
        coursework: ["Data Structures", "Algorithms", "Software Engineering"],
      },
    ],
    skills: {
      raw: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "AWS", "Docker", "Kubernetes"],
    },
  };
}

// Template rendering functions (simplified versions from profiles page)
type SafeHtml = { __html: string };

function safeHtml(value: string): SafeHtml {
  return { __html: value };
}

function isSafeHtml(value: unknown): value is SafeHtml {
  return Boolean(value && typeof value === "object" && "__html" in (value as SafeHtml));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function buildWorkExperienceHtml(items?: BaseResume["workExperience"]) {
  const list = items ?? [];
  if (!list.length) return "";
  return list
    .map((item) => {
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
      const header = escapeHtml(title || "Role");
      const datesHtml = dates ? `<div class="resume-meta">${escapeHtml(dates)}</div>` : "";
      const metaHtml = meta ? `<div class="resume-meta">${escapeHtml(meta)}</div>` : "";
      return `<div class="resume-item"><div><strong>${header}</strong></div>${datesHtml}${metaHtml}${bulletHtml}</div>`;
    })
    .join("");
}

function buildEducationHtml(items?: BaseResume["education"]) {
  const list = items ?? [];
  if (!list.length) return "";
  return list
    .map((item) => {
      const title = [item.degree, item.field].map(cleanString).filter(Boolean).join(" - ");
      const header = [item.institution, title].map(cleanString).filter(Boolean).join(" | ");
      const date = cleanString(item.date);
      const coursework = (item.coursework ?? []).map(cleanString).filter(Boolean);
      const courseworkText = coursework.length ? `Coursework: ${coursework.join(", ")}` : "";
      const dateHtml = date ? `<div class="resume-meta">${escapeHtml(date)}</div>` : "";
      const courseworkHtml = courseworkText
        ? `<div class="resume-meta">${escapeHtml(courseworkText)}</div>`
        : "";
      const label = escapeHtml(header || "Education");
      return `<div class="resume-item"><div><strong>${label}</strong></div>${dateHtml}${courseworkHtml}</div>`;
    })
    .join("");
}

function buildTemplateData(resume: BaseResume) {
  const profile = resume.Profile ?? {};
  const summary = resume.summary ?? {};
  const skills = resume.skills ?? {};
  const contact = profile.contact ?? {};
  
  return {
    // Top-level access
    profile: {
      name: profile.name || "",
      headline: profile.headline || "",
      contact: {
        location: contact.location || "",
        email: contact.email || "",
        phone: contact.phone || "",
        linkedin: contact.linkedin || "",
      },
    },
    // Also provide Profile (capital P) for compatibility
    Profile: {
      name: profile.name || "",
      headline: profile.headline || "",
      contact: {
        location: contact.location || "",
        email: contact.email || "",
        phone: contact.phone || "",
        linkedin: contact.linkedin || "",
      },
    },
    summary: summary.text || "",
    skills: (skills.raw ?? []).join(", "),
    work_experience: safeHtml(buildWorkExperienceHtml(resume.workExperience)),
    education: safeHtml(buildEducationHtml(resume.education)),
  };
}

function renderResumeTemplate(templateHtml: string, resume: BaseResume): string {
  if (!templateHtml.trim()) return "";
  const data = buildTemplateData(resume);
  return renderMustacheTemplate(templateHtml, data);
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
      return buildWorkExperienceHtml(value as BaseResume["workExperience"]);
    }
    if (path === "education") {
      return buildEducationHtml(value as BaseResume["education"]);
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
