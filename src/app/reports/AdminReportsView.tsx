'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, XCircle, CheckCircle, X, FileText, Download, Users, Clock, Eye, CalendarDays, BarChart3, AlertCircle, CheckCircle2 } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import type {
  DatesSetArg,
  EventClickArg,
  DayCellContentArg
} from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import { api } from '../../lib/api';
import type { ClientUser } from '../../lib/auth';
import { setReportsLastSeen } from '../../lib/notifications';
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

type DailyReportWithUser = DailyReport & {
  userName: string;
  userEmail: string;
  userAvatarUrl?: string | null;
  userRole?: string;
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

type InReviewReport = {
  id: string;
  userId: string;
  reportDate: string;
  updatedAt: string;
};

type ViewRange = {
  start: string;
  end: string;
};

type ViewMode = 'dashboard' | 'all' | 'in_review';
type DisplayMode = 'day' | 'user';

type CountByDate = {
  reportDate: string;
  count: number;
};

function NotificationBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm ${className || ''}`}
    >
      {String(count)}
    </span>
  );
}

const STATUS_CONFIG: Record<
  DailyReportStatus,
  { label: string; chip: string; border: string }
> = {
  draft: {
    label: 'Draft',
    chip: 'border border-slate-200 bg-slate-100 text-slate-700',
    border: '#94a3b8',
  },
  in_review: {
    label: 'In review',
    chip: 'border border-sky-200 bg-sky-100 text-sky-700',
    border: '#38bdf8',
  },
  accepted: {
    label: 'Accepted',
    chip: 'border border-emerald-200 bg-emerald-100 text-emerald-700',
    border: '#34d399',
  },
  rejected: {
    label: 'Rejected',
    chip: 'border border-rose-200 bg-rose-100 text-rose-700',
    border: '#fb7185',
  },
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

function startOfWeek(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  const day = parsed.getDay();
  const diff = (day + 6) % 7;
  parsed.setDate(parsed.getDate() - diff);
  return toDateKey(parsed);
}

function formatDateLabel(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', options ?? {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatWeekRangeLabel(start: string) {
  const end = shiftDate(start, 6);
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} - ${end}`;
  }
  const startLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(startDate);
  const endLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(endDate);
  return `${startLabel} - ${endLabel}`;
}

function parseTimestamp(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function initialsFor(name?: string | null) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
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

export default function AdminReportsView({ token }: { token: string | null }) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [calendarRange, setCalendarRange] = useState<ViewRange | null>(null);
  const [dateReports, setDateReports] = useState<DailyReportWithUser[]>([]);
  const [dateLoading, setDateLoading] = useState(false);
  const [dateError, setDateError] = useState('');
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(toDateKey(new Date())));
  const [userReports, setUserReports] = useState<DailyReport[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');
  const [inReviewReports, setInReviewReports] = useState<InReviewReport[]>([]);
  const [inReviewReportsWithUser, setInReviewReportsWithUser] = useState<DailyReportWithUser[]>([]);
  const [inReviewLoading, setInReviewLoading] = useState(false);
  const [inReviewError, setInReviewError] = useState('');
  const [selectedUserIdFilter, setSelectedUserIdFilter] = useState<string | null>(null);
  const [dateSortOrder, setDateSortOrder] = useState<'asc' | 'desc'>('desc');
  const [acceptedByDate, setAcceptedByDate] = useState<Map<string, number>>(new Map());
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [selectedReportForDetail, setSelectedReportForDetail] = useState<DailyReportWithUser | null>(null);
  const [modalAttachments, setModalAttachments] = useState<DailyReportAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectError, setRejectError] = useState('');

  const selectedUser = useMemo(
    () => users.find((entry) => entry.id === selectedUserId),
    [users, selectedUserId],
  );


  const visibleDateReports = useMemo(
    () => dateReports.filter((report) => report.status !== 'draft'),
    [dateReports],
  );

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => shiftDate(weekStart, idx));
  }, [weekStart]);

  const weekReportMap = useMemo(() => {
    const map = new Map<string, DailyReport>();
    userReports
      .filter((report) => report.status !== 'draft')
      .forEach((report) => {
        map.set(report.reportDate, report);
      });
    return map;
  }, [userReports]);

  const inReviewByDate = useMemo(() => {
    const map = new Map<string, number>();
    inReviewReports.forEach((report) => {
      map.set(report.reportDate, (map.get(report.reportDate) ?? 0) + 1);
    });
    return map;
  }, [inReviewReports]);

  const inReviewByUser = useMemo(() => {
    const map = new Map<string, number>();
    inReviewReports.forEach((report) => {
      map.set(report.userId, (map.get(report.userId) ?? 0) + 1);
    });
    return map;
  }, [inReviewReports]);

  const selectedDateLabel = useMemo(() => {
    return formatDateLabel(selectedDate, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDate]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const list = await api<ClientUser[]>('/users');
      const filtered = Array.isArray(list) ? list : [];
      setUsers(filtered);
      setSelectedUserId((prev) => prev || filtered[0]?.id || '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load users.';
      setUsersError(message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchReportsByDate = useCallback(async (date: string) => {
    setDateLoading(true);
    setDateError('');
    try {
      const data = await api<DailyReportWithUser[]>(
        `/admin/daily-reports/by-date?date=${encodeURIComponent(date)}`,
      );
      setDateReports(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load reports.';
      setDateError(message);
    } finally {
      setDateLoading(false);
    }
  }, []);

  const fetchReportsByUser = useCallback(
    async (userId: string, start: string) => {
      setUserLoading(true);
      setUserError('');
      try {
        const end = shiftDate(start, 6);
        const params = new URLSearchParams({ userId, start, end });
        const data = await api<DailyReport[]>(`/admin/daily-reports/by-user?${params.toString()}`);
        setUserReports(Array.isArray(data) ? data : []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load reports.';
        setUserError(message);
      } finally {
        setUserLoading(false);
      }
    },
    [],
  );

  const fetchInReviewReports = useCallback(async (range: ViewRange) => {
    try {
      const params = new URLSearchParams({ start: range.start, end: range.end });
      const data = await api<InReviewReport[]>(
        `/admin/daily-reports/in-review?${params.toString()}`,
      );
      setInReviewReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setInReviewReports([]);
    }
  }, []);

  const fetchAcceptedByDate = useCallback(async (range: ViewRange) => {
    try {
      const params = new URLSearchParams({ start: range.start, end: range.end });
      const data = await api<CountByDate[]>(
        `/admin/daily-reports/accepted-by-date?${params.toString()}`,
      );
      const map = new Map<string, number>();
      (Array.isArray(data) ? data : []).forEach((entry) => {
        if (!entry?.reportDate) return;
        const count = typeof entry.count === 'number' ? entry.count : 0;
        if (count > 0) {
          map.set(entry.reportDate, count);
        }
      });
      setAcceptedByDate(map);
    } catch (err) {
      console.error(err);
      setAcceptedByDate(new Map());
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchUsers();
  }, [token, fetchUsers]);

  // Initialize calendar range on mount or when switching to views that need it
  useEffect(() => {
    if (calendarRange) return;
    if (viewMode !== 'dashboard' && viewMode !== 'in_review' && !(viewMode === 'all' && displayMode === 'day')) return;
    const today = toDateKey(new Date());
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    setCalendarRange({ start: toDateKey(start), end: toDateKey(end) });
  }, [calendarRange, viewMode, displayMode]);

  const fetchInReviewReportsWithUser = useCallback(async (range: ViewRange) => {
    setInReviewLoading(true);
    setInReviewError('');
    try {
      const params = new URLSearchParams({ start: range.start, end: range.end });
      const inReviewData = await api<InReviewReport[]>(
        `/admin/daily-reports/in-review?${params.toString()}`,
      );
      const inReviewList = Array.isArray(inReviewData) ? inReviewData : [];
      setInReviewReports(inReviewList);
      
      // Fetch full report details - group by date to minimize API calls
      const dateMap = new Map<string, InReviewReport[]>();
      inReviewList.forEach((report) => {
        const existing = dateMap.get(report.reportDate) || [];
        dateMap.set(report.reportDate, [...existing, report]);
      });
      
      const reportsWithUser: DailyReportWithUser[] = [];
      const datePromises = Array.from(dateMap.entries()).map(async ([date, reports]) => {
        try {
          const dateReports = await api<DailyReportWithUser[]>(
            `/admin/daily-reports/by-date?date=${encodeURIComponent(date)}`,
          );
          const dateReportsList = Array.isArray(dateReports) ? dateReports : [];
          reports.forEach((inReview) => {
            const report = dateReportsList.find((r) => r.id === inReview.id && r.status === 'in_review');
            if (report) {
              reportsWithUser.push(report);
            }
          });
        } catch (err) {
          console.error(`Failed to fetch reports for date ${date}:`, err);
        }
      });
      
      await Promise.all(datePromises);
      setInReviewReportsWithUser(reportsWithUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load in-review reports.';
      setInReviewError(message);
      setInReviewReportsWithUser([]);
      setInReviewReports([]);
    } finally {
      setInReviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    if (viewMode !== 'all' && viewMode !== 'dashboard') return;
    if (displayMode !== 'day' && viewMode !== 'dashboard') return;
    void fetchReportsByDate(selectedDate);
  }, [token, viewMode, displayMode, selectedDate, fetchReportsByDate]);

  useEffect(() => {
    if (!token) return;
    if (viewMode !== 'all' && viewMode !== 'dashboard') return;
    if (displayMode !== 'day' && viewMode !== 'dashboard') return;
    if (!calendarRange) return;
    void fetchAcceptedByDate(calendarRange);
  }, [token, viewMode, displayMode, calendarRange, fetchAcceptedByDate]);

  useEffect(() => {
    if (!token) return;
    if (viewMode !== 'all') return;
    if (displayMode !== 'user') return;
    if (!selectedUserId) return;
    void fetchReportsByUser(selectedUserId, weekStart);
  }, [token, viewMode, displayMode, selectedUserId, weekStart, fetchReportsByUser]);

  useEffect(() => {
    if (!token) return;
    if (viewMode !== 'in_review') return;
    if (!calendarRange) return;
    void fetchInReviewReportsWithUser(calendarRange);
  }, [token, viewMode, calendarRange, fetchInReviewReportsWithUser]);

  const inReviewRange = useMemo(() => {
    if (viewMode === 'dashboard' || (viewMode === 'all' && displayMode === 'day')) return calendarRange;
    if (viewMode === 'all' && displayMode === 'user') {
      return { start: weekStart, end: shiftDate(weekStart, 6) };
    }
    if (viewMode === 'in_review') return calendarRange;
    return null;
  }, [viewMode, displayMode, calendarRange, weekStart]);

  useEffect(() => {
    if (!token || !inReviewRange) return;
    let active = true;
    const refresh = () => {
      if (!active) return;
      void fetchInReviewReports(inReviewRange);
    };
    refresh();
    const intervalId = window.setInterval(refresh, 30000);
    const handleFocus = () => {
      refresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, inReviewRange?.start, inReviewRange?.end, fetchInReviewReports]);

  useEffect(() => {
    if (!token) return;
    if (viewMode !== 'all' && viewMode !== 'dashboard') return;
    if (displayMode !== 'day' && viewMode !== 'dashboard') return;
    if (!selectedDate) return;
    if (inReviewReports.length === 0) return;
    const relevant = inReviewReports.filter((report) => report.reportDate === selectedDate);
    if (relevant.length === 0) return;
    const existingMap = new Map(dateReports.map((report) => [report.id, report.updatedAt]));
    const needsRefresh = relevant.some((report) => {
      const existingUpdatedAt = existingMap.get(report.id);
      if (!existingUpdatedAt) return true;
      const existingTime = parseTimestamp(existingUpdatedAt);
      const latestTime = parseTimestamp(report.updatedAt);
      if (existingTime === null || latestTime === null) return true;
      return latestTime > existingTime;
    });
    if (needsRefresh) {
      void fetchReportsByDate(selectedDate);
    }
  }, [
    token,
    viewMode,
    displayMode,
    selectedDate,
    inReviewReports,
    dateReports,
    fetchReportsByDate,
  ]);

  useEffect(() => {
    if (!token) return;
    if (viewMode !== 'all') return;
    if (displayMode !== 'user') return;
    if (!selectedUserId) return;
    if (inReviewReports.length === 0) return;
    const relevant = inReviewReports.filter((report) => report.userId === selectedUserId);
    if (relevant.length === 0) return;
    const existingMap = new Map(userReports.map((report) => [report.id, report.updatedAt]));
    const needsRefresh = relevant.some((report) => {
      const existingUpdatedAt = existingMap.get(report.id);
      if (!existingUpdatedAt) return true;
      const existingTime = parseTimestamp(existingUpdatedAt);
      const latestTime = parseTimestamp(report.updatedAt);
      if (existingTime === null || latestTime === null) return true;
      return latestTime > existingTime;
    });
    if (needsRefresh) {
      void fetchReportsByUser(selectedUserId, weekStart);
    }
  }, [
    token,
    viewMode,
    displayMode,
    selectedUserId,
    weekStart,
    inReviewReports,
    userReports,
    fetchReportsByUser,
  ]);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    const start = normalizeDateKey(info.startStr);
    const endExclusive = normalizeDateKey(info.endStr);
    const end = shiftDate(endExclusive, -1);
    setCalendarRange({ start, end });
    if (!selectedDate || selectedDate < start || selectedDate > end) {
      setSelectedDate(start);
    }
  }, [selectedDate]);

  const handleDateClick = useCallback((info: DateClickArg) => {
    setSelectedDate(normalizeDateKey(info.dateStr));
  }, []);

  const handleEventClick = useCallback((info: EventClickArg) => {
    if (!info.event.start) return;
    setSelectedDate(toDateKey(info.event.start));
  }, []);

  const openDetailPanel = useCallback(
    (report: DailyReport | DailyReportWithUser, withUser?: ClientUser | null) => {
      const next: DailyReportWithUser = {
        ...report,
        userName: withUser?.userName ?? (report as DailyReportWithUser).userName ?? 'Unknown',
        userEmail: withUser?.email ?? (report as DailyReportWithUser).userEmail ?? '',
        userRole: withUser?.role ?? (report as DailyReportWithUser).userRole,
        userAvatarUrl: withUser?.avatarUrl ?? (report as DailyReportWithUser).userAvatarUrl,
      };
      setSelectedReportForDetail(next);
      setModalAttachments([]);
      setReviewError('');
      setAttachmentsError('');
      setRejectReason('');
      setRejectModalOpen(false);
      setRejectError('');
      setDetailPanelOpen(true);
      
      // Mark report as seen when viewing (for in_review reports)
      if (user && report.status === 'in_review') {
        setReportsLastSeen(user.id, user.role);
      }
    },
    [user],
  );

  const closeDetailPanel = useCallback(() => {
    setDetailPanelOpen(false);
    setSelectedReportForDetail(null);
    setModalAttachments([]);
    setAttachmentsError('');
    setReviewError('');
    setRejectReason('');
    setRejectModalOpen(false);
    setRejectError('');
  }, []);

  const applyUpdatedReport = useCallback((updated: DailyReport) => {
    setDateReports((prev) =>
      prev.map((report) => (report.id === updated.id ? { ...report, ...updated } : report)),
    );
    setUserReports((prev) =>
      prev.map((report) => (report.id === updated.id ? { ...report, ...updated } : report)),
    );
    setInReviewReportsWithUser((prev) => {
      if (updated.status !== 'in_review') {
        return prev.filter((report) => report.id !== updated.id);
      }
      const existing = prev.find((r) => r.id === updated.id);
      if (existing) {
        return prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
      }
      // Need to add user info - try to find it from existing reports
      const withUserInfo = prev.find((r) => r.userId === updated.userId);
      if (withUserInfo) {
        return [...prev, { ...updated, userName: withUserInfo.userName, userEmail: withUserInfo.userEmail }];
      }
      return prev;
    });
    setInReviewReports((prev) => {
      if (updated.status !== 'in_review') {
        return prev.filter((entry) => entry.id !== updated.id);
      }
      const nextEntry: InReviewReport = {
        id: updated.id,
        userId: updated.userId,
        reportDate: updated.reportDate,
        updatedAt: updated.updatedAt,
      };
      const exists = prev.some((entry) => entry.id === updated.id);
      if (!exists) {
        return [...prev, nextEntry];
      }
      return prev.map((entry) => (entry.id === updated.id ? nextEntry : entry));
    });
    setSelectedReportForDetail((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  }, []);

  const openRejectModal = useCallback(() => {
    setRejectReason('');
    setRejectError('');
    setRejectModalOpen(true);
  }, []);

  const closeRejectModal = useCallback(() => {
    setRejectModalOpen(false);
    setRejectError('');
  }, []);

  const handleAccept = useCallback(async () => {
    if (!selectedReportForDetail) return;
    setReviewLoading(true);
    setReviewError('');
    try {
      const updated = await api<DailyReport>(`/daily-reports/${selectedReportForDetail.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'accepted',
          reviewReason: null,
        }),
      });
      applyUpdatedReport(updated);
      setRejectReason('');
      setRejectModalOpen(false);
      setRejectError('');
      if ((viewMode === 'all' && displayMode === 'day') || viewMode === 'dashboard') {
        if (calendarRange) {
          void fetchAcceptedByDate(calendarRange);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update report.';
      setReviewError(message);
    } finally {
      setReviewLoading(false);
    }
  }, [selectedReportForDetail, applyUpdatedReport, viewMode, displayMode, calendarRange, fetchAcceptedByDate]);

  const handleReject = useCallback(async () => {
    if (!selectedReportForDetail) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError('Please add a rejection reason before rejecting.');
      return;
    }
    setReviewLoading(true);
    setRejectError('');
    setReviewError('');
    try {
      const updated = await api<DailyReport>(`/daily-reports/${selectedReportForDetail.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'rejected',
          reviewReason: reason,
        }),
      });
      applyUpdatedReport(updated);
      setRejectReason('');
      setRejectModalOpen(false);
      if ((viewMode === 'all' && displayMode === 'day') || viewMode === 'dashboard') {
        if (calendarRange) {
          void fetchAcceptedByDate(calendarRange);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update report.';
      setRejectError(message);
    } finally {
      setReviewLoading(false);
    }
  }, [selectedReportForDetail, rejectReason, applyUpdatedReport, viewMode, displayMode, calendarRange, fetchAcceptedByDate]);

  const canReview = selectedReportForDetail?.status === 'in_review';

  const loadDetailAttachments = useCallback(async (reportId: string) => {
    setAttachmentsLoading(true);
    setAttachmentsError('');
    try {
      const data = await api<DailyReportAttachment[]>(`/daily-reports/${reportId}/attachments`);
      setModalAttachments(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load attachments.';
      setAttachmentsError(message);
      setModalAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedReportForDetail?.id) {
      setModalAttachments([]);
      return;
    }
    void loadDetailAttachments(selectedReportForDetail.id);
  }, [selectedReportForDetail?.id, loadDetailAttachments]);

  const dayCellContent = useCallback(
    (arg: DayCellContentArg) => {
      const dateKey = toDateKey(arg.date);
      const inReviewCount = inReviewByDate.get(dateKey) ?? 0;
      const acceptedCount = acceptedByDate.get(dateKey) ?? 0;
      const hasAccepted = acceptedCount > 0;
      const hasInReview = inReviewCount > 0;
      return (
        <div className="flex w-full flex-col px-1 pt-1 text-sm leading-tight">
          <div className="flex w-full items-start justify-end text-base font-semibold text-slate-700">
            <span className="relative">
              {arg.dayNumberText}
              {inReviewCount > 0 && (
                <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
            </span>
          </div>
          {(hasAccepted || hasInReview) && (
            <div className="mt-1 text-sm">
              {hasAccepted && (
                <span className="text-emerald-600">{acceptedCount} accepted</span>
              )}
              {hasAccepted && hasInReview && (
                <span className="text-slate-400 mx-1">,</span>
              )}
              {hasInReview && (
                <span className="text-sky-600">{inReviewCount} in review</span>
              )}
            </div>
          )}
        </div>
      );
    },
    [inReviewByDate, acceptedByDate],
  );

  const dashboardStats = useMemo(() => {
    // Calculate stats from in-review reports and accepted counts
    const totalInReview = inReviewReports.length;
    const totalAccepted = Array.from(acceptedByDate.values()).reduce((sum, count) => sum + count, 0);
    // For rejected, we'd need to fetch or track separately - for now use inReviewReportsWithUser
    const totalRejected = inReviewReportsWithUser.filter((r) => r.status === 'rejected').length;
    const total = totalInReview + totalAccepted + totalRejected;
    return { total, inReview: totalInReview, accepted: totalAccepted, rejected: totalRejected };
  }, [inReviewReports, acceptedByDate, inReviewReportsWithUser]);

  const filteredAndSortedInReviewReports = useMemo(() => {
    let filtered = [...inReviewReportsWithUser];
    
    // Filter by user if selected
    if (selectedUserIdFilter) {
      filtered = filtered.filter((r) => r.userId === selectedUserIdFilter);
    }
    
    // Sort by date
    filtered.sort((a, b) => {
      const comparison = a.reportDate.localeCompare(b.reportDate);
      return dateSortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [inReviewReportsWithUser, selectedUserIdFilter, dateSortOrder]);

  const handleSortByDate = useCallback(() => {
    setDateSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  const handleFilterByUser = useCallback((userId: string) => {
    setSelectedUserIdFilter((prev) => (prev === userId ? null : userId));
  }, []);

  const calendarEvents = useMemo(() => {
    if (!selectedDate) return [];
    return [
      {
        id: 'selected-day',
        start: selectedDate,
        end: shiftDate(selectedDate, 1),
        allDay: true,
        display: 'background',
        backgroundColor: '#e2e8f0',
        overlap: false,
      },
    ];
  }, [selectedDate]);

  return (
    <>
      <style>{`
        .admin-reports-calendar .fc-daygrid-day-top {
          display: block;
        }
        .admin-reports-calendar .fc-daygrid-day-number {
          display: block;
          width: 100%;
          padding: 0;
          float: none;
        }
      `}</style>
      <div className="grid gap-4 min-h-screen xl:grid-cols-[280px_1fr]">
        <section
          className="flex flex-col gap-2 bg-[#0b1224] text-slate-100"
          style={{ boxShadow: '0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224' }}
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Reports</p>
                <h1 className="text-lg font-semibold text-slate-100">Review Center</h1>
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
                <span>All Reports</span>
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
            </div>
          </div>
        </section>
        <section className="flex-1 px-4 py-6">
          <div className="space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Admin review</p>
              <h1 className="text-3xl font-semibold text-slate-900">
                {viewMode === 'dashboard'
                  ? 'Dashboard'
                  : viewMode === 'all'
                    ? 'All Reports'
                    : 'In Review Reports'}
              </h1>
              <p className="text-sm text-slate-600">
                {viewMode === 'dashboard'
                  ? 'Overview of all reports and calendar view.'
                  : viewMode === 'all'
                    ? 'Review reports by day or scan weekly progress for a specific user.'
                    : 'Reports pending review with filtering and sorting options.'}
              </p>
            </div>

            {viewMode === 'dashboard' ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-slate-100 p-2">
                        <FileText className="w-5 h-5 text-slate-700" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Total</p>
                        <p className="text-2xl font-semibold text-slate-900">{dashboardStats.total}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-sky-100 p-2">
                        <Clock className="w-5 h-5 text-sky-700" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">In Review</p>
                        <p className="text-2xl font-semibold text-slate-900">{dashboardStats.inReview}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-emerald-100 p-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Accepted</p>
                        <p className="text-2xl font-semibold text-slate-900">{dashboardStats.accepted}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-rose-100 p-2">
                        <AlertCircle className="w-5 h-5 text-rose-700" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Rejected</p>
                        <p className="text-2xl font-semibold text-slate-900">{dashboardStats.rejected}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Calendar</p>
                      <h2 className="text-2xl font-semibold text-slate-900">Monthly view</h2>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                      {selectedDateLabel}
                    </div>
                  </div>
                  <div className="admin-reports-calendar mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <FullCalendar
                      plugins={[dayGridPlugin, interactionPlugin]}
                      initialView="dayGridMonth"
                      headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                      height={650}
                      showNonCurrentDates
                      fixedWeekCount={false}
                      nowIndicator
                      events={calendarEvents}
                      dayCellContent={dayCellContent}
                      dateClick={handleDateClick}
                      eventClick={handleEventClick}
                      datesSet={handleDatesSet}
                    />
                  </div>
                </div>
              </>
            ) : viewMode === 'all' ? (
              <>
                <div className="flex items-center justify-end gap-2 mb-4">
                  <label className="text-sm text-slate-600">Display mode:</label>
                  <select
                    value={displayMode}
                    onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 transition"
                  >
                    <option value="day">By Day</option>
                    <option value="user">By User</option>
                  </select>
                </div>
                {displayMode === 'day' ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Calendar</p>
                  <h2 className="text-2xl font-semibold text-slate-900">Monthly view</h2>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  {selectedDateLabel}
                </div>
              </div>
              <div className="admin-reports-calendar mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <FullCalendar
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                  height={650}
                  showNonCurrentDates
                  fixedWeekCount={false}
                  nowIndicator
                  events={calendarEvents}
                  dayCellContent={dayCellContent}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  datesSet={handleDatesSet}
                />
              </div>
            </section>

            <aside className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    <FileText className="w-3.5 h-3.5" />
                    Reports
                  </p>
                  <h2 className="text-2xl font-semibold text-slate-900">{selectedDateLabel}</h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {visibleDateReports.length} report{visibleDateReports.length === 1 ? '' : 's'}
                </div>
              </div>

              {dateError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {dateError}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {dateLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    Loading reports...
                  </div>
                ) : visibleDateReports.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    No reports submitted for this day.
                  </div>
                ) : (
                  visibleDateReports.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => openDetailPanel(report)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                    >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{report.userName}</div>
                            <div className="text-xs text-slate-600">{report.userEmail}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {report.status === 'in_review' && (
                              <NotificationBadge count={1} className="h-5 min-w-5 text-[10px]" />
                            )}
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${STATUS_CONFIG[report.status].chip}`}
                            >
                              {STATUS_CONFIG[report.status].label}
                            </span>
                          </div>
                        </div>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </div>
                ) : (
          <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
            <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    Users
                  </p>
                  <h2 className="text-2xl font-semibold text-slate-900">All active members</h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5" />
                  {users.length} user{users.length === 1 ? '' : 's'}
                </div>
              </div>

              {usersError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {usersError}
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {usersLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    Loading users...
                  </div>
                ) : users.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    No users available.
                  </div>
                ) : (
                  users.map((member) => {
                    const active = member.id === selectedUserId;
                    const pendingCount = inReviewByUser.get(member.id) ?? 0;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedUserId(member.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                          active
                            ? 'border-slate-300 bg-slate-100 shadow-sm'
                            : 'border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                            {initialsFor(member.userName)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{member.userName}</div>
                            <div className="text-xs text-slate-600">{member.email}</div>
                          </div>
                        </div>
                        {pendingCount > 0 && <NotificationBadge count={pendingCount} />}
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <aside className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Weekly report</p>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {selectedUser?.userName ?? 'Select a user'}
                  </h2>
                  <p className="text-sm text-slate-600">{formatWeekRangeLabel(weekStart)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWeekStart((prev) => shiftDate(prev, -7))}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prev week
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekStart(startOfWeek(toDateKey(new Date())))}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    This week
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekStart((prev) => shiftDate(prev, 7))}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    Next week
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {userError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {userError}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {userLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    Loading weekly reports...
                  </div>
                ) : weekDates.length === 0 ? null : (
                  weekDates.map((dateKey) => {
                    const report = weekReportMap.get(dateKey);
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() =>
                          report ? openDetailPanel(report, selectedUser) : undefined
                        }
                        disabled={!report}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          report
                            ? 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:shadow-md'
                            : 'border-dashed border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {formatDateLabel(dateKey, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          {report ? (
                            <div className="flex items-center gap-2">
                              {report.status === 'in_review' && (
                                <NotificationBadge count={1} className="h-5 min-w-5 text-[10px]" />
                              )}
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${STATUS_CONFIG[report.status].chip}`}
                              >
                                {STATUS_CONFIG[report.status].label}
                              </span>
                            </div>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                              No submitted
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
                )}
              </>
            ) : (
              <div className="rounded-3xl border border-slate-200/70 bg-white shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm overflow-hidden">
                {inReviewLoading ? (
                  <div className="flex items-center justify-center p-10">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                  </div>
                ) : inReviewError ? (
                  <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-sm text-rose-700">
                    {inReviewError}
                  </div>
                ) : filteredAndSortedInReviewReports.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">No in-review reports found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            No
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 cursor-pointer hover:bg-slate-100 transition"
                            onClick={handleSortByDate}
                          >
                            Date {dateSortOrder === 'asc' ? '↑' : '↓'}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            User
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredAndSortedInReviewReports.map((report, index) => (
                          <tr
                            key={report.id}
                            onClick={() => openDetailPanel(report)}
                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3 text-sm text-slate-900">{index + 1}</td>
                            <td className="px-4 py-3 text-sm text-slate-900">{formatShortDate(report.reportDate)}</td>
                            <td
                              className="px-4 py-3 text-sm text-slate-900"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFilterByUser(report.userId);
                              }}
                            >
                              <span className="hover:underline">{report.userName}</span>
                              {selectedUserIdFilter === report.userId && (
                                <span className="ml-2 text-xs text-slate-500">(filtered)</span>
                              )}
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
        </section>
      </div>

      {detailPanelOpen && selectedReportForDetail ? (
        <>
          <div
            className="fixed inset-0 top-[57px] z-30 bg-slate-900/40"
            onClick={closeDetailPanel}
          />
          <div
            className={`fixed top-[57px] right-0 z-40 h-[calc(100vh-57px)] w-full max-w-2xl transform border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ${
              detailPanelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex h-full flex-col overflow-y-auto">
              <section className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Report details</p>
                    <h2 className="text-lg font-semibold text-slate-900 mt-1">
                      {formatDateLabel(selectedReportForDetail.reportDate, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </h2>
                    <div className="mt-2 text-sm text-slate-600">
                      {selectedReportForDetail.userName} - {selectedReportForDetail.userEmail || 'No email'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${STATUS_CONFIG[selectedReportForDetail.status].chip}`}
                    >
                      {STATUS_CONFIG[selectedReportForDetail.status].label}
                    </span>
                    <button
                      type="button"
                      onClick={closeDetailPanel}
                      className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                      title="Close"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {selectedReportForDetail.status === 'rejected' && selectedReportForDetail.reviewReason ? (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-rose-500">Rejection reason</div>
                    <div className="mt-2 whitespace-pre-wrap">{selectedReportForDetail.reviewReason}</div>
                  </div>
                ) : null}

                <div className="mb-4">
                  <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">
                    <FileText className="w-3.5 h-3.5" />
                    Daily report
                  </label>
                  <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                    {selectedReportForDetail.content?.trim() || 'No report content.'}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">
                    <FileText className="w-3.5 h-3.5" />
                    Attachments
                  </div>
                  {attachmentsError ? (
                    <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {attachmentsError}
                    </div>
                  ) : null}
                  <div className="mt-2 space-y-2">
                    {attachmentsLoading ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Loading attachments...
                      </div>
                    ) : modalAttachments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        No attachments.
                      </div>
                    ) : (
                      modalAttachments.map((attachment) => (
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

                {reviewError ? (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {reviewError}
                  </div>
                ) : null}

                <div className="mb-4 text-xs text-slate-500">
                  {selectedReportForDetail.submittedAt
                    ? `Submitted: ${new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(selectedReportForDetail.submittedAt))}`
                    : 'Not submitted'}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={openRejectModal}
                    disabled={!canReview || reviewLoading}
                    className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="w-3.5 h-3.5" />
                    {reviewLoading ? 'Updating...' : 'Reject'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={!canReview || reviewLoading}
                    className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {reviewLoading ? 'Updating...' : 'Accept'}
                  </button>
                </div>
                {!canReview ? (
                  <div className="mt-3 text-xs text-slate-500">
                    Only in-review reports can be reviewed.
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </>
      ) : null}


      {rejectModalOpen && selectedReportForDetail ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-10">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeRejectModal} />
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop-blur-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Reject report</p>
              <h3 className="text-xl font-semibold text-slate-900">Add a rejection reason</h3>
              <p className="mt-1 text-sm text-slate-600">
                This reason is required to reject the report.
              </p>
            </div>
            <div className="mt-4">
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Explain what needs to be fixed..."
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none ring-1 ring-transparent focus:ring-slate-300"
              />
            </div>
            {rejectError ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {rejectError}
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRejectModal}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-100"
              >
                <XCircle className="w-3.5 h-3.5 text-slate-600" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={reviewLoading}
                className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="w-3.5 h-3.5" />
                {reviewLoading ? 'Rejecting...' : 'Reject report'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
