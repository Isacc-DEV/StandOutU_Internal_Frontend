'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, XCircle, Plus, Trash2, Tags } from "lucide-react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import AdminShell from "../../../components/AdminShell";

type LabelAlias = {
  id: string;
  canonicalKey: string;
  alias: string;
  normalizedAlias: string;
};

type AliasResponse = {
  defaults: Record<string, string[]>;
  custom: LabelAlias[];
};

type TagRow = {
  alias: string;
  isDefault: boolean;
  id?: string;
};

const APPLICATION_SUCCESS_KEY = "application_success";

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export default function LabelAliasesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [defaults, setDefaults] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState<LabelAlias[]>([]);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newAliasLeft, setNewAliasLeft] = useState("");
  const [newAliasRight, setNewAliasRight] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlias, setEditAlias] = useState("");
  const [editKey, setEditKey] = useState("");
  const rightInputRef = useRef<HTMLInputElement | null>(null);

  const loadAliases = useCallback(async (authToken: string) => {
    try {
      const data = await api<AliasResponse>("/label-aliases", undefined, authToken);
      const nextDefaults = data.defaults || {};
      const nextCustom = data.custom || [];
      setDefaults(nextDefaults);
      setCustom(nextCustom);
      setSelectedKey((current) => {
        if (current) return current;
        const allKeys = new Set<string>([
          ...Object.keys(nextDefaults),
          ...nextCustom.map((c) => c.canonicalKey),
        ]);
        return Array.from(allKeys)[0] || "";
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load label tags.");
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace("/auth");
      return;
    }
    if (user.role !== "ADMIN") {
      router.replace("/workspace");
      return;
    }
    void loadAliases(token);
  }, [loading, user, token, router, loadAliases]);

  const canonicalKeys = useMemo(() => {
    const set = new Set<string>();
    Object.keys(defaults || {}).forEach((k) => set.add(k));
    custom.forEach((c) => set.add(c.canonicalKey));
    return Array.from(set)
      .filter((key) => key !== APPLICATION_SUCCESS_KEY)
      .sort();
  }, [defaults, custom]);

  const tagsForSelected: TagRow[] = useMemo(() => {
    if (!selectedKey) return [];
    const builtin = defaults[selectedKey] ?? [];
    const customTags = custom.filter((c) => c.canonicalKey === selectedKey);
    return [
      ...builtin.map((alias) => ({ alias, isDefault: true })),
      ...customTags.map((c) => ({ alias: c.alias, id: c.id, isDefault: false })),
    ];
  }, [defaults, custom, selectedKey]);

  async function addAlias(targetKey: string, value: string) {
    if (!token) return;
    if (!value.trim() || !targetKey.trim()) {
      setError("Pick a label and enter a tag.");
      return;
    }
    setSavingId(`new-${targetKey}`);
    setError("");
    try {
      await api("/label-aliases", { method: "POST", body: JSON.stringify({ canonicalKey: targetKey, alias: value }) }, token);
      setNewAliasLeft("");
      setNewAliasRight("");
      await loadAliases(token!);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, "Unable to add tag."));
    } finally {
      setSavingId(null);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAlias("");
    setEditKey("");
  }

  async function saveEdit(id: string) {
    if (!token) return;
    setSavingId(id);
    setError("");
    try {
      await api(`/label-aliases/${id}`, { method: "PATCH", body: JSON.stringify({ canonicalKey: editKey, alias: editAlias }) }, token);
      cancelEdit();
      await loadAliases(token);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, "Unable to save tag."));
    } finally {
      setSavingId(null);
    }
  }

  async function removeAlias(id: string) {
    if (!token) return;
    setSavingId(id);
    setError("");
    try {
      await api(`/label-aliases/${id}`, { method: "DELETE" }, token);
      if (editingId === id) cancelEdit();
      await loadAliases(token);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, "Unable to delete tag."));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
              <Tags className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
                Admin
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                Label tags
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Choose a label on the left and manage its tags on the right. Built-ins stay read-only; add or edit tags used for autofill.
          </p>
        </header>
      <div className="space-y-6">

        {error && (
          <div className="rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <section className="w-[30%] rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Labels</h2>
                <p className="text-xs text-slate-500">Select a label to view its tags.</p>
              </div>
              <button
                onClick={() => {
                  setTimeout(() => rightInputRef.current?.focus(), 10);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label="Add tag"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {canonicalKeys.map((key) => {
                const totalTags = (defaults[key]?.length ?? 0) + custom.filter((c) => c.canonicalKey === key).length;
                const active = key === selectedKey;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                      active ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{key}</span>
                      <span className="text-xs text-slate-500">{totalTags} tags</span>
                    </div>
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                      {totalTags}
                    </span>
                  </button>
                );
              })}
              {canonicalKeys.length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-600">No labels available.</div>
              )}
            </div>
            {selectedKey && (
              <div className="border-t border-slate-200 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Quick add</div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newAliasLeft}
                    onChange={(e) => setNewAliasLeft(e.target.value)}
                    placeholder="Add tag to selected"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                  <button
                    onClick={() => addAlias(selectedKey, newAliasLeft)}
                    disabled={savingId?.startsWith("new-")}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
                    aria-label="Add tag"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="w-[70%] rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedKey || "Select a label"}
                </h2>
                <p className="text-sm text-slate-600">View and edit tags for this label.</p>
              </div>
              {selectedKey && (
                <div className="flex gap-2">
                  <input
                    ref={rightInputRef}
                    value={newAliasRight}
                    onChange={(e) => setNewAliasRight(e.target.value)}
                    placeholder="Add tag"
                    className="w-52 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                  <button
                    onClick={() => addAlias(selectedKey, newAliasRight)}
                    disabled={savingId?.startsWith("new-")}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
                    aria-label="Add tag"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {!selectedKey ? (
              <div className="px-4 py-6 text-sm text-slate-600">Select a label to see its tags.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tagsForSelected.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-600">No tags yet. Add one to get started.</div>
                ) : (
                  tagsForSelected.map((tag) => {
                    if (tag.isDefault) {
                      return (
                        <div key={`builtin-${tag.alias}`} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">Built-in</span>
                            <span className="text-sm text-slate-800">{tag.alias}</span>
                          </div>
                          <span className="text-xs text-slate-400">Locked</span>
                        </div>
                      );
                    }
                    const isEditing = tag.id ? editingId === tag.id : false;
                    return (
                      <div key={tag.id ?? `custom-${tag.alias}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        {isEditing ? (
                          <>
                            <input
                              value={editAlias}
                              onChange={(e) => setEditAlias(e.target.value)}
                              className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-slate-300"
                            />
                            <button
                              onClick={() => tag.id && saveEdit(tag.id)}
                              disabled={savingId === tag.id}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
                              aria-label="Save changes"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                              aria-label="Cancel editing"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-1 items-center gap-2">
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Custom</span>
                              <span className="text-sm text-slate-800">{tag.alias}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditAlias(tag.alias);
                                  setEditKey(selectedKey);
                                  setEditingId(tag.id ?? null);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                                aria-label="Edit tag"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => tag.id && removeAlias(tag.id)}
                                disabled={savingId === tag.id}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-60"
                                aria-label="Delete tag"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      </div>
    </AdminShell>
  );
}
