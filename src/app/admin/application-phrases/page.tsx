'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Check, X, Type } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/useAuth';

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

const APPLICATION_SUCCESS_KEY = 'application_success';

export default function ApplicationPhrasesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [phrases, setPhrases] = useState<LabelAlias[]>([]);
  const [newPhrase, setNewPhrase] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhrase, setEditPhrase] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace('/auth');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.replace('/workspace');
      return;
    }
    void loadPhrases(token);
  }, [loading, user, token, router]);

  const sortedPhrases = useMemo(
    () => [...phrases].sort((a, b) => a.alias.localeCompare(b.alias)),
    [phrases],
  );

  async function loadPhrases(authToken: string) {
    try {
      const data = await api<AliasResponse>('/label-aliases', undefined, authToken);
      const next = (data.custom || []).filter(
        (item) => item.canonicalKey === APPLICATION_SUCCESS_KEY,
      );
      setPhrases(next);
    } catch (err) {
      console.error(err);
      setError('Failed to load application phrases.');
    }
  }

  async function addPhrase() {
    if (!token) return;
    const phrase = newPhrase.trim();
    if (!phrase) {
      setError('Enter a phrase to add.');
      return;
    }
    setSavingId('new');
    setError('');
    try {
      await api(
        '/label-aliases',
        { method: 'POST', body: JSON.stringify({ canonicalKey: APPLICATION_SUCCESS_KEY, alias: phrase }) },
        token,
      );
      setNewPhrase('');
      await loadPhrases(token);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to add phrase.');
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(phrase: LabelAlias) {
    setEditingId(phrase.id);
    setEditPhrase(phrase.alias);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPhrase('');
  }

  async function saveEdit(id: string) {
    if (!token) return;
    const phrase = editPhrase.trim();
    if (!phrase) {
      setError('Phrase cannot be empty.');
      return;
    }
    setSavingId(id);
    setError('');
    try {
      await api(
        `/label-aliases/${id}`,
        { method: 'PATCH', body: JSON.stringify({ canonicalKey: APPLICATION_SUCCESS_KEY, alias: phrase }) },
        token,
      );
      cancelEdit();
      await loadPhrases(token);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to save phrase.');
    } finally {
      setSavingId(null);
    }
  }

  async function removePhrase(id: string) {
    if (!token) return;
    setSavingId(id);
    setError('');
    try {
      await api(`/label-aliases/${id}`, { method: 'DELETE' }, token);
      if (editingId === id) cancelEdit();
      await loadPhrases(token);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to delete phrase.');
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
              <Type className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
                Admin
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                Application phrases
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Manage the phrases used to confirm an application was submitted.
          </p>
        </header>
      <div className="space-y-6">

        {error ? (
          <div className="rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Phrases</h2>
              <p className="text-xs text-slate-500">{sortedPhrases.length} total</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={newPhrase}
                onChange={(e) => setNewPhrase(e.target.value)}
                placeholder="Add phrase"
                className="w-60 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-slate-300"
              />
              <button
                onClick={addPhrase}
                disabled={savingId === 'new'}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
                aria-label="Add phrase"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {sortedPhrases.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600">No phrases yet. Add one to get started.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedPhrases.map((phrase) => {
                const isEditing = editingId === phrase.id;
                return (
                  <div key={phrase.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {isEditing ? (
                      <>
                        <input
                          value={editPhrase}
                          onChange={(e) => setEditPhrase(e.target.value)}
                          className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-slate-300"
                        />
                        <button
                          onClick={() => saveEdit(phrase.id)}
                          disabled={savingId === phrase.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
                          aria-label="Save changes"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                          aria-label="Cancel editing"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-1 items-center gap-2">
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                            Phrase
                          </span>
                          <span className="text-sm text-slate-800">{phrase.alias}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(phrase)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                            aria-label="Edit phrase"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removePhrase(phrase.id)}
                            disabled={savingId === phrase.id}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-60"
                            aria-label="Delete phrase"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      </div>
    </AdminShell>
  );
}
