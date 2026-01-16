'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  XCircle,
  Save,
  Send,
  Paperclip,
  Calendar,
  Clock,
  FileText,
  Download,
  FileCheck,
  Trash2,
  BarChart3,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import type { DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import TopNav from '../../components/TopNav';
import { api } from '../../lib/api';
import { getReportsLastSeen, setReportsLastSeen, triggerNotificationRefresh } from '../../lib/notifications';
import { useAuth } from '../../lib/useAuth';

type DailyReportStatus = 'draft' | 'in_review' | 'accepted' | 'rejected';

type DailyReport = {
  id: string;
  userId: string;
  reportDate: string;
  status: DailyReportStatus;
  content?: string | null;
  reviewReason?: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

type DailyReportAttachment = {
  id: string;
  reportId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
};

type UploadAttachment = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

const STATUS_CONFIG: Record<
  DailyReportStatus,
  { label: string; chip: string; eventBg: string; eventBorder: string; eventText: string }
> = {
  draft: {
    label: 'Draft',
    chip: 'border border-slate-200 bg-slate-100 text-slate-700',
    eventBg: '#e2e8f0',
    eventBorder: '#94a3b8',
    eventText: '#334155',
  },
  in_review: {
    label: 'In review',
    chip: 'border border-sky-200 bg-sky-100 text-sky-700',
    eventBg: '#bae6fd',
    eventBorder: '#38bdf8',
    eventText: '#075985',
  },
  accepted: {
    label: 'Accepted',
    chip: 'border border-emerald-200 bg-emerald-100 text-emerald-700',
    eventBg: '#bbf7d0',
    eventBorder: '#34d399',
    eventText: '#047857',
  },
  rejected: {
    label: 'Rejected',
    chip: 'border border-rose-200 bg-rose-100 text-rose-700',
    eventBg: '#fecdd3',
    eventBorder: '#fb7185',
    eventText: '#9f1239',
  },
};

type ViewMode = 'dashboard' | 'all' | 'accepted' | 'in_review' | 'rejected' | 'draft';

type ViewRange = {
  start: string;
  end: string;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : value;
}

function shiftDate(value: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, loading } = useAuth();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [viewRange, setViewRange] = useState<ViewRange | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [attachments, setAttachments] = useState<DailyReportAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace('/auth');
      return;
    }
  }, [loading, user, token, router]);

  const fetchAllReports = useCallback(async () => {
    if (!token) return;
    setReportsLoading(true);
    setReportsError('');
    try {
      // Fetch reports for the last 90 days
      const endDate = toDateKey(new Date());
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      const start = toDateKey(startDate);
      const qs = new URLSearchParams({ start, end: endDate });
      const data = await api<DailyReport[]>(`/daily-reports?${qs.toString()}`);
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load reports.';
      setReportsError(message);
    } finally {
      setReportsLoading(false);
    }
  }, [token]);

  const fetchReportsByRange = useCallback(
    async (range: ViewRange, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setReportsLoading(true);
        setReportsError('');
      }
      try {
        const qs = new URLSearchParams({ start: range.start, end: range.end });
        const data = await api<DailyReport[]>(`/daily-reports?${qs.toString()}`);
        setReports((prev) => {
          const existingMap = new Map(prev.map((r) => [r.id, r]));
          const newReports = Array.isArray(data) ? data : [];
          newReports.forEach((r) => existingMap.set(r.id, r));
          return Array.from(existingMap.values());
        });
        if (silent) {
          setReportsError('');
        }
      } catch (err) {
        if (!silent) {
          const message = err instanceof Error ? err.message : 'Unable to load reports.';
          setReportsError(message);
        }
      } finally {
        if (!silent) {
          setReportsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchAllReports();
  }, [fetchAllReports]);

  useEffect(() => {
    if (!viewRange || !token) return;
    void fetchReportsByRange(viewRange);
  }, [fetchReportsByRange, token, viewRange]);

  const dashboardStats = useMemo(() => {
    const total = reports.length;
    const draft = reports.filter((r) => r.status === 'draft').length;
    const inReview = reports.filter((r) => r.status === 'in_review').length;
    const rejected = reports.filter((r) => r.status === 'rejected').length;
    const accepted = reports.filter((r) => r.status === 'accepted').length;
    return { total, draft, inReview, rejected, accepted };
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (viewMode === 'dashboard' || viewMode === 'all') return reports;
    if (viewMode === 'accepted') return reports.filter((r) => r.status === 'accepted');
    return reports.filter((r) => r.status === viewMode);
  }, [reports, viewMode]);

  const sortedReports = useMemo(() => {
    return [...filteredReports].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  }, [filteredReports]);

  const loadAttachments = useCallback(async (reportId: string) => {
    setAttachmentsLoading(true);
    setAttachmentError('');
    try {
      const data = await api<DailyReportAttachment[]>(`/daily-reports/${reportId}/attachments`);
      setAttachments(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load attachments.';
      setAttachmentError(message);
      setAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  }, []);

  const handleViewReport = useCallback(
    async (report: DailyReport) => {
      setSelectedReport(report);
      setEditContent(report.content ?? '');
      setIsEditing(false);
      setModalOpen(true);
      await loadAttachments(report.id);
    },
    [loadAttachments],
  );

  const handleEditReport = useCallback((report: DailyReport) => {
    setSelectedReport(report);
    setEditContent(report.content ?? '');
    setIsEditing(true);
    setModalOpen(true);
    void loadAttachments(report.id);
  }, [loadAttachments]);

  const handleCreateNewReport = useCallback(async () => {
    const today = toDateKey(new Date());
    setActionError('');
    try {
      // Try to fetch existing report for today
      const existing = await api<DailyReport>(`/daily-reports/by-date?date=${today}`).catch(() => null);
      
      if (existing) {
        setSelectedReport(existing);
        setEditContent(existing.content ?? '');
        setIsEditing(true);
        setModalOpen(true);
        await loadAttachments(existing.id);
      } else {
        // Create new draft report
        setSelectedReport({
          id: '',
          userId: user?.id || '',
          reportDate: today,
          status: 'draft',
          content: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setEditContent('');
        setIsEditing(true);
        setModalOpen(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to open report.';
      setActionError(message);
    }
  }, [user, loadAttachments]);

  const handleSave = useCallback(async () => {
    if (!selectedReport || !isEditing) return;
    const isLocked = selectedReport.status === 'accepted';
    if (isLocked) return;
    
    if (!confirm('Are you sure you want to save changes to this report?')) {
      return;
    }
    
    setSaving(true);
    setActionError('');
    try {
      const updated = await api<DailyReport>('/daily-reports/by-date', {
        method: 'PUT',
        body: JSON.stringify({ date: selectedReport.reportDate, content: editContent }),
      });
      setReports((prev) => {
        const filtered = prev.filter((r) => r.id !== updated.id);
        return [...filtered, updated];
      });
      setSelectedReport(updated);
      setIsEditing(false);
      
      // Trigger notification refresh
      triggerNotificationRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save report.';
      setActionError(message);
    } finally {
      setSaving(false);
    }
  }, [selectedReport, isEditing, editContent]);

  const handleSend = useCallback(async () => {
    if (!selectedReport || !isEditing) return;
    const isLocked = selectedReport.status === 'accepted';
    if (isLocked) return;
    setSending(true);
    setActionError('');
    try {
      const updated = await api<DailyReport>('/daily-reports/by-date/send', {
        method: 'POST',
        body: JSON.stringify({ date: selectedReport.reportDate, content: editContent }),
      });
      setReports((prev) => {
        const filtered = prev.filter((r) => r.id !== updated.id);
        return [...filtered, updated];
      });
      setSelectedReport(updated);
      setIsEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send report.';
      setActionError(message);
    } finally {
      setSending(false);
    }
  }, [selectedReport, isEditing, editContent]);

  const handleDelete = useCallback(async () => {
    if (!selectedReport) return;
    const canDelete = ['draft', 'in_review', 'rejected'].includes(selectedReport.status);
    if (!canDelete) return;
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;
    setDeleting(true);
    setActionError('');
    try {
      // Note: This endpoint may need to be added to the backend
      await api(`/daily-reports/${selectedReport.id}`, {
        method: 'DELETE',
      });
      setReports((prev) => prev.filter((r) => r.id !== selectedReport.id));
      setModalOpen(false);
      setSelectedReport(null);
      
      // Trigger notification refresh
      triggerNotificationRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete report.';
      setActionError(message);
    } finally {
      setDeleting(false);
    }
  }, [selectedReport]);

  const handleAttachClick = useCallback(() => {
    if (!isEditing || !selectedReport) return;
    fileInputRef.current?.click();
  }, [isEditing, selectedReport]);

  const handleAttachmentChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !selectedReport || !isEditing) return;
      setUploadingAttachment(true);
      setAttachmentError('');
      try {
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await api<UploadAttachment>('/daily-reports/upload', {
          method: 'POST',
          body: formData,
        });
        const updated = await api<DailyReport>('/daily-reports/by-date', {
          method: 'PUT',
          body: JSON.stringify({
            date: selectedReport.reportDate,
            content: editContent,
            attachments: [uploaded],
          }),
        });
        setReports((prev) => {
          const filtered = prev.filter((r) => r.id !== updated.id);
          return [...filtered, updated];
        });
        setSelectedReport(updated);
        await loadAttachments(updated.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to upload attachment.';
        setAttachmentError(message);
      } finally {
        setUploadingAttachment(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [selectedReport, isEditing, editContent, loadAttachments],
  );

  const canEditOrDelete = useMemo(() => {
    if (!selectedReport) return false;
    return ['draft', 'in_review', 'rejected'].includes(selectedReport.status);
  }, [selectedReport]);

  const calendarEvents = useMemo(() => {
    const reportEvents = reports.map((report) => ({
      id: report.id,
      title: STATUS_CONFIG[report.status].label,
      start: report.reportDate,
      allDay: true,
      backgroundColor: STATUS_CONFIG[report.status].eventBg,
      borderColor: STATUS_CONFIG[report.status].eventBorder,
      textColor: STATUS_CONFIG[report.status].eventText,
      extendedProps: { status: report.status, kind: 'report' },
    }));
    return reportEvents;
  }, [reports]);

  const eventContent = useCallback((arg: EventContentArg) => {
    const kind = arg.event.extendedProps?.kind as string | undefined;
    if (kind !== 'report') return null;
    const status = arg.event.extendedProps?.status as DailyReportStatus | undefined;
    if (!status) return null;
    const config = STATUS_CONFIG[status];
    return (
      <div className="flex items-center gap-2 rounded-full bg-white/90 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.18em]">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: config.eventBorder }}
        />
        <span style={{ color: config.eventText }}>{config.label}</span>
      </div>
    );
  }, []);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    const start = normalizeDateKey(info.startStr);
    const endExclusive = normalizeDateKey(info.endStr);
    const end = shiftDate(endExclusive, -1);
    setViewRange({ start, end });
  }, []);

  const handleDateClick = useCallback(
    (info: DateClickArg) => {
      const date = normalizeDateKey(info.dateStr);
      const report = reports.find((r) => r.reportDate === date);
      if (report) {
        void handleViewReport(report);
      }
    },
    [reports, handleViewReport],
  );

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      if (!info.event.start) return;
      const date = toDateKey(info.event.start);
      const report = reports.find((r) => r.reportDate === date);
      if (report) {
        void handleViewReport(report);
      }
    },
    [reports, handleViewReport],
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
      <TopNav />
      <div className="mx-auto w-full min-h-screen pt-[57px]">
        <div className="grid gap-4 min-h-screen xl:grid-cols-[280px_1fr]">
          <section
            className="flex flex-col gap-2 bg-[#0b1224] text-slate-100"
            style={{ boxShadow: '0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224' }}
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Reports</p>
                  <h1 className="text-lg font-semibold text-slate-100">Daily Reports</h1>
                </div>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    viewMode === 'dashboard'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    viewMode === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>My Reports</span>
                </button>
                <div className="my-2 border-t border-slate-700"></div>
                <button
                  onClick={() => setViewMode('accepted')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    viewMode === 'accepted'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Accepted Reports</span>
                </button>
                <button
                  onClick={() => setViewMode('in_review')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    viewMode === 'in_review'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span>In Review Reports</span>
                </button>
                <button
                  onClick={() => setViewMode('rejected')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    viewMode === 'rejected'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <AlertCircle className="w-5 h-5" />
                  <span>Rejected Reports</span>
                </button>
                <button
                  onClick={() => setViewMode('draft')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    viewMode === 'draft'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>Draft Reports</span>
                </button>
              </div>
            </div>
          </section>
          <section className="flex-1 px-4 py-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
              <header className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                      Daily Reports
                    </p>
                    <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                      {viewMode === 'dashboard'
                        ? 'Dashboard'
                        : viewMode === 'all'
                          ? 'My Reports'
                          : viewMode === 'accepted'
                            ? 'Accepted Reports'
                            : viewMode === 'in_review'
                              ? 'In Review Reports'
                              : viewMode === 'rejected'
                                ? 'Rejected Reports'
                                : 'Draft Reports'}
                    </h1>
                  </div>
                </div>
                <p className="max-w-2xl text-base leading-relaxed text-slate-600">
                  {viewMode === 'dashboard'
                    ? 'Track your daily reports, review status, and submission history in one place.'
                    : viewMode === 'all'
                      ? 'View all your submitted daily reports across all statuses.'
                      : viewMode === 'accepted'
                        ? 'Reports that have been reviewed and accepted.'
                        : viewMode === 'in_review'
                          ? 'Reports currently under review by managers.'
                          : viewMode === 'rejected'
                            ? 'Reports that were rejected and need revision.'
                            : 'Draft reports that are still being edited.'}
                </p>
              </header>
              <div className="flex flex-col gap-6">

              {reportsError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {reportsError}
                </div>
              ) : null}

              {viewMode === 'dashboard' ? (
                <>
                  <section className="grid gap-5 md:grid-cols-5">
                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 px-6 py-5 shadow-sm transition-all duration-300 hover:border-amber-200 hover:shadow-md">
                      <div className="absolute right-4 top-4 opacity-10 transition-opacity group-hover:opacity-20">
                        <FileText className="h-16 w-16 text-amber-500" />
                      </div>
                      <div className="relative">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                            Total
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900">{dashboardStats.total.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 px-6 py-5 shadow-sm transition-all duration-300 hover:border-slate-200 hover:shadow-md">
                      <div className="absolute right-4 top-4 opacity-10 transition-opacity group-hover:opacity-20">
                        <FileText className="h-16 w-16 text-slate-500" />
                      </div>
                      <div className="relative">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                            Draft
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900">{dashboardStats.draft.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 px-6 py-5 shadow-sm transition-all duration-300 hover:border-blue-200 hover:shadow-md">
                      <div className="absolute right-4 top-4 opacity-10 transition-opacity group-hover:opacity-20">
                        <Clock className="h-16 w-16 text-blue-500" />
                      </div>
                      <div className="relative">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <Clock className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                            In Review
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900">{dashboardStats.inReview.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 px-6 py-5 shadow-sm transition-all duration-300 hover:border-emerald-200 hover:shadow-md">
                      <div className="absolute right-4 top-4 opacity-10 transition-opacity group-hover:opacity-20">
                        <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                      </div>
                      <div className="relative">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                            Accepted
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900">{dashboardStats.accepted.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 px-6 py-5 shadow-sm transition-all duration-300 hover:border-rose-200 hover:shadow-md">
                      <div className="absolute right-4 top-4 opacity-10 transition-opacity group-hover:opacity-20">
                        <AlertCircle className="h-16 w-16 text-rose-500" />
                      </div>
                      <div className="relative">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                            Rejected
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900">{dashboardStats.rejected.toLocaleString()}</div>
                      </div>
                    </div>
                  </section>
                  <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Calendar</p>
                        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Monthly view</h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(['draft', 'in_review', 'accepted', 'rejected'] as DailyReportStatus[]).map((status) => (
                          <span
                            key={status}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${STATUS_CONFIG[status].chip}`}
                          >
                            {STATUS_CONFIG[status].label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                      {reportsLoading ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                        </div>
                      ) : null}
                      <FullCalendar
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                        height={620}
                        showNonCurrentDates
                        fixedWeekCount={false}
                        nowIndicator
                        events={calendarEvents}
                        eventContent={eventContent}
                        dateClick={handleDateClick}
                        eventClick={handleEventClick}
                        datesSet={handleDatesSet}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-slate-200/70 bg-white shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm overflow-hidden">
                  {reportsLoading ? (
                    <div className="flex items-center justify-center p-10">
                      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                    </div>
                  ) : sortedReports.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">No reports found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                              No
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                              Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                              Status
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sortedReports.map((report, index) => (
                            <tr
                              key={report.id}
                              onClick={() => handleViewReport(report)}
                              className="hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-3 text-sm text-slate-900">{index + 1}</td>
                              <td className="px-4 py-3 text-sm text-slate-900">{formatShortDate(report.reportDate)}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${STATUS_CONFIG[report.status].chip}`}
                                >
                                  {STATUS_CONFIG[report.status].label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                  {['draft', 'in_review', 'rejected'].includes(report.status) && (
                                    <>
                                      <button
                                        onClick={() => {
                                          if (confirm('Are you sure you want to edit this report?')) {
                                            handleEditReport(report);
                                          }
                                        }}
                                        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
                                            setSelectedReport(report);
                                            setDeleting(true);
                                            try {
                                              await api(`/daily-reports/${report.id}`, {
                                                method: 'DELETE',
                                              });
                                              setReports((prev) => prev.filter((r) => r.id !== report.id));
                                              triggerNotificationRefresh();
                                            } catch (err) {
                                              const message = err instanceof Error ? err.message : 'Unable to delete report.';
                                              alert(message);
                                            } finally {
                                              setDeleting(false);
                                              setSelectedReport(null);
                                            }
                                          }
                                        }}
                                        disabled={deleting}
                                        className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
              </div>
          </section>
        </div>
      </div>

      {modalOpen && selectedReport ? (
        <>
          <div
            className="fixed inset-0 top-[57px] z-30 bg-slate-900/40"
            onClick={() => setModalOpen(false)}
          />
          <div
            className={`fixed top-[57px] right-0 z-40 h-[calc(100vh-57px)] w-full max-w-2xl transform border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ${
              modalOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex h-full flex-col overflow-y-auto">
            <section className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Report details</p>
                  <h2 className="text-lg font-semibold text-slate-900 mt-1">{formatDateLabel(selectedReport.reportDate)}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${STATUS_CONFIG[selectedReport.status].chip}`}
                  >
                    {STATUS_CONFIG[selectedReport.status].label}
                  </span>
                  {!isEditing && canEditOrDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Are you sure you want to edit this report?')) {
                          handleEditReport(selectedReport);
                        }
                      }}
                      className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                      title="Edit report"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                    title="Close"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {selectedReport.status === 'rejected' && selectedReport.reviewReason ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-rose-500">Rejection reason</div>
                  <div className="mt-2 whitespace-pre-wrap">{selectedReport.reviewReason}</div>
                </div>
              ) : null}

              <div className="mb-4">
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">
                  <FileText className="w-3.5 h-3.5" />
                  Daily report
                </label>
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Write a short update for the day..."
                    className="min-h-[200px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                ) : (
                  <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                    {selectedReport.content?.trim() || 'No report content.'}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <FileText className="w-3.5 h-3.5" />
                    Attachments
                  </div>
                  {isEditing && canEditOrDelete && (
                    <button
                      type="button"
                      onClick={handleAttachClick}
                      disabled={uploadingAttachment}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Paperclip className="w-3 h-3" />
                      {uploadingAttachment ? 'Uploading...' : 'Attach file'}
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleAttachmentChange}
                  accept="image/*,application/pdf,application/zip,text/plain,text/csv"
                  className="hidden"
                />
                {attachmentError ? (
                  <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {attachmentError}
                  </div>
                ) : null}
                <div className="mt-2 space-y-2">
                  {attachmentsLoading ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Loading attachments...
                    </div>
                  ) : attachments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      No attachments.
                    </div>
                  ) : (
                    attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="truncate flex-1">{attachment.fileName}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {(attachment.fileSize / 1024).toFixed(1)} KB
                        </span>
                        <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </a>
                    ))
                  )}
                </div>
              </div>

              {actionError ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {actionError}
                </div>
              ) : null}

              <div className="mb-4 text-xs text-slate-500">
                {selectedReport.submittedAt
                  ? `Submitted: ${new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(new Date(selectedReport.submittedAt))}`
                  : 'Not submitted'}
              </div>

              {isEditing && canEditOrDelete && (
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(selectedReport.content ?? '');
                      setActionError('');
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || sending}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving...' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={saving || sending}
                    className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sending ? 'Submitting...' : 'Submit for review'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={handleCreateNewReport}
        style={{
          borderRadius: '9999px',
          transition: 'all 0.3s ease-in-out, border-radius 0.3s ease-in-out, background-color 0.3s ease-in-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderRadius = '1rem';
          e.currentTarget.style.backgroundColor = '#f59e0b';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderRadius = '9999px';
          e.currentTarget.style.backgroundColor = '#f97316';
        }}
        className="fixed right-6 bottom-8 z-50 group flex items-center justify-center h-10 bg-[#f97316] text-white shadow-[0_10px_25px_-16px_rgba(249,115,22,0.8)] transition-all duration-300 ease-in-out hover:shadow-[0_15px_35px_-12px_rgba(249,115,22,0.6)] w-10 hover:w-40"
      >
        <span className="group-hover:opacity-0 group-hover:scale-75 transition-all duration-300 text-xl font-light">
          +
        </span>
        <span className="absolute opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 text-xs font-semibold uppercase tracking-[0.18em] whitespace-nowrap">
          Add Report
        </span>
      </button>
    </main>
  );
}
