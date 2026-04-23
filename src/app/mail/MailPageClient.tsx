'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, RefreshCw, Loader2, ArrowRight, ExternalLink, Send, X } from 'lucide-react';
import TopNav from '../../components/TopNav';
import { useAuth } from '../../lib/useAuth';
import { api } from '../../lib/api';

type Mailbox = {
  id: string;
  email: string;
  displayName?: string | null;
};

type MailMessage = {
  id: string;
  mailboxId: string;
  mailboxEmail?: string | null;
  providerMessageId: string;
  subject?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  toRecipients?: Array<{ email: string; name?: string | null }>;
  snippet?: string | null;
  webLink?: string | null;
  receivedAt?: string | null;
  isRead?: boolean | null;
  bodyContent?: string | null;
  bodyContentType?: string | null;
};

const PAGE_SIZE = 30;

export default function MailPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('all');
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  // Inbox-only view
  const folder = 'inbox';
  const [locallyReadIds, setLocallyReadIds] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeFrom, setComposeFrom] = useState<string | null>(null);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  const localReadSet = useMemo(() => new Set(locallyReadIds), [locallyReadIds]);
  const unreadCount = useMemo(() => messages.filter((m) => !m.isRead).length, [messages]);
  const totalCount = messages.length;
  const mailboxCount = mailboxes.length || 0;

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace('/auth');
    }
  }, [loading, user, token, router]);

  const loadMessages = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      if (!token) return;
      setLoadingList(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        if (selectedMailbox !== 'all') {
          params.set('mailboxes', selectedMailbox);
        }
        params.set('folder', 'inbox');
        if (search.trim()) {
          params.set('search', search.trim());
        }
        if (!opts.reset && cursor) {
          params.set('cursor', cursor);
        }
        const data = await api<{
          mailboxes?: Mailbox[];
          messages: MailMessage[];
          nextCursor?: string | null;
        }>(`/mail/messages?${params.toString()}`, undefined, token);
        setMailboxes(data.mailboxes ?? []);
        setCursor(data.nextCursor ?? null);
        const normalized = data.messages.map((msg) =>
          localReadSet.has(msg.id) ? { ...msg, isRead: true } : msg,
        );
        setMessages((prev) => (opts.reset ? normalized : [...prev, ...normalized]));
        if (!selectedMessageId && data.messages.length) {
          setSelectedMessageId(data.messages[0].id);
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load mail.');
      } finally {
        setLoadingList(false);
      }
    },
    [token, selectedMailbox, search, cursor, selectedMessageId, localReadSet],
  );

  useEffect(() => {
    void loadMessages({ reset: true });
  }, [selectedMailbox, search, loadMessages]);

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    try {
      await api('/mail/sync', { method: 'POST' }, token);
      setCursor(null);
      await loadMessages({ reset: true });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to refresh mail.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSend = async () => {
    if (!token) return;
    const recipients = composeTo
      .split(/[,;\n]+/)
      .map((email) => email.trim())
      .filter(Boolean);
    if (!recipients.length) {
      setError('Add at least one recipient.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api(
        '/mail/send',
        {
          method: 'POST',
          body: JSON.stringify({
            to: recipients,
            subject: composeSubject,
            body: composeBody,
            bodyContentType: 'HTML',
            mailboxId: composeFrom || undefined,
          }),
        },
        token,
      );
      setComposerOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setCursor(null);
      await loadMessages({ reset: true });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to send mail.');
    } finally {
      setSending(false);
    }
  };

  const handleLoadMore = async () => {
    if (!cursor) return;
    await loadMessages();
  };

  const selectedMessage = useMemo(() => {
    if (!selectedMessageId && messages.length) {
      return messages[0];
    }
    return messages.find((msg) => msg.id === selectedMessageId) ?? null;
  }, [messages, selectedMessageId]);

  const markAsRead = useCallback((id: string) => {
    setLocallyReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, isRead: true } : msg)),
    );
  }, []);

  const mailboxLabel = (mailboxId: string) => {
    if (mailboxId === 'all') return 'All mailboxes';
    const mailbox = mailboxes.find((mb) => mb.id === mailboxId);
    return mailbox?.displayName || mailbox?.email || mailboxId;
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
      <TopNav />
      <div className="mx-auto w-full min-h-screen pt-[57px]">
        <div className="grid w-full gap-4 pb-10 min-h-[calc(100vh-57px)] xl:grid-cols-[280px_1fr]">
          <aside
            className="flex flex-col h-[calc(100vh-57px)] bg-[#0b1224] text-slate-100"
            style={{ boxShadow: '0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224' }}
          >
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-slate-700/50 flex-shrink-0">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Mail</p>
                    <h1 className="text-lg font-semibold text-slate-100">Mailboxes</h1>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {refreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMailbox('all');
                      setCursor(null);
                      setMessages([]);
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      selectedMailbox === 'all'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span className="flex-1 text-left">All mail</span>
                    {selectedMailbox === 'all' ? <ArrowRight className="h-4 w-4" /> : null}
                  </button>

                  {mailboxes.map((mailbox) => {
                    const active = selectedMailbox === mailbox.id;
                    return (
                      <button
                        key={mailbox.id}
                        type="button"
                        onClick={() => {
                          setSelectedMailbox(mailbox.id);
                          setCursor(null);
                          setMessages([]);
                        }}
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          active
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-semibold text-slate-100">
                            {mailbox.displayName || mailbox.email}
                          </span>
                          <span className="text-xs text-slate-400">{mailbox.email}</span>
                        </div>
                        {active ? <ArrowRight className="h-4 w-4" /> : null}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Search</p>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCursor(null);
                      setMessages([]);
                    }}
                    placeholder="Subject, sender, snippet..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-transparent focus:ring-indigo-500"
                  />
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-200">
                  Background sync runs every 15–30 minutes. Refresh triggers an immediate sync.
                </div>
              </div>
            </div>
          </aside>

          <section className="flex-1 py-6 min-w-0">
            <div className="mx-auto flex w-full max-w-none flex-col gap-6">
              <header className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white px-4 py-4 shadow-[0_16px_45px_-28px_rgba(15,23,42,0.45)] sm:px-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-[0_14px_36px_-18px_rgba(99,102,241,0.9)]">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-indigo-600">
                        Mail Center
                      </p>
                      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        {mailboxLabel(selectedMailbox)}
                      </h1>
                      <p className="mt-1 text-sm text-slate-600">
                        View and reply to messages from your connected accounts. Sync often to keep things fresh.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCursor(null);
                        void loadMessages({ reset: true });
                      }}
                      disabled={loadingList}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
                      <span>Reload</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-18px_rgba(99,102,241,0.8)] transition hover:brightness-110"
                    >
                      <Send className="h-4 w-4" />
                      <span>New email</span>
                    </button>
                  </div>
                </div>
              </header>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-800">Messages</h3>
                    {loadingList ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    ) : null}
                  </div>
                  <div className="max-h-[70vh] min-h-[420px] overflow-auto divide-y divide-slate-100">
                    {messages.length === 0 && !loadingList ? (
                      <div className="px-4 py-6 text-sm text-slate-500">No messages yet.</div>
                    ) : (
                      messages.map((msg) => {
                        const active = msg.id === selectedMessageId;
                        return (
                          <button
                            key={msg.id}
                            type="button"
                            onClick={() => {
                              setSelectedMessageId(msg.id);
                              markAsRead(msg.id);
                            }}
                            className={`block w-full text-left px-4 py-3 transition ${
                              active ? 'bg-indigo-50' : msg.isRead ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                                {!msg.isRead ? <span className="h-2 w-2 rounded-full bg-indigo-500" /> : null}
                                {msg.mailboxEmail || 'Mailbox'}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatDate(msg.receivedAt)}
                              </div>
                            </div>
                            <div className={`mt-1 line-clamp-1 text-sm ${msg.isRead ? 'font-medium text-slate-800' : 'font-semibold text-slate-900'}`}>
                              {msg.subject || '(No subject)'}
                            </div>
                            <div className={`mt-0.5 text-xs ${msg.isRead ? 'text-slate-600' : 'text-slate-700'}`}>
                              {msg.fromName || msg.fromEmail || 'Unknown sender'}
                            </div>
                            {msg.snippet ? (
                              <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                                {msg.snippet}
                              </div>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {cursor ? (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingList}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {loadingList ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
                  {!selectedMessage ? (
                    <div className="h-full min-h-[320px] rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                      Select a message to view details.
                    </div>
                  ) : (
                    <div className="space-y-4 overflow-auto pr-1 lg:max-h-[75vh]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {selectedMessage.mailboxEmail || 'Mailbox'}
                          </p>
                          <h2 className="mt-1 text-2xl font-bold text-slate-900">
                            {selectedMessage.subject || '(No subject)'}
                          </h2>
                          <p className="mt-1 text-sm text-slate-600">
                            From: {selectedMessage.fromName || selectedMessage.fromEmail || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Received {formatDate(selectedMessage.receivedAt, true)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setComposerOpen(true)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                        >
                          <Send className="h-4 w-4" />
                          Reply
                        </button>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-800 whitespace-pre-wrap break-words break-all overflow-x-auto">
                        {selectedMessage.bodyContent
                          ? toPlainText(selectedMessage.bodyContent, selectedMessage.bodyContentType)
                          : selectedMessage.snippet || 'No content available.'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {composerOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white">
                  <Send className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-600">Compose</p>
                  <h2 className="text-lg font-semibold text-slate-900">New email</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(false);
                  setSending(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="flex gap-3">
                <div className="w-1/2">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">From</label>
                  <select
                    value={composeFrom || ''}
                    onChange={(e) => setComposeFrom(e.target.value || null)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-indigo-200"
                  >
                    {mailboxes.length === 0 ? <option value="">No mailboxes</option> : null}
                    {mailboxes.map((mb) => (
                      <option key={mb.id} value={mb.id}>
                        {mb.displayName || mb.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-1/2">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">To</label>
                  <input
                    type="text"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="name@example.com, other@example.com"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-indigo-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Subject</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Message</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={8}
                  placeholder="Write your message..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-indigo-200"
                />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500">Emails send from your connected account.</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-18px_rgba(99,102,241,0.8)] transition hover:brightness-110 disabled:opacity-60"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatDate(value?: string | null, showTime?: boolean) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(showTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  });
}

function toPlainText(content?: string | null, type?: string | null) {
  if (!content) return '';
  if (type?.toLowerCase() !== 'html') return content;
  if (typeof window === 'undefined') {
    return content.replace(/<[^>]+>/g, ' ');
  }
  const div = document.createElement('div');
  div.innerHTML = content;
  return div.textContent || div.innerText || '';
}
