'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import { DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxon3Plugin from '@fullcalendar/luxon3';
import { RefreshCw, Calendar, Mail, Plus, X, Settings, Clock, Globe } from 'lucide-react';
import TopNav from '../../components/TopNav';
import { useAuth } from '../../lib/useAuth';
import { DEFAULT_TIMEZONE_ID, TIMEZONE_OPTIONS, type TimezoneOption } from '../../lib/timezones';
import { api, API_BASE } from '../../lib/api';

type CalendarAccount = {
  email: string;
  name?: string | null;
  timezone?: string | null;
  accountId?: string;
  isPrimary?: boolean;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay?: boolean;
  organizer?: string;
  location?: string;
  mailbox?: string;
};

type EventPopover = {
  title: string;
  start?: Date | null;
  end?: Date | null;
  isAllDay?: boolean;
  organizer?: string;
  location?: string;
  mailbox?: string;
  position: { x: number; y: number };
};

type CalendarEventsResponse = {
  accounts?: CalendarAccount[];
  events: CalendarEvent[];
  source: 'graph' | 'sample' | 'db';
  warning?: string;
  failedMailboxes?: string[];
  message?: string;
};

type TimezoneOptionWithDisplay = TimezoneOption & {
  displayLabel: string;
  offsetMinutes: number;
};

const chipBase =
  'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700';

const MAILBOX_STORAGE_KEY = 'calendar.extraMailboxes';
const MAILBOX_COLORS_STORAGE_KEY = 'calendar.mailboxColors';
const CALENDAR_VIEW_STORAGE_KEY = 'calendar.currentView';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeMailbox = (mailbox: string) => mailbox.trim().toLowerCase();

// Color palette for different mailboxes
const MAILBOX_COLORS = [
  { bg: '#0284c7', border: '#0ea5e9', text: '#ffffff' }, // Sky blue
  { bg: '#7c3aed', border: '#8b5cf6', text: '#ffffff' }, // Purple
  { bg: '#059669', border: '#10b981', text: '#ffffff' }, // Emerald
  { bg: '#dc2626', border: '#ef4444', text: '#ffffff' }, // Red
  { bg: '#ea580c', border: '#f97316', text: '#ffffff' }, // Orange
  { bg: '#0891b2', border: '#06b6d4', text: '#ffffff' }, // Cyan
  { bg: '#be185d', border: '#ec4899', text: '#ffffff' }, // Pink
  { bg: '#b45309', border: '#d97706', text: '#ffffff' }, // Amber
  { bg: '#0369a1', border: '#0ea5e9', text: '#ffffff' }, // Blue
  { bg: '#7e22ce', border: '#9333ea', text: '#ffffff' }, // Violet
  { bg: '#047857', border: '#059669', text: '#ffffff' }, // Green
  { bg: '#991b1b', border: '#dc2626', text: '#ffffff' }, // Dark red
  { bg: '#0d9488', border: '#14b8a6', text: '#ffffff' }, // Teal
  { bg: '#c026d3', border: '#d946ef', text: '#ffffff' }, // Fuchsia
  { bg: '#65a30d', border: '#84cc16', text: '#ffffff' }, // Lime
  { bg: '#1e40af', border: '#2563eb', text: '#ffffff' }, // Indigo
  { bg: '#a21caf', border: '#c026d3', text: '#ffffff' }, // Magenta
  { bg: '#155e75', border: '#0891b2', text: '#ffffff' }, // Dark cyan
  { bg: '#92400e', border: '#b45309', text: '#ffffff' }, // Brown
  { bg: '#701a75', border: '#86198f', text: '#ffffff' }, // Dark purple
  { bg: '#166534', border: '#16a34a', text: '#ffffff' }, // Dark green
  { bg: '#9f1239', border: '#be185d', text: '#ffffff' }, // Dark pink
  { bg: '#78350f', border: '#92400e', text: '#ffffff' }, // Dark orange
  { bg: '#1e3a8a', border: '#1e40af', text: '#ffffff' }, // Navy blue
];

// Get color for a mailbox using consistent hashing, with support for custom colors
const getMailboxColor = (
  mailbox: string,
  customColors?: Record<string, typeof MAILBOX_COLORS[0]>
): typeof MAILBOX_COLORS[0] => {
  if (!mailbox) {
    return MAILBOX_COLORS[0]; // Default color
  }
  const normalized = normalizeMailbox(mailbox);
  
  // Check for custom color first
  if (customColors && customColors[normalized]) {
    return customColors[normalized];
  }
  
  // Fall back to hash-based assignment
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % MAILBOX_COLORS.length;
  return MAILBOX_COLORS[index];
};

const resolveDefaultTimezoneId = () => {
  if (typeof Intl === 'undefined') return DEFAULT_TIMEZONE_ID;
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!localTz) return DEFAULT_TIMEZONE_ID;
  const match = TIMEZONE_OPTIONS.find((option) => option.calendar === localTz);
  return match?.id ?? DEFAULT_TIMEZONE_ID;
};

const getTimezoneOffsetMinutes = (timeZone: string, date: Date) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);
    const hour = Number(values.hour);
    const minute = Number(values.minute);
    const second = Number(values.second);
    if ([year, month, day, hour, minute, second].some((value) => Number.isNaN(value))) {
      return 0;
    }
    const utcTime = Date.UTC(year, month - 1, day, hour, minute, second);
    return Math.round((utcTime - date.getTime()) / 60000);
  } catch (err) {
    return 0;
  }
};

const formatUtcOffset = (offsetMinutes: number) => {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const buildTimezoneOptions = (date = new Date()): TimezoneOptionWithDisplay[] =>
  TIMEZONE_OPTIONS.map((option) => {
    const offsetMinutes = getTimezoneOffsetMinutes(option.calendar, date);
    return {
      ...option,
      offsetMinutes,
      displayLabel: `${option.label} (${formatUtcOffset(offsetMinutes)})`,
    };
  });

const uniqueMailboxes = (mailboxes: string[]) => {
  const seen = new Set<string>();
  return mailboxes
    .map(normalizeMailbox)
    .filter(Boolean)
    .filter((mailbox) => {
      if (seen.has(mailbox)) return false;
      seen.add(mailbox);
      return true;
    });
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, loading } = useAuth();
  const canManageOutlook = user?.role === 'ADMIN';
  const [viewRange, setViewRange] = useState<{ start: string; end: string } | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | undefined>();
  const [connectedAccounts, setConnectedAccounts] = useState<CalendarAccount[]>([]);
  const [failedMailboxes, setFailedMailboxes] = useState<string[]>([]);
  const [extraMailboxes, setExtraMailboxes] = useState<string[]>([]);
  const [mailboxInput, setMailboxInput] = useState('');
  const [mailboxError, setMailboxError] = useState<string | null>(null);
  const [timezoneId, setTimezoneId] = useState<string>(() => resolveDefaultTimezoneId());
  const [hiddenMailboxes, setHiddenMailboxes] = useState<string[]>([]);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [eventPopover, setEventPopover] = useState<EventPopover | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [customMailboxColors, setCustomMailboxColors] = useState<Record<string, typeof MAILBOX_COLORS[0]>>({});
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentView, setCurrentView] = useState<string>(() => {
    if (typeof window === 'undefined') return 'timeGridWeek';
    try {
      const stored = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
      return stored || 'timeGridWeek';
    } catch {
      return 'timeGridWeek';
    }
  });

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace('/auth');
    }
  }, [loading, user, token, router]);

  const eventContent = (arg: EventContentArg) => {
    const label = arg.timeText ? `${arg.timeText} ${arg.event.title}` : arg.event.title;
    // Check if we're in monthly view (dayGridMonth)
    const isMonthView = arg.view.type === 'dayGridMonth';
    
    // In monthly view, use the mailbox color (borderColor) for text to ensure readability
    // In weekly/day view, use white text on colored background
    const textColor = isMonthView 
      ? (arg.event.borderColor || arg.event.backgroundColor || '#0284c7')
      : (arg.event.textColor || '#ffffff');
    
    return (
      <div 
        className="w-full truncate text-[11px] font-semibold leading-tight"
        style={{ color: textColor }}
        title={label}
      >
        {label}
      </div>
    );
  };

  const handleViewChange = useCallback((view: string) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, view);
      } catch (err) {
        console.warn('Failed to save calendar view', err);
      }
    }
  }, []);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setViewRange({ start: info.startStr, end: info.endStr });
    // Update current view when dates change (which happens on view change)
    if (info.view.type !== currentView) {
      handleViewChange(info.view.type);
    }
  }, [currentView, handleViewChange]);

  const calendarEvents = useMemo(() => {
    const hiddenSet = new Set(hiddenMailboxes);
    return events
      .filter((ev) => {
        const mailbox = ev.mailbox ? normalizeMailbox(ev.mailbox) : '';
        return !mailbox || !hiddenSet.has(mailbox);
      })
      .map((ev) => {
        const mailbox = ev.mailbox ? normalizeMailbox(ev.mailbox) : '';
        const color = getMailboxColor(mailbox, customMailboxColors);
        return {
          ...ev,
          allDay: Boolean(ev.isAllDay),
          backgroundColor: color.bg,
          borderColor: color.border,
          textColor: color.text,
        };
      });
  }, [events, hiddenMailboxes, customMailboxColors]);

  const timezoneOptions = useMemo(() => buildTimezoneOptions(), []);

  const selectedTimezone = useMemo(
    () => timezoneOptions.find((tz) => tz.id === timezoneId) ?? timezoneOptions[0],
    [timezoneId, timezoneOptions],
  );

  const scrollTime = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone: selectedTimezone.calendar,
    });
    const hour = Number(formatter.format(now));
    const baseHour = Number.isNaN(hour) ? now.getHours() : hour;
    const startHour = clamp(baseHour - 4, 0, 16);
    return `${String(startHour).padStart(2, '0')}:00:00`;
  }, [selectedTimezone.calendar]);

  const mailboxCards = useMemo(() => {
    const connected = connectedAccounts.map((account) => ({
      email: normalizeMailbox(account.email),
      name: account.name,
      status: 'connected' as const,
      accountId: account.accountId,
      isPrimary: account.isPrimary,
    }));
    const connectedSet = new Set(connected.map((account) => account.email));
    const failed = failedMailboxes
      .map(normalizeMailbox)
      .filter(Boolean)
      .filter((mailbox) => !connectedSet.has(mailbox))
      .map((mailbox) => ({
        email: mailbox,
        status: 'needs-access' as const,
      }));
    const failedSet = new Set(failed.map((account) => account.email));
    const added = uniqueMailboxes(extraMailboxes)
      .filter((mailbox) => !connectedSet.has(mailbox) && !failedSet.has(mailbox))
      .map((mailbox) => ({
        email: mailbox,
        status: 'added' as const,
      }));
    return [...connected, ...failed, ...added];
  }, [connectedAccounts, failedMailboxes, extraMailboxes]);

  const visibleMailboxCards = useMemo(
    () =>
      canManageOutlook
        ? mailboxCards
        : mailboxCards.filter((account) => account.status === 'connected'),
    [canManageOutlook, mailboxCards],
  );

  const hiddenMailboxSet = useMemo(() => new Set(hiddenMailboxes), [hiddenMailboxes]);

  const primaryEmail = connectedAccounts.find((acc) => acc.isPrimary)?.email?.toLowerCase();
  const canSyncNow = connectedAccounts.length > 0 && Boolean(viewRange) && canManageOutlook;
  const canShowMailboxes = connectedAccounts.length > 0 || (events.length > 0 && !canManageOutlook);

  useEffect(() => {
    if (!canManageOutlook || typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(MAILBOX_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const cleaned = uniqueMailboxes(parsed.filter((mailbox) => typeof mailbox === 'string')).sort();
        if (cleaned.length) {
          setExtraMailboxes(cleaned);
        }
      }
    } catch (err) {
      console.warn('Failed to read saved mailboxes', err);
    }
  }, [canManageOutlook]);

  // Load custom mailbox colors from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(MAILBOX_COLORS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          setCustomMailboxColors(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to read saved mailbox colors', err);
    }
  }, []);

  // Save custom mailbox colors to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(MAILBOX_COLORS_STORAGE_KEY, JSON.stringify(customMailboxColors));
    } catch (err) {
      console.warn('Failed to save mailbox colors', err);
    }
  }, [customMailboxColors]);

  useEffect(() => {
    if (!canManageOutlook || typeof window === 'undefined') return;
    const cleaned = uniqueMailboxes(extraMailboxes).filter(
      (mailbox) => mailbox && mailbox !== primaryEmail,
    );
    if (!cleaned.length) {
      window.localStorage.removeItem(MAILBOX_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(MAILBOX_STORAGE_KEY, JSON.stringify(cleaned));
  }, [extraMailboxes, primaryEmail, canManageOutlook]);

  useEffect(() => {
    if (!primaryEmail) return;
    setExtraMailboxes((prev) => prev.filter((mailbox) => mailbox !== primaryEmail));
  }, [primaryEmail]);

  const handleAddMailbox = () => {
    if (!canManageOutlook) return;
    const candidates = mailboxInput
      .split(/[,;\n]+/)
      .map(normalizeMailbox)
      .filter(Boolean);
    if (!candidates.length) return;
    const invalid = candidates.filter((mailbox) => !emailPattern.test(mailbox));
    if (invalid.length) {
      setMailboxError('Enter valid email addresses separated by commas.');
      return;
    }
    const filtered = candidates.filter((mailbox) => mailbox !== primaryEmail);
    const next = uniqueMailboxes([...extraMailboxes, ...filtered]).sort();
    if (next.length === extraMailboxes.length) {
      setMailboxError(
        primaryEmail && candidates.includes(primaryEmail)
          ? 'This mailbox is already connected.'
          : 'Mailbox already added.',
      );
      return;
    }
    setExtraMailboxes(next);
    setMailboxInput('');
    setMailboxError(null);
  };

  const handleRemoveMailbox = (mailbox: string) => {
    setExtraMailboxes((prev) => prev.filter((entry) => entry !== mailbox));
  };

  const toggleMailboxVisibility = useCallback((mailbox: string) => {
    const normalized = normalizeMailbox(mailbox);
    if (!normalized) return;
    setHiddenMailboxes((prev) =>
      prev.includes(normalized) ? prev.filter((entry) => entry !== normalized) : [...prev, normalized],
    );
  }, []);

  const fetchEvents = useCallback(async (range: { start: string; end: string }, source: 'db' | 'graph' = 'db') => {
    if (!token) return;
    setEventsLoading(true);
    setError(null);
    try {
      // Non-admin users can ONLY load from database, never from Graph API
      const effectiveSource = canManageOutlook ? source : 'db';
      const qs = new URLSearchParams({ start: range.start, end: range.end, source: effectiveSource });
      if (canManageOutlook) {
        const mailboxParam = uniqueMailboxes(extraMailboxes).filter(
          (mailbox) => mailbox && mailbox !== primaryEmail,
        );
        if (mailboxParam.length) {
          qs.set('mailboxes', mailboxParam.join(','));
        }
      }
      qs.set('timezone', selectedTimezone.graph);
      const data = await api<CalendarEventsResponse>(`/calendar/outlook?${qs.toString()}`, {
        method: 'GET',
      }, token);
      setEvents(data?.events || []);
      setWarning(data?.warning);
      setConnectedAccounts(data?.accounts ?? []);
      setFailedMailboxes(data?.failedMailboxes ?? []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to load events right now.');
    } finally {
      setEventsLoading(false);
    }
  }, [canManageOutlook, extraMailboxes, primaryEmail, selectedTimezone.graph, token]);

  const handleDisconnectMailbox = useCallback(
    async (account: { accountId?: string; email: string; isPrimary?: boolean }) => {
      if (!account.accountId || !token) return;
      setDisconnectingId(account.accountId);
      setError(null);
      try {
        await api(`/calendar/oauth/accounts/${account.accountId}`, {
          method: 'DELETE',
        }, token);
        setHiddenMailboxes((prev) => prev.filter((entry) => entry !== normalizeMailbox(account.email)));
        if (viewRange) {
          await fetchEvents(viewRange, 'db');
        } else {
          setConnectedAccounts((prev) =>
            prev.filter((entry) => entry.accountId !== account.accountId),
          );
          setEvents((prev) =>
            prev.filter(
              (event) => normalizeMailbox(event.mailbox || '') !== normalizeMailbox(account.email),
            ),
          );
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to disconnect mailbox.');
      } finally {
        setDisconnectingId(null);
      }
    },
    [fetchEvents, token, viewRange],
  );

  const handleSyncMailboxes = useCallback(() => {
    if (!viewRange) return;
    if (canManageOutlook && connectedAccounts.length > 0) {
      // Admin sync: fetch from Graph API (which will save to DB automatically)
      void fetchEvents(viewRange, 'graph');
    } else {
      // For non-admin users, just refresh from database
      void fetchEvents(viewRange, 'db');
    }
  }, [fetchEvents, connectedAccounts.length, viewRange, canManageOutlook]);

  const handleConnectOutlook = useCallback(async () => {
    if (typeof window === 'undefined' || !token) return;
    
    try {
      // Backend callback URL (without query params - Azure AD doesn't accept them)
      const backendCallbackUrl = `${API_BASE}/calendar/oauth/callback`;
      
      // Get OAuth URL from backend
      const response = await api<{ authUrl: string; state: string }>(
        `/calendar/oauth/authorize?redirect_uri=${encodeURIComponent(backendCallbackUrl)}&frontend_redirect=${encodeURIComponent(window.location.origin)}`,
        { method: 'GET' },
        token
      );
      
      // Redirect to Microsoft OAuth
      window.location.href = response.authUrl;
    } catch (err) {
      console.error('Failed to get OAuth URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect Outlook account.');
    }
  }, [token]);

  const loadOAuthAccounts = useCallback(async () => {
    if (!token) return;
    setAccountsLoading(true);
    try {
      const accounts = await api<Array<{ id: string; email: string; displayName?: string; accountId: string; providerAccountId: string }>>(
        '/calendar/oauth/accounts',
        { method: 'GET' },
        token,
      );
      setConnectedAccounts(
        accounts.map((acc) => ({
          email: acc.email,
          name: acc.displayName ?? null,
          accountId: acc.accountId,
          isPrimary: false,
        })),
      );
    } catch (err) {
      console.error('Failed to load OAuth accounts:', err);
    } finally {
      setAccountsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && !loading) {
      void loadOAuthAccounts();
    }
  }, [token, loading, loadOAuthAccounts]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const successParam = searchParams.get('success');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
    if (successParam === 'connected') {
      void loadOAuthAccounts();
    }
  }, [searchParams, loadOAuthAccounts]);

  const formatEventRange = useCallback(
    (start?: Date | null, end?: Date | null, isAllDay?: boolean) => {
      if (!start) return '';
      const tz = selectedTimezone.calendar;
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: tz,
      });
      if (isAllDay || !end) {
        return `${dateFormatter.format(start)} (All day)`;
      }
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tz,
      });
      return `${dateFormatter.format(start)} ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
    },
    [selectedTimezone.calendar],
  );

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      info.jsEvent.preventDefault();
      const { clientX, clientY } = info.jsEvent;
      const popoverWidth = 320;
      const popoverHeight = 220;
      const padding = 16;
      const maxX = window.innerWidth - popoverWidth - padding;
      const maxY = window.innerHeight - popoverHeight - padding;
      const x = clamp(clientX, padding, Math.max(padding, maxX));
      const y = clamp(clientY, padding, Math.max(padding, maxY));
      const organizer = info.event.extendedProps.organizer as string | undefined;
      const location = info.event.extendedProps.location as string | undefined;
      const mailbox = info.event.extendedProps.mailbox as string | undefined;
      setEventPopover({
        title: info.event.title,
        start: info.event.start,
        end: info.event.end,
        isAllDay: info.event.allDay,
        organizer,
        location,
        mailbox,
        position: { x, y },
      });
    },
    [],
  );

  const closeEventPopover = useCallback(() => setEventPopover(null), []);

  useEffect(() => {
    if (!viewRange || !token) return;
    void fetchEvents(viewRange, 'db');
  }, [fetchEvents, token, viewRange]);

  useEffect(() => {
    if (!eventPopover) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeEventPopover();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeEventPopover, eventPopover]);

  const handleColorIndicatorClick = useCallback((event: React.MouseEvent, mailbox: string) => {
    event.stopPropagation();
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const popoverWidth = 256; // w-64 = 16rem = 256px
    const padding = 16; // Minimum distance from viewport edges
    
    // Calculate centered x position
    let x = rect.left + rect.width / 2;
    
    // Ensure popover stays within viewport bounds
    const minX = padding + popoverWidth / 2;
    const maxX = window.innerWidth - padding - popoverWidth / 2;
    x = Math.max(minX, Math.min(maxX, x));
    
    setColorPickerPosition({ x, y: rect.bottom + 8 });
    setColorPickerOpen(mailbox);
  }, []);

  const handleColorSelect = useCallback((mailbox: string, color: typeof MAILBOX_COLORS[0]) => {
    const normalized = normalizeMailbox(mailbox);
    setCustomMailboxColors((prev) => ({
      ...prev,
      [normalized]: color,
    }));
    setColorPickerOpen(null);
    setColorPickerPosition(null);
  }, []);

  const handleColorReset = useCallback((mailbox: string) => {
    const normalized = normalizeMailbox(mailbox);
    setCustomMailboxColors((prev) => {
      const next = { ...prev };
      delete next[normalized];
      return next;
    });
    setColorPickerOpen(null);
    setColorPickerPosition(null);
  }, []);

  useEffect(() => {
    if (!colorPickerOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.color-picker-popover') && !target.closest('.color-indicator-button')) {
        setColorPickerOpen(null);
        setColorPickerPosition(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setColorPickerOpen(null);
        setColorPickerPosition(null);
      }
    };
    // Use a small delay to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClick, true);
      window.addEventListener('keydown', handleKey);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClick, true);
      window.removeEventListener('keydown', handleKey);
    };
  }, [colorPickerOpen]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
      <TopNav />
      <div className="mx-auto w-full min-h-screen pt-[57px]">
        <div className="grid gap-4 min-h-[calc(100vh-57px)] xl:grid-cols-[280px_1fr]">
          <section
            className="flex flex-col h-[calc(100vh-57px)] bg-[#0b1224] text-slate-100"
            style={{ boxShadow: '0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224' }}
          >
            <div className="flex flex-col h-full">
              {/* Header - Fixed at top */}
              <div className="p-4 border-b border-slate-700/50 flex-shrink-0">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Calendar</p>
                    <h1 className="text-lg font-semibold text-slate-100">Mailboxes</h1>
                  </div>
                </div>
                {canManageOutlook ? (
                  <button
                    onClick={handleConnectOutlook}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-slate-300 hover:bg-slate-800/50 hover:text-white bg-slate-800/30"
                  >
                    <Plus className="w-5 h-5" />
                    <span>{connectedAccounts.length > 0 ? 'Add Account' : 'Connect Outlook'}</span>
                  </button>
                ) : null}
              </div>

              {/* Scrollable mailbox list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {accountsLoading ? (
                  <div className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300">
                    Loading accounts...
                  </div>
                ) : !canShowMailboxes && events.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800 px-3 py-3 text-sm text-slate-400">
                    {canManageOutlook
                      ? 'Connect your Outlook account to see meetings in real time.'
                      : 'No events available. Ask an admin to sync Outlook calendars.'}
                  </div>
                ) : (
                  <>
                    {visibleMailboxCards.length ? (
                      visibleMailboxCards.map((account) => {
                        const mailboxKey = normalizeMailbox(account.email);
                        const isHidden = hiddenMailboxSet.has(mailboxKey);
                        if (account.status === 'connected') {
                          const isPrimary = account.isPrimary ?? (primaryEmail && mailboxKey === primaryEmail);
                          const statusLabel = isPrimary ? 'Primary' : 'Connected';
                          const statusText = isHidden ? 'Hidden' : 'Shown';
                          const mailboxColor = getMailboxColor(account.email, customMailboxColors);
                          return (
                            <div
                              key={account.email}
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleMailboxVisibility(mailboxKey)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  toggleMailboxVisibility(mailboxKey);
                                }
                              }}
                              aria-pressed={!isHidden}
                              title={isHidden ? 'Show events' : 'Hide events'}
                              className={`flex w-full flex-col items-start gap-1 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-left transition ${isHidden ? 'opacity-50' : 'hover:bg-slate-800'}`}
                              style={{ borderLeftWidth: '4px', borderLeftColor: mailboxColor.bg }}
                            >
                              <div className="flex w-full items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => handleColorIndicatorClick(e, account.email)}
                                    className="color-indicator-button w-3 h-3 rounded-full flex-shrink-0 hover:ring-2 hover:ring-slate-400 hover:ring-offset-2 hover:ring-offset-slate-800 transition cursor-pointer"
                                    style={{ backgroundColor: mailboxColor.bg }}
                                    title="Click to change color"
                                  />
                                  <Mail className="w-4 h-4 text-slate-400" />
                                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                    {statusText}
                                  </span>
                                </div>
                                {canManageOutlook && account.accountId ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDisconnectMailbox({
                                        accountId: account.accountId,
                                        email: account.email,
                                        isPrimary: Boolean(isPrimary),
                                      });
                                    }}
                                    disabled={disconnectingId === account.accountId}
                                    className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {disconnectingId === account.accountId ? '...' : <X className="w-3 h-3" />}
                                  </button>
                                ) : null}
                              </div>
                              <span className="text-sm font-semibold text-slate-100">
                                {account.name || account.email}
                              </span>
                              <span className="text-xs text-slate-400">{account.email}</span>
                            </div>
                          );
                        }
                        if (account.status === 'needs-access') {
                          const mailboxColor = getMailboxColor(account.email, customMailboxColors);
                          return (
                            <div
                              key={account.email}
                              className="flex w-full flex-col items-start gap-1 rounded-xl border border-amber-700 bg-amber-900/20 px-3 py-2.5 text-left"
                              style={{ borderLeftWidth: '4px', borderLeftColor: mailboxColor.bg }}
                            >
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => handleColorIndicatorClick(e, account.email)}
                                  className="color-indicator-button w-3 h-3 rounded-full flex-shrink-0 hover:ring-2 hover:ring-amber-400 hover:ring-offset-2 hover:ring-offset-amber-900/20 transition cursor-pointer"
                                  style={{ backgroundColor: mailboxColor.bg }}
                                  title="Click to change color"
                                />
                                <span className="text-[11px] uppercase tracking-[0.18em] text-amber-400">
                                  Needs access
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-slate-100">{account.email}</span>
                              <span className="text-xs text-amber-300">
                                Shared calendar access required. Ask the mailbox owner to share with a connected account.
                              </span>
                            </div>
                          );
                        }
                        const addedLabel = isHidden ? 'Added (hidden)' : 'Added';
                        const mailboxColor = getMailboxColor(account.email, customMailboxColors);
                        return (
                          <button
                            key={account.email}
                            type="button"
                            onClick={() => toggleMailboxVisibility(mailboxKey)}
                            aria-pressed={!isHidden}
                            title={isHidden ? 'Show events' : 'Hide events'}
                            className={`flex w-full flex-col items-start gap-1 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-left transition hover:bg-slate-800 ${isHidden ? 'opacity-50' : ''}`}
                            style={{ borderLeftWidth: '4px', borderLeftColor: mailboxColor.bg }}
                          >
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleColorIndicatorClick(e, account.email);
                                }}
                                className="color-indicator-button w-3 h-3 rounded-full flex-shrink-0 hover:ring-2 hover:ring-slate-400 hover:ring-offset-2 hover:ring-offset-slate-800 transition cursor-pointer"
                                style={{ backgroundColor: mailboxColor.bg }}
                                title="Click to change color"
                              />
                              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                {addedLabel}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-slate-100">{account.email}</span>
                            <span className="text-xs text-slate-400">
                              Will sync on the next refresh if shared with a connected account.
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400">
                        {canManageOutlook ? 'No mailboxes added yet.' : 'No mailboxes synced yet.'}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Timezone section - Fixed at bottom */}
              {canManageOutlook ? (
                <div className="p-4 border-t border-slate-700/50 flex-shrink-0">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Time zone</span>
                    </div>
                    <div className="mt-2">
                      <select
                        value={timezoneId}
                        onChange={(e) => setTimezoneId(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-transparent focus:ring-slate-500"
                      >
                        {timezoneOptions.map((tz) => (
                          <option key={tz.id} value={tz.id}>
                            {tz.displayLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Calendar times show in {selectedTimezone.displayLabel}.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
          <section className="flex-1 px-4 py-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
              <header className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                      Upcoming Events
                    </p>
                    <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                      Calendar
                    </h1>
                  </div>
                </div>
              </header>
              <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.4)] backdrop-blur-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <button
                    onClick={handleSyncMailboxes}
                    disabled={!viewRange || eventsLoading}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${eventsLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {connectedAccounts.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {connectedAccounts.map((account) => (
                    <span key={account.email} className={chipBase}>
                      {account.name ? `${account.name} (${account.email})` : account.email}
                    </span>
                  ))}
                </div>
              ) : null}

              {warning ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {warning}
                </div>
              ) : null}
              {error ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {eventsLoading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                  </div>
                ) : null}
                {!canShowMailboxes && !eventsLoading && events.length === 0 ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 px-6 text-center text-sm text-slate-600 backdrop-blur-sm">
                    {canManageOutlook
                      ? 'Connect your Outlook account to view events.'
                      : 'No events available. Ask an admin to sync Outlook calendars.'}
                  </div>
                ) : null}
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxon3Plugin]}
                  initialView={currentView}
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                  }}
                  height={680}
                  expandRows={false}
                  slotMinTime="00:00:00"
                  slotMaxTime="24:00:00"
                  scrollTime={scrollTime}
                  allDaySlot
                  weekends
                  nowIndicator
                  timeZone={selectedTimezone.calendar}
                  events={calendarEvents}
                  eventContent={eventContent}
                  eventClick={handleEventClick}
                  dayHeaderFormat={{ weekday: 'short', month: 'short', day: 'numeric' }}
                  datesSet={handleDatesSet}
                  viewDidMount={(viewInfo) => {
                    handleViewChange(viewInfo.view.type);
                  }}
                />
              </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {eventPopover ? (
        <div className="fixed inset-0 z-50" onClick={closeEventPopover}>
          <div className="absolute inset-0 bg-slate-900/10" />
          <div
            className="fixed w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            style={{ left: eventPopover.position.x, top: eventPopover.position.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Event</div>
                <div className="text-lg font-semibold text-slate-900">{eventPopover.title}</div>
              </div>
              <button
                type="button"
                onClick={closeEventPopover}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Time</span>
                <div>{formatEventRange(eventPopover.start, eventPopover.end, eventPopover.isAllDay)}</div>
              </div>
              {eventPopover.location ? (
                <div>
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Location</span>
                  <div className="truncate">{eventPopover.location}</div>
                </div>
              ) : null}
              {eventPopover.organizer ? (
                <div>
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Organizer</span>
                  <div className="truncate">{eventPopover.organizer}</div>
                </div>
              ) : null}
              {eventPopover.mailbox ? (
                <div>
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Mailbox</span>
                  <div className="truncate">{eventPopover.mailbox}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Color Picker Popover */}
      {colorPickerOpen && colorPickerPosition ? (
        <>
          <div 
            className="fixed inset-0 z-[49]" 
            onClick={() => {
              setColorPickerOpen(null);
              setColorPickerPosition(null);
            }}
          />
          <div
            className="color-picker-popover fixed z-50 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            style={{
              left: `${colorPickerPosition.x}px`,
              top: `${colorPickerPosition.y}px`,
              transform: 'translateX(-50%)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3">
              <div className="text-sm font-semibold text-slate-900">Select Color</div>
              <div className="text-xs text-slate-500 mt-1">
                {colorPickerOpen}
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2 mb-3 max-h-64 overflow-y-auto">
              {MAILBOX_COLORS.map((color, index) => {
                const isSelected =
                  getMailboxColor(colorPickerOpen, customMailboxColors).bg === color.bg;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleColorSelect(colorPickerOpen, color)}
                    className={`w-10 h-10 rounded-lg border-2 transition hover:scale-110 ${
                      isSelected
                        ? 'border-slate-900 ring-2 ring-slate-300'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                    style={{ backgroundColor: color.bg }}
                    title={`${color.bg}`}
                  />
                );
              })}
            </div>
            {customMailboxColors[normalizeMailbox(colorPickerOpen)] ? (
              <button
                type="button"
                onClick={() => handleColorReset(colorPickerOpen)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Reset to Default
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}

