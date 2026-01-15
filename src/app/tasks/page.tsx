'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Save, XCircle, Users, ChevronDown, TrendingUp, Clock, AlertCircle, CheckCircle2, Calendar, Target, BarChart3, UserCheck } from 'lucide-react';
import TopNav from '../../components/TopNav';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { ClientUser } from '../../lib/auth';

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

type TaskAssignee = {
  id: string;
  userName: string;
  email?: string | null;
  avatarUrl?: string | null;
};

type Task = {
  id: string;
  title: string;
  detail?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignees: TaskAssignee[];
  project?: string | null;
  tags: string[];
  notes?: string | null;
  href?: string | null;
  createdBy?: string | null;
  createdAt: string;
  rejectionReason?: string | null;
};

// Temporary adapter: Backend still uses "summary", frontend uses "detail"
// TODO: Remove these functions once backend is updated to use "detail"
function taskFromBackend(task: any): Task {
  return {
    ...task,
    detail: task.summary ?? task.detail ?? null,
  };
}

function taskToBackend(payload: any): any {
  const { detail, ...rest } = payload;
  return {
    ...rest,
    summary: detail,
  };
}

const STATUS_STYLES: Record<TaskStatus, { label: string; chip: string; dot: string }> = {
  todo: {
    label: 'To do',
    chip: 'border border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  in_progress: {
    label: 'In progress',
    chip: 'border border-sky-200 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
  },
  in_review: {
    label: 'In review',
    chip: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  done: {
    label: 'Done',
    chip: 'border border-slate-200 bg-slate-100 text-slate-700',
    dot: 'bg-slate-900',
  },
};

const PRIORITY_STYLES: Record<TaskPriority, { label: string; chip: string }> = {
  low: {
    label: 'Low',
    chip: 'border border-slate-200 bg-white text-slate-600',
  },
  medium: {
    label: 'Medium',
    chip: 'border border-amber-200 bg-amber-50 text-amber-700',
  },
  high: {
    label: 'High',
    chip: 'border border-orange-200 bg-orange-50 text-orange-700',
  },
  urgent: {
    label: 'Urgent',
    chip: 'border border-rose-200 bg-rose-100 text-rose-700',
  },
};


const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

const DEFAULT_TASK_DRAFT = {
  title: '',
  detail: '',
  priority: 'medium' as TaskPriority,
  dueDate: '',
  project: '',
  tags: '',
  notes: '',
  href: '',
  assigneeIds: [] as string[],
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value?: string | null) {
  if (!value) return new Date(NaN);
  return new Date(`${value}T00:00:00`);
}

function startOfWeek(value: Date) {
  const dayIndex = value.getDay();
  const offset = (dayIndex + 6) % 7;
  const start = new Date(value);
  start.setDate(value.getDate() - offset);
  return startOfDay(start);
}

function endOfWeek(value: Date) {
  const start = startOfWeek(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return startOfDay(end);
}

function formatShortDate(value?: string | null) {
  if (!value) return 'none set';
  const date = parseDateKey(value);
  if (Number.isNaN(date.getTime())) return 'none set';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatCreatedAt(value?: string | null) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function diffInDays(from: Date, to: Date) {
  const fromDay = startOfDay(from).getTime();
  const toDay = startOfDay(to).getTime();
  return Math.round((toDay - fromDay) / (1000 * 60 * 60 * 24));
}

function formatDueLabel(task: Task, today: Date) {
  const dueDate = parseDateKey(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) return 'none set';
  const diff = diffInDays(today, dueDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  if (dueDate >= weekStart && dueDate <= weekEnd) {
    return 'this week';
  }
  if (
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth()
  ) {
    return 'this month';
  }
  return formatShortDate(task.dueDate);
}

function buildDeadlineBadge(task: Task, today: Date) {
  const label = formatDueLabel(task, today);
  if (label === 'overdue') {
    return { label, chip: 'border border-rose-200 bg-rose-50 text-rose-700' };
  }
  if (label === 'today') {
    return { label, chip: 'border border-rose-200 bg-rose-50 text-rose-700' };
  }
  if (label === 'this week') {
    return { label, chip: 'border border-amber-200 bg-amber-50 text-amber-700' };
  }
  if (label === 'this month') {
    return { label, chip: 'border border-teal-200 bg-teal-50 text-teal-700' };
  }
  if (label.startsWith('in ')) {
    return { label, chip: 'border border-sky-200 bg-sky-50 text-sky-700' };
  }
  return { label, chip: 'border border-slate-200 bg-white text-slate-600' };
}

function formatAssignees(assignees: TaskAssignee[]) {
  const cleaned = assignees
    .map((assignee) => {
      const name = assignee.userName?.trim();
      const email = assignee.email?.trim();
      return name || email || '';
    })
    .filter(Boolean);
  return cleaned.length ? cleaned.join(', ') : 'Unassigned';
}

type NoteEntry = {
  author: string;
  timestamp: string;
  text: string;
};

function parseTaskNotes(notes?: string | null): NoteEntry[] {
  if (!notes) return [];
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^-\s*(.+?)\s*-\s*([^:]+):\s*(.+)$/);
      if (match) {
        return {
          timestamp: match[1].trim(),
          author: match[2].trim(),
          text: match[3].trim(),
        };
      }
      return { timestamp: '', author: '', text: line };
    });
}

function getInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : parts[0]?.[1] ?? '';
  const initials = `${first}${second}`.toUpperCase();
  return initials || '?';
}


function StatCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'slate' | 'amber' | 'rose' | 'emerald';
}) {
  const tones: Record<typeof tone, string> = {
    slate: 'border-slate-200 bg-white text-slate-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${tones[tone]}`}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-500">{helper}</div>
    </div>
  );
}

type SidebarView = 'dashboard' | 'mine' | 'all' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'done_requests' | 'assign_requests';

export default function TasksPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [sidebarView, setSidebarView] = useState<SidebarView>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [sortKey, setSortKey] = useState<'due' | 'priority' | 'created'>('priority');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState({ ...DEFAULT_TASK_DRAFT });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [assigneesDropdownOpen, setAssigneesDropdownOpen] = useState(false);
  const assigneesDropdownRef = useRef<HTMLDivElement>(null);
  const [requestAssigneeIds, setRequestAssigneeIds] = useState<string[]>([]);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [assignDraftIds, setAssignDraftIds] = useState<string[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selfAssignSaving, setSelfAssignSaving] = useState(false);
  const [selfAssignError, setSelfAssignError] = useState('');
  const [selfAssignSuccess, setSelfAssignSuccess] = useState('');
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminEditDraft, setAdminEditDraft] = useState({
    dueDate: '',
    detail: '',
    notes: '',
  });
  const [adminEditSaving, setAdminEditSaving] = useState(false);
  const [adminEditError, setAdminEditError] = useState('');
  const [adminEditSuccess, setAdminEditSuccess] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [noteSuccess, setNoteSuccess] = useState('');
  const [doneSaving, setDoneSaving] = useState(false);
  const [doneError, setDoneError] = useState('');
  const [doneSuccess, setDoneSuccess] = useState('');
  const isAdmin = user?.role === 'ADMIN';
  const [doneRequests, setDoneRequests] = useState<any[]>([]);
  const [doneRequestsLoading, setDoneRequestsLoading] = useState(false);
  const [assignRequests, setAssignRequests] = useState<any[]>([]);
  const [assignRequestsLoading, setAssignRequestsLoading] = useState(false);
  const [doneRequestsSearch, setDoneRequestsSearch] = useState('');
  const [doneRequestsSortBy, setDoneRequestsSortBy] = useState<'who' | 'when'>('when');
  const [assignRequestsSearch, setAssignRequestsSearch] = useState('');
  const [assignRequestsSortBy, setAssignRequestsSortBy] = useState<'who' | 'when' | 'task'>('when');
  const [rejectReasonModalOpen, setRejectReasonModalOpen] = useState(false);
  const [rejectReasonDraft, setRejectReasonDraft] = useState('');
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const isManager = user?.role === 'MANAGER';
  const canCreate = isAdmin || isManager;

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace('/auth');
    }
  }, [loading, user, token, router]);

  const loadTasks = useCallback(async () => {
    if (!token) return;
    setTasksLoading(true);
    setTasksError('');
    try {
      const data = await api<any[]>('/tasks', undefined, token);
      setTasks(Array.isArray(data) ? data.map(taskFromBackend) : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tasks.';
      setTasksError(message);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    if (!token || !canCreate) return;
    setUsersLoading(true);
    setUsersError('');
    try {
      const data = await api<ClientUser[]>('/users', undefined, token);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users.';
      setUsersError(message);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [token, canCreate]);

  useEffect(() => {
    if (loading || !user || !token) return;
    void loadTasks();
  }, [loading, user, token, loadTasks]);

  useEffect(() => {
    if (loading || !user || !token) return;
    void loadUsers();
  }, [loading, user, token, loadUsers]);

  const loadDoneRequests = useCallback(async () => {
    if (!token || !isAdmin) return;
    setDoneRequestsLoading(true);
    try {
      const data = await api<any[]>('/tasks/done-requests?status=pending', undefined, token);
      setDoneRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load done requests:', err);
      setDoneRequests([]);
    } finally {
      setDoneRequestsLoading(false);
    }
  }, [token, isAdmin]);

  const loadAssignRequests = useCallback(async () => {
    if (!token || !isAdmin) return;
    setAssignRequestsLoading(true);
    try {
      const data = await api<any[]>('/tasks/assign-requests?status=pending', undefined, token);
      setAssignRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load assign requests:', err);
      setAssignRequests([]);
    } finally {
      setAssignRequestsLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (loading || !user || !token || !isAdmin) return;
    if (sidebarView === 'done_requests') {
      void loadDoneRequests();
    } else if (sidebarView === 'assign_requests') {
      void loadAssignRequests();
    }
  }, [loading, user, token, isAdmin, sidebarView, loadDoneRequests, loadAssignRequests]);

  const toggleSelection = (
    setValue: (value: string[] | ((prev: string[]) => string[])) => void,
    id: string,
  ) => {
    setValue((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const openTaskModal = (taskId: string) => {
    setSelectedTaskId(taskId);
    setTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setTaskModalOpen(false);
    setSelectedTaskId('');
    setAssignModalOpen(false);
    setAdminEditOpen(false);
  };

  const handleCreateTask = async () => {
    if (!token || !canCreate) return;
    setCreateError('');
    setCreateSuccess('');
    const title = createDraft.title.trim();
    if (!title) {
      setCreateError('Task title is required.');
      return;
    }
    const dueDate = createDraft.dueDate || null;
    const payload = {
      title,
      detail: createDraft.detail.trim() || null,
      status: 'todo' as TaskStatus,
      priority: createDraft.priority,
      dueDate,
      project: createDraft.project.trim() || null,
      notes: createDraft.notes.trim() || null,
      tags: createDraft.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      href: createDraft.href.trim() || null,
      assigneeIds: createDraft.assigneeIds,
    };
    setCreateSaving(true);
    try {
      await api('/tasks', { method: 'POST', body: JSON.stringify(taskToBackend(payload)) }, token);
      setCreateSuccess(
        isAdmin ? 'Task created and assigned.' : 'Task request sent for approval.',
      );
      setCreateDraft({ ...DEFAULT_TASK_DRAFT });
      setAssigneesDropdownOpen(false);
      setCreateOpen(false);
      await loadTasks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create task.';
      setCreateError(message);
    } finally {
      setCreateSaving(false);
    }
  };

  const handleRequestAssignees = async () => {
    if (!token || !focusedTask) return;
    setRequestError('');
    setRequestSuccess('');
    if (!requestAssigneeIds.length) {
      setRequestError('Pick at least one assignee to request.');
      return;
    }
    setRequestSaving(true);
    try {
      await api(
        `/tasks/${focusedTask.id}/assign-requests`,
        { method: 'POST', body: JSON.stringify({ assigneeIds: requestAssigneeIds }) },
        token,
      );
      setRequestSuccess('Assignment request sent to admin.');
      setRequestAssigneeIds([]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to request assignments.';
      setRequestError(message);
    } finally {
      setRequestSaving(false);
    }
  };

  const handleSaveNote = async () => {
    if (!token || !focusedTask || !canActOnTask) return;
    setNoteError('');
    setNoteSuccess('');
    const notes = noteDraft.trim();
    if (!notes) {
      setNoteError('Note is required.');
      return;
    }
    setNoteSaving(true);
    try {
      await api(
        `/tasks/${focusedTask.id}/notes`,
        { method: 'PATCH', body: JSON.stringify({ note: notes }) },
        token,
      );
      setNoteSuccess('Note added.');
      setNoteDraft('');
      await loadTasks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save note.';
      setNoteError(message);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDoneRequest = async () => {
    if (!token || !focusedTask || !canActOnTask) return;
    setDoneSaving(true);
    setDoneError('');
    setDoneSuccess('');
    try {
      await api(`/tasks/${focusedTask.id}/done-requests`, { method: 'POST' }, token);
      setDoneSuccess('Done request sent to admin.');
      await loadTasks();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to request completion.';
      setDoneError(message);
    } finally {
      setDoneSaving(false);
    }
  };

  const handleRequestAssign = async () => {
    if (!token || !focusedTask || readOnly || isAdmin) return;
    setSelfAssignSaving(true);
    setSelfAssignError('');
    setSelfAssignSuccess('');
    try {
      await api(`/tasks/${focusedTask.id}/assign-self-request`, { method: 'POST' }, token);
      setSelfAssignSuccess('Assignment request sent to admin.');
      await loadTasks();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to request assignment.';
      setSelfAssignError(message);
    } finally {
      setSelfAssignSaving(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!token || !focusedTask || readOnly || isAdmin) return;
    setSelfAssignSaving(true);
    setSelfAssignError('');
    setSelfAssignSuccess('');
    try {
      await api(`/tasks/${focusedTask.id}/assign-self`, { method: 'POST' }, token);
      setSelfAssignSuccess('You are now assigned.');
      await loadTasks();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to assign to you.';
      setSelfAssignError(message);
    } finally {
      setSelfAssignSaving(false);
    }
  };

  const toggleDraftAssignee = (userId: string) => {
    setCreateDraft((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter((id) => id !== userId)
        : [...prev.assigneeIds, userId],
    }));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        assigneesDropdownRef.current &&
        !assigneesDropdownRef.current.contains(event.target as Node)
      ) {
        setAssigneesDropdownOpen(false);
      }
    };

    if (assigneesDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [assigneesDropdownOpen]);

  const toggleAssignDraft = (userId: string) => {
    setAssignDraftIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleAssignUsers = async () => {
    if (!token || !focusedTask || !isAdmin) return;
    setAssignSaving(true);
    setAssignError('');
    setAssignSuccess('');
    try {
      await api(
        `/tasks/${focusedTask.id}`,
        { method: 'PATCH', body: JSON.stringify({ assigneeIds: assignDraftIds }) },
        token,
      );
      setAssignSuccess('Assignments updated.');
      await loadTasks();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to update assignments.';
      setAssignError(message);
    } finally {
      setAssignSaving(false);
    }
  };

  const openAssignModal = () => {
    if (!isAdmin) return;
    setAssignError('');
    setAssignSuccess('');
    setAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
  };

  const startAdminEdit = () => {
    if (!isAdmin || !focusedTask) return;
    setAdminEditDraft({
      dueDate: focusedTask.dueDate ?? '',
      detail: focusedTask.detail?.trim() ?? '',
      notes: focusedTask.notes ?? '',
    });
    setAdminEditOpen(true);
    setAdminEditError('');
    setAdminEditSuccess('');
  };

  const cancelAdminEdit = () => {
    setAdminEditOpen(false);
    if (focusedTask) {
      setAdminEditDraft({
        dueDate: focusedTask.dueDate ?? '',
        detail: focusedTask.detail?.trim() ?? '',
        notes: focusedTask.notes ?? '',
      });
    }
    setAdminEditError('');
    setAdminEditSuccess('');
  };

  const handleAdminEditSave = async () => {
    if (!token || !focusedTask || !isAdmin) return;
    setAdminEditSaving(true);
    setAdminEditError('');
    setAdminEditSuccess('');
    try {
      const payload = {
        dueDate: adminEditDraft.dueDate.trim() || null,
        detail: adminEditDraft.detail.trim() || null,
        notes: adminEditDraft.notes.trim() || null,
      };
      await api(
        `/tasks/${focusedTask.id}`,
        { method: 'PATCH', body: JSON.stringify(taskToBackend(payload)) },
        token,
      );
      setAdminEditSuccess('Task updated.');
      setAdminEditOpen(false);
      await loadTasks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update task.';
      setAdminEditError(message);
    } finally {
      setAdminEditSaving(false);
    }
  };

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const userId = user?.id ?? '';
    return tasks.filter((task) => {
      // Filter by sidebar view
      if (sidebarView === 'mine') {
        if (!userId) return false;
        const isAssigned = task.assignees.some((assignee) => assignee.id === userId);
        if (!isAssigned) return false;
      } else if (sidebarView === 'all') {
        // Show all tasks regardless of status
      } else if (sidebarView === 'todo') {
        if (task.status !== 'todo') return false;
      } else if (sidebarView === 'in_progress') {
        if (task.status !== 'in_progress') return false;
      } else if (sidebarView === 'in_review') {
        if (task.status !== 'in_review') return false;
      } else if (sidebarView === 'done') {
        if (task.status !== 'done') return false;
      }
      // dashboard shows all non-done tasks
      if (sidebarView === 'dashboard' && task.status === 'done') return false;
      
      // Filter by priority
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      
      // Filter by search query
      if (query) {
        const assigneeText = task.assignees
          .map((assignee) => `${assignee.userName ?? ''} ${assignee.email ?? ''}`.trim())
          .filter(Boolean)
          .join(' ');
        const target = [
          task.title,
          task.detail,
          assigneeText,
          task.project,
          task.tags.join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!target.includes(query)) return false;
      }
      
      return true;
    });
  }, [tasks, sidebarView, priorityFilter, searchQuery, user?.id]);

  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    sorted.sort((a, b) => {
      if (sortKey === 'priority') {
        return (
          PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
        );
      }
      if (sortKey === 'created') {
        const aCreated = a.createdAt ?? '';
        const bCreated = b.createdAt ?? '';
        return bCreated.localeCompare(aCreated);
      }
      const aDue = a.dueDate ?? '9999-12-31';
      const bDue = b.dueDate ?? '9999-12-31';
      return aDue.localeCompare(bDue);
    });
    return sorted;
  }, [filteredTasks, sortKey]);

  useEffect(() => {
    if (!selectedTaskId) return;
    const current = sortedTasks.find((task) => task.id === selectedTaskId);
    if (!current) {
      setSelectedTaskId('');
      setTaskModalOpen(false);
    }
  }, [sortedTasks, selectedTaskId]);

  useEffect(() => {
    setRequestAssigneeIds([]);
    setRequestError('');
    setRequestSuccess('');
  }, [selectedTaskId]);

  const focusedTask = sortedTasks.find((task) => task.id === selectedTaskId) ?? null;
  const noteEntries = useMemo(
    () => parseTaskNotes(focusedTask?.notes),
    [focusedTask?.notes],
  );
  const canRequestAssignees =
    isManager && focusedTask?.createdBy === user?.id;
  const assignedAssigneeIds = new Set(
    focusedTask?.assignees.map((assignee) => assignee.id) ?? [],
  );
  const isAssignedToUser = Boolean(
    focusedTask?.assignees.some((assignee) => assignee.id === user?.id),
  );
  const today = new Date();
  const todayKey = toDateKey(today);
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const weekStartKey = toDateKey(weekStart);
  const weekEndKey = toDateKey(weekEnd);
  
  const openCount = tasks.filter((task) => task.status !== 'done').length;
  const doneCount = tasks.filter((task) => task.status === 'done').length;
  const dueTodayCount = tasks.filter((task) => task.dueDate === todayKey).length;
  const overdueCount = tasks.filter((task) => {
    if (task.status === 'done') return false;
    if (!task.dueDate) return false;
    return task.dueDate < todayKey;
  }).length;
  
  // Additional dashboard statistics
  const todoCount = tasks.filter((task) => task.status === 'todo').length;
  const inProgressCount = tasks.filter((task) => task.status === 'in_progress').length;
  const inReviewCount = tasks.filter((task) => task.status === 'in_review').length;
  const urgentCount = tasks.filter((task) => task.priority === 'urgent' && task.status !== 'done').length;
  const highPriorityCount = tasks.filter((task) => task.priority === 'high' && task.status !== 'done').length;
  const dueThisWeekCount = tasks.filter((task) => {
    if (task.status === 'done') return false;
    if (!task.dueDate) return false;
    return task.dueDate >= weekStartKey && task.dueDate <= weekEndKey;
  }).length;
  const myTasksCount = tasks.filter((task) => {
    if (!user?.id) return false;
    return task.assignees.some((assignee) => assignee.id === user.id) && task.status !== 'done';
  }).length;
  const unassignedCount = tasks.filter((task) => task.assignees.length === 0 && task.status !== 'done').length;
  const recentTasksCount = tasks.filter((task) => {
    const created = new Date(task.createdAt);
    const daysSince = diffInDays(created, today);
    return daysSince <= 7 && task.status !== 'done';
  }).length;
  
  const readOnly = user?.role === 'OBSERVER';
  const canActOnTask = !readOnly && isAssignedToUser;

  useEffect(() => {
    if (!focusedTask) {
      setNoteDraft('');
      setNoteOpen(false);
      setNoteError('');
      setNoteSuccess('');
      setDoneError('');
      setDoneSuccess('');
      setAssignDraftIds([]);
      setAssignError('');
      setAssignSuccess('');
      setSelfAssignError('');
      setSelfAssignSuccess('');
      setAdminEditOpen(false);
      setAdminEditDraft({ dueDate: '', detail: '', notes: '' });
      setAdminEditError('');
      setAdminEditSuccess('');
      setAssignModalOpen(false);
      return;
    }
    setNoteDraft('');
    setNoteOpen(false);
    setNoteError('');
    setNoteSuccess('');
    setDoneError('');
    setDoneSuccess('');
    setAssignDraftIds(focusedTask.assignees.map((assignee) => assignee.id));
    setAssignError('');
    setAssignSuccess('');
    setSelfAssignError('');
    setSelfAssignSuccess('');
    setAdminEditOpen(false);
    setAdminEditDraft({
      dueDate: focusedTask.dueDate ?? '',
      detail: focusedTask.detail?.trim() ?? '',
      notes: focusedTask.notes ?? '',
    });
    setAdminEditError('');
    setAdminEditSuccess('');
    setAssignModalOpen(false);
  }, [focusedTask]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
        <TopNav />
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Loading tasks...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
      <TopNav />
      <div className="mx-auto w-full min-h-screen pt-[57px]">
        {tasksError ? (
          <div className="mx-4 mt-4 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {tasksError}
          </div>
        ) : null}
        <div className="grid gap-4 min-h-screen xl:grid-cols-[280px_1fr]">
          <section className="flex flex-col gap-2 bg-[#0b1224] text-slate-100" style={{ boxShadow: '0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224' }}>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Tasks</p>
                  <h1 className="text-lg font-semibold text-slate-100">Task Center</h1>
                </div>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setSidebarView('dashboard')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    sidebarView === 'dashboard'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => setSidebarView('mine')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    sidebarView === 'mine'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Mine</span>
                </button>
                <button
                  onClick={() => setSidebarView('all')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    sidebarView === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span>All</span>
                </button>
                <div className="my-2 border-t border-slate-700"></div>
                <button
                  onClick={() => setSidebarView('todo')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    sidebarView === 'todo'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>To Do</span>
                </button>
                <button
                  onClick={() => setSidebarView('in_progress')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    sidebarView === 'in_progress'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>In Progress</span>
                </button>
                <button
                  onClick={() => setSidebarView('in_review')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    sidebarView === 'in_review'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>In Review</span>
                </button>
                <button
                  onClick={() => setSidebarView('done')}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    sidebarView === 'done'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Done</span>
                </button>
                {isAdmin && (
                  <>
                    <div className="my-2 border-t border-slate-700"></div>
                    <button
                      onClick={() => setSidebarView('done_requests')}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        sidebarView === 'done_requests'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span>Done Requests</span>
                    </button>
                    <button
                      onClick={() => setSidebarView('assign_requests')}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        sidebarView === 'assign_requests'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      <span>Assign Requests</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
          <div className="flex flex-col gap-6 px-4 py-8">
            <header className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/20">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                    Tasks
                  </p>
                  <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                    {sidebarView === 'dashboard' && 'Task command center'}
                    {sidebarView === 'mine' && 'My Tasks'}
                    {sidebarView === 'all' && 'All Tasks'}
                    {sidebarView === 'todo' && 'To Do Tasks'}
                    {sidebarView === 'in_progress' && 'In Progress Tasks'}
                    {sidebarView === 'in_review' && 'In Review Tasks'}
                    {sidebarView === 'done' && 'Completed Tasks'}
                    {sidebarView === 'done_requests' && 'Done Requests'}
                    {sidebarView === 'assign_requests' && 'Assign Requests'}
                  </h1>
                </div>
              </div>
              <p className="max-w-2xl text-base leading-relaxed text-slate-600">
                {sidebarView === 'dashboard' && 'Track onboarding, review queues, and follow-ups across your active profiles.'}
                {sidebarView === 'mine' && 'Tasks assigned to you across all statuses.'}
                {sidebarView === 'all' && 'All tasks across all statuses.'}
                {sidebarView === 'todo' && 'Tasks that are ready to be started.'}
                {sidebarView === 'in_progress' && 'Tasks currently being worked on.'}
                {sidebarView === 'in_review' && 'Tasks awaiting review and approval.'}
                {sidebarView === 'done' && 'Tasks that have been completed.'}
                {sidebarView === 'done_requests' && 'Review requests to mark tasks as done.'}
                {sidebarView === 'assign_requests' && 'Review requests to assign users to tasks.'}
              </p>
            </header>

            {sidebarView === 'dashboard' && (
              <section className="space-y-6">
                {/* Primary Metrics */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard 
                    label="Open tasks" 
                    value={String(openCount)} 
                    helper="Need action" 
                    tone="slate" 
                  />
                  <StatCard 
                    label="Due today" 
                    value={String(dueTodayCount)} 
                    helper="Priority focus" 
                    tone="amber" 
                  />
                  <StatCard 
                    label="Overdue" 
                    value={String(overdueCount)} 
                    helper="Requires follow-up" 
                    tone="rose" 
                  />
                  <StatCard 
                    label="Completed" 
                    value={String(doneCount)} 
                    helper="Closed this cycle" 
                    tone="emerald" 
                  />
                </div>

                {/* Secondary Metrics Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-sky-600">My Tasks</div>
                        <div className="mt-1 text-2xl font-semibold text-sky-900">{myTasksCount}</div>
                        <div className="text-xs text-sky-600">Assigned to me</div>
                      </div>
                      <UserCheck className="w-8 h-8 text-sky-400" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-amber-600">Due This Week</div>
                        <div className="mt-1 text-2xl font-semibold text-amber-900">{dueThisWeekCount}</div>
                        <div className="text-xs text-amber-600">Upcoming deadlines</div>
                      </div>
                      <Calendar className="w-8 h-8 text-amber-400" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-rose-600">Urgent</div>
                        <div className="mt-1 text-2xl font-semibold text-rose-900">{urgentCount}</div>
                        <div className="text-xs text-rose-600">Requires attention</div>
                      </div>
                      <AlertCircle className="w-8 h-8 text-rose-400" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-600">In Review</div>
                        <div className="mt-1 text-2xl font-semibold text-emerald-900">{inReviewCount}</div>
                        <div className="text-xs text-emerald-600">Awaiting approval</div>
                      </div>
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </div>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-slate-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Status Breakdown</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">To Do</span>
                        <span className="text-sm font-semibold text-slate-900">{todoCount}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: openCount > 0 ? `${(todoCount / openCount) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">In Progress</span>
                        <span className="text-sm font-semibold text-slate-900">{inProgressCount}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-sky-500 rounded-full transition-all"
                          style={{ width: openCount > 0 ? `${(inProgressCount / openCount) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">In Review</span>
                        <span className="text-sm font-semibold text-slate-900">{inReviewCount}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: openCount > 0 ? `${(inReviewCount / openCount) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Done</span>
                        <span className="text-sm font-semibold text-slate-900">{doneCount}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-slate-900 rounded-full transition-all"
                          style={{ width: tasks.length > 0 ? `${(doneCount / tasks.length) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Priority & Additional Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-5 h-5 text-slate-600" />
                      <h3 className="text-lg font-semibold text-slate-900">Priority Overview</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span className="text-sm font-medium text-rose-900">Urgent</span>
                        </div>
                        <span className="text-sm font-semibold text-rose-900">{urgentCount}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-200">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-orange-600" />
                          <span className="text-sm font-medium text-orange-900">High</span>
                        </div>
                        <span className="text-sm font-semibold text-orange-900">{highPriorityCount}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-900">Medium</span>
                        </div>
                        <span className="text-sm font-semibold text-amber-900">
                          {tasks.filter((task) => task.priority === 'medium' && task.status !== 'done').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">Low</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {tasks.filter((task) => task.priority === 'low' && task.status !== 'done').length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-5 h-5 text-slate-600" />
                      <h3 className="text-lg font-semibold text-slate-900">Quick Insights</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-sm text-slate-600">Unassigned Tasks</span>
                        <span className="text-sm font-semibold text-slate-900">{unassignedCount}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-sm text-slate-600">Recent (Last 7 Days)</span>
                        <span className="text-sm font-semibold text-slate-900">{recentTasksCount}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-sm text-slate-600">Total Tasks</span>
                        <span className="text-sm font-semibold text-slate-900">{tasks.length}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-sm text-slate-600">Completion Rate</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="space-y-4">
            {sidebarView !== 'dashboard' && sidebarView !== 'done_requests' && sidebarView !== 'assign_requests' && (
              <div className="relative rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by task, assignee, project, or tag..."
                  className="w-full rounded-lg border-0 bg-transparent pl-8 pr-0 py-0 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0"
                />
              </div>
            )}
            {sidebarView !== 'dashboard' && sidebarView !== 'done_requests' && sidebarView !== 'assign_requests' && (
              <div className="flex items-center gap-3">
                <div className="ml-auto flex flex-wrap items-center gap-3">
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Priority</span>
                    <select
                      value={priorityFilter}
                      onChange={(event) =>
                        setPriorityFilter(event.target.value as 'all' | TaskPriority)
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-transparent focus:ring-slate-300"
                    >
                      <option value="all">All</option>
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <span className="inline-flex h-5 w-5 items-center justify-center text-slate-500">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M7 3v18" />
                      <path d="M3 7l4-4 4 4" />
                      <path d="M17 21V3" />
                      <path d="M13 17l4 4 4-4" />
                    </svg>
                  </span>
                  <span className="text-[11px] tracking-[0.18em] text-slate-500 normal-case">
                    by
                  </span>
                  <div className="relative">
                    <select
                      aria-label="Sort tasks"
                      value={sortKey}
                      onChange={(event) =>
                        setSortKey(event.target.value as 'due' | 'priority' | 'created')
                      }
                      className="appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2 pr-9 text-sm text-slate-800 outline-none ring-1 ring-transparent focus:ring-slate-300"
                    >
                      <option value="due">Due date</option>
                      <option value="priority">Priority</option>
                      <option value="created">Created</option>
                    </select>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
            {sidebarView === 'done_requests' && isAdmin && (
              <div className="space-y-4">
                <div className="relative rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={doneRequestsSearch}
                    onChange={(e) => setDoneRequestsSearch(e.target.value)}
                    placeholder="Search by title, requester, or assignee..."
                    className="w-full rounded-lg border-0 bg-transparent pl-8 pr-0 py-0 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-[11px] tracking-[0.18em] text-slate-500">Sort by</span>
                    <select
                      value={doneRequestsSortBy}
                      onChange={(e) => setDoneRequestsSortBy(e.target.value as 'who' | 'when')}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 pr-9 text-sm text-slate-800 outline-none ring-1 ring-transparent focus:ring-slate-300"
                    >
                      <option value="when">When</option>
                      <option value="who">Who</option>
                    </select>
                  </div>
                </div>
                {doneRequestsLoading ? (
                  <div className="rounded-3xl border border-slate-200 bg-white/80 px-5 py-6 text-sm text-slate-600">
                    Loading done requests...
                  </div>
                ) : (() => {
                  const filtered = doneRequests.filter((req) => {
                    const search = doneRequestsSearch.toLowerCase();
                    return (
                      req.taskTitle?.toLowerCase().includes(search) ||
                      req.requesterName?.toLowerCase().includes(search) ||
                      req.requesterEmail?.toLowerCase().includes(search)
                    );
                  });
                  const sorted = [...filtered].sort((a, b) => {
                    if (doneRequestsSortBy === 'when') {
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    } else {
                      return (a.requesterName || '').localeCompare(b.requesterName || '');
                    }
                  });
                  const taskMap = new Map(tasks.map(t => [t.id, t]));
                  return sorted.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-5 py-6 text-center">
                      <div className="text-sm font-medium text-slate-500">No done requests found</div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Title</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Request By</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Assigned</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Request At</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sorted.map((req, index) => {
                            const task = taskMap.get(req.taskId);
                            const assignees = task?.assignees || [];
                            const assigneeNames = assignees.map(a => a.userName).join(', ') || 'Unassigned';
                            const handleApprove = async () => {
                              if (!token) return;
                              try {
                                await api(`/tasks/done-requests/${req.id}/approve`, { method: 'POST' }, token);
                                await loadDoneRequests();
                                await loadTasks();
                              } catch (err) {
                                console.error('Failed to approve:', err);
                              }
                            };
                            const handleReject = () => {
                              setRejectingRequestId(req.id);
                              setRejectReasonDraft('');
                              setRejectReasonModalOpen(true);
                            };
                            return (
                              <tr key={req.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm text-slate-900">{index + 1}</td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => openTaskModal(req.taskId)}
                                    className="text-sm font-medium text-slate-900 hover:text-slate-700 text-left"
                                  >
                                    {req.taskTitle || 'Untitled'}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">{req.requesterName || req.requesterEmail || 'Unknown'}</td>
                                <td className="px-4 py-3 text-sm text-slate-700">{assigneeNames}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{new Date(req.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={handleApprove}
                                      className="rounded-lg bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                      title="Accept"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={handleReject}
                                      className="rounded-lg bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 transition-colors"
                                      title="Reject"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {sidebarView === 'assign_requests' && isAdmin && (
              <div className="space-y-4">
                <div className="relative rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={assignRequestsSearch}
                    onChange={(e) => setAssignRequestsSearch(e.target.value)}
                    placeholder="Search by title, requester, or assignee..."
                    className="w-full rounded-lg border-0 bg-transparent pl-8 pr-0 py-0 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-[11px] tracking-[0.18em] text-slate-500">Sort by</span>
                    <select
                      value={assignRequestsSortBy}
                      onChange={(e) => setAssignRequestsSortBy(e.target.value as 'who' | 'when' | 'task')}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 pr-9 text-sm text-slate-800 outline-none ring-1 ring-transparent focus:ring-slate-300"
                    >
                      <option value="when">When</option>
                      <option value="who">Who</option>
                      <option value="task">Task</option>
                    </select>
                  </div>
                </div>
                {assignRequestsLoading ? (
                  <div className="rounded-3xl border border-slate-200 bg-white/80 px-5 py-6 text-sm text-slate-600">
                    Loading assign requests...
                  </div>
                ) : (() => {
                  const filtered = assignRequests.filter((req) => {
                    const search = assignRequestsSearch.toLowerCase();
                    return (
                      req.taskTitle?.toLowerCase().includes(search) ||
                      req.requesterName?.toLowerCase().includes(search) ||
                      req.requesterEmail?.toLowerCase().includes(search) ||
                      req.assigneeName?.toLowerCase().includes(search) ||
                      req.assigneeEmail?.toLowerCase().includes(search)
                    );
                  });
                  const sorted = [...filtered].sort((a, b) => {
                    if (assignRequestsSortBy === 'when') {
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    } else if (assignRequestsSortBy === 'who') {
                      return (a.requesterName || '').localeCompare(b.requesterName || '');
                    } else {
                      return (a.taskTitle || '').localeCompare(b.taskTitle || '');
                    }
                  });
                  return sorted.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-5 py-6 text-center">
                      <div className="text-sm font-medium text-slate-500">No assign requests found</div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Title</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Send By</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Send At</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sorted.map((req, index) => {
                            const handleApprove = async () => {
                              if (!token) return;
                              try {
                                await api(`/tasks/assign-requests/${req.id}/approve`, { method: 'POST' }, token);
                                await loadAssignRequests();
                                await loadTasks();
                              } catch (err) {
                                console.error('Failed to approve:', err);
                              }
                            };
                            const handleReject = async () => {
                              if (!token) return;
                              try {
                                await api(`/tasks/assign-requests/${req.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: null }) }, token);
                                await loadAssignRequests();
                                await loadTasks();
                              } catch (err) {
                                console.error('Failed to reject:', err);
                              }
                            };
                            return (
                              <tr key={req.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm text-slate-900">{index + 1}</td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => openTaskModal(req.taskId)}
                                    className="text-sm font-medium text-slate-900 hover:text-slate-700 text-left"
                                  >
                                    {req.taskTitle || 'Untitled'}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">{req.requesterName || req.requesterEmail || 'Unknown'}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{new Date(req.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={handleApprove}
                                      className="rounded-lg bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                      title="Accept"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={handleReject}
                                      className="rounded-lg bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 transition-colors"
                                      title="Reject"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {sidebarView !== 'dashboard' && sidebarView !== 'done_requests' && sidebarView !== 'assign_requests' && (
              <>
                {tasksLoading ? (
                  <div className="rounded-3xl border border-slate-200 bg-white/80 px-5 py-6 text-sm text-slate-600">
                    Loading tasks...
                  </div>
                ) : sortedTasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-5 py-6 text-center">
                    <div className="text-slate-400 mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="text-sm font-medium text-slate-500">No tasks found</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {sidebarView === 'mine' && 'You have no assigned tasks.'}
                      {sidebarView === 'all' && 'No tasks available.'}
                      {sidebarView === 'todo' && 'No tasks in To Do status.'}
                      {sidebarView === 'in_progress' && 'No tasks in progress.'}
                      {sidebarView === 'in_review' && 'No tasks in review.'}
                      {sidebarView === 'done' && 'No completed tasks.'}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-500 mb-2">
                      Showing {sortedTasks.length} task{sortedTasks.length === 1 ? '' : 's'}
                    </div>
                    {sortedTasks.map((task) => {
                const status = STATUS_STYLES[task.status];
                const priority = PRIORITY_STYLES[task.priority];
                const deadlineBadge = buildDeadlineBadge(task, today);
                const dueDiff = diffInDays(today, parseDateKey(task.dueDate));
                const dueDateLabel = formatShortDate(task.dueDate);
                const isSelected = task.id === focusedTask?.id;
                const detailText = task.detail?.trim();
                const dueTone =
                  task.status === 'done'
                    ? 'text-slate-400'
                    : dueDiff < 0
                    ? 'text-rose-600'
                    : dueDiff <= 1
                    ? 'text-amber-600'
                    : 'text-slate-500';
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openTaskModal(task.id)}
                    className={`w-full rounded-3xl border px-5 py-4 text-left shadow-sm transition ${
                      isSelected
                        ? 'border-slate-300 bg-white shadow-[0_18px_60px_-45px_rgba(15,23,42,0.35)]'
                        : 'border-slate-200 bg-white/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${status.chip}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${priority.chip}`}
                          >
                            {priority.label}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${deadlineBadge.chip}`}
                          >
                            {deadlineBadge.label}
                          </span>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-slate-900">{task.title}</div>
                          <div className="text-sm text-slate-600">
                            {detailText || 'No detail'}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                      <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${dueTone}`}>
                        Due {dueDateLabel}
                      </div>
                      <div className="text-xs text-slate-500">
                        Assigned to: {formatAssignees(task.assignees)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Project: {task.project ?? 'No project'}
                      </div>
                      <div className="text-xs text-slate-400">
                        Created {formatCreatedAt(task.createdAt)}
                      </div>
                    </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
              </div>
            )}
              </>
            )}
          </section>
          </div>
        </div>
        {taskModalOpen && focusedTask ? (
          <>
            <div
              className="fixed"
              style={{
                top: '56px',
                left: '0',
                right: '0',
                bottom: '0',
                zIndex: 40,
                pointerEvents: 'auto'
              }}
              onClick={closeTaskModal}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="fixed bg-white overflow-y-auto shadow-2xl border-l border-slate-200"
              style={{
                top: '56px',
                bottom: '0',
                right: '0',
                width: 'calc((100vw - 280px) * 0.5)',
                height: 'calc(100vh - 56px)',
                zIndex: 50
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 sm:px-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                      Task detail
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                      {focusedTask.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      adminEditOpen ? (
                        <>
                          <button
                            type="button"
                            onClick={handleAdminEditSave}
                            disabled={adminEditSaving}
                            className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:opacity-60"
                          >
                            <Save className="w-3 h-3" />
                            {adminEditSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelAdminEdit}
                            className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600"
                          >
                            <XCircle className="w-3 h-3 text-slate-600" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={startAdminEdit}
                          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      )
                    ) : null}
                    <button
                      type="button"
                      onClick={closeTaskModal}
                      className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                      aria-label="Close modal"
                    >
                      <XCircle className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-6 py-6 sm:px-8">
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    STATUS_STYLES[focusedTask.status].chip
                  }`}
                >
                  {STATUS_STYLES[focusedTask.status].label}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    PRIORITY_STYLES[focusedTask.priority].chip
                  }`}
                >
                  {PRIORITY_STYLES[focusedTask.priority].label}
                </span>
              </div>
              {adminEditError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                  {adminEditError}
                </div>
              ) : null}
              {adminEditSuccess ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                  {adminEditSuccess}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openAssignModal}
                  disabled={!isAdmin}
                  className={`rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-4 text-left ${
                    isAdmin
                      ? 'cursor-pointer transition hover:border-slate-300'
                      : 'cursor-default'
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Assigned to
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatAssignees(focusedTask.assignees)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {focusedTask.project ?? 'No project'}
                  </div>
                </button>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Due date
                  </div>
                  {isAdmin && adminEditOpen ? (
                    <input
                      type="date"
                      value={adminEditDraft.dueDate}
                      onChange={(event) =>
                        setAdminEditDraft((prev) => ({
                          ...prev,
                          dueDate: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                    />
                  ) : (
                    <div className="text-sm font-semibold text-slate-900">
                      {formatShortDate(focusedTask.dueDate)}
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    {isAdmin && adminEditOpen ? 'Pick a date from the calendar.' : formatDueLabel(focusedTask, today)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Created {formatCreatedAt(focusedTask.createdAt)}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Detail
                </div>
                {isAdmin && adminEditOpen ? (
                  <textarea
                    rows={3}
                    value={adminEditDraft.detail}
                    onChange={(event) =>
                      setAdminEditDraft((prev) => ({
                        ...prev,
                        detail: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                ) : (
                  <div className="mt-2 text-sm text-slate-600">
                    {focusedTask.detail?.trim() || 'None set'}
                  </div>
                )}
              </div>

              {isAdmin && adminEditOpen ? (
                <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Notes
                  </div>
                  <textarea
                    rows={4}
                    value={adminEditDraft.notes}
                    onChange={(event) =>
                      setAdminEditDraft((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                </div>
              ) : noteEntries.length ? (
                <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Notes
                  </div>
                  <div className="mt-3 space-y-3">
                    {noteEntries.map((entry, index) => {
                      const authorName = entry.author || 'Unknown';
                      const authorKey = authorName.toLowerCase();
                      const assigneeMatch = focusedTask?.assignees.find(
                        (assignee) => (assignee.userName ?? '').toLowerCase() === authorKey,
                      );
                      const userMatch = users.find(
                        (member) => member.userName.toLowerCase() === authorKey,
                      );
                      const avatarUrl =
                        assigneeMatch?.avatarUrl ?? userMatch?.avatarUrl ?? null;
                      const displayName =
                        assigneeMatch?.userName ?? userMatch?.userName ?? authorName;
                      return (
                        <div
                          key={`${entry.timestamp}-${entry.author}-${index}`}
                          className="flex items-start gap-3"
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600"
                              title={displayName}
                            >
                              {getInitials(displayName)}
                            </div>
                          )}
                          <div>
                            <div className="text-sm text-slate-700">{entry.text}</div>
                            {entry.timestamp ? (
                              <div className="mt-1 text-xs text-slate-400">
                                {entry.timestamp}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {noteOpen ? (
                <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Add note
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Appends with your name and time.
                  </div>
                  {noteError ? (
                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {noteError}
                    </div>
                  ) : null}
                  {noteSuccess ? (
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      {noteSuccess}
                    </div>
                  ) : null}
                  <textarea
                    rows={3}
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      disabled={!canActOnTask || noteSaving}
                      className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      <Save className="w-3 h-3" />
                      {noteSaving ? 'Saving...' : 'Save note'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteOpen(false)}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                    >
                      <XCircle className="w-3 h-3 text-slate-500" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {focusedTask.rejectionReason ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  Rejection reason: {focusedTask.rejectionReason}
                </div>
              ) : null}
              {canRequestAssignees ? (
                <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Request assignees
                  </div>
                  {requestError ? (
                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {requestError}
                    </div>
                  ) : null}
                  {requestSuccess ? (
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      {requestSuccess}
                    </div>
                  ) : null}
                  {usersLoading ? (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Loading users...
                    </div>
                  ) : usersError ? (
                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {usersError}
                    </div>
                  ) : (
                    <div className="mt-2 max-h-32 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      {users.map((member) => {
                        const isAssigned = assignedAssigneeIds.has(member.id);
                        return (
                          <label
                            key={member.id}
                            className={`flex items-center gap-2 text-xs ${
                              isAssigned ? 'text-slate-400' : 'text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={requestAssigneeIds.includes(member.id)}
                              onChange={() => toggleSelection(setRequestAssigneeIds, member.id)}
                              disabled={isAssigned}
                              className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900"
                            />
                            <span className="font-medium">{member.userName}</span>
                            <span className="text-[10px] text-slate-400">{member.email}</span>
                            {isAssigned ? (
                              <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                assigned
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRequestAssignees}
                      disabled={requestSaving}
                      className="rounded-full bg-slate-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {requestSaving ? 'Sending...' : 'Request assignments'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestAssigneeIds([])}
                      className="rounded-full border border-slate-200 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                {focusedTask.href ? (
                  <Link
                    href={focusedTask.href}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.6)] transition hover:bg-slate-800"
                  >
                    Open workspace
                  </Link>
                ) : null}
                {focusedTask.status === 'todo' && !isAssignedToUser && !isAdmin && !readOnly ? (
                  <button
                    type="button"
                    onClick={handleRequestAssign}
                    disabled={selfAssignSaving}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 disabled:opacity-60"
                  >
                    {selfAssignSaving ? 'Sending...' : 'Request assign'}
                  </button>
                ) : null}
                {focusedTask.status === 'in_progress' &&
                !isAssignedToUser &&
                !isAdmin &&
                !readOnly ? (
                  <button
                    type="button"
                    onClick={handleAssignToMe}
                    disabled={selfAssignSaving}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 disabled:opacity-60"
                  >
                    {selfAssignSaving ? 'Assigning...' : 'Assign to me'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setNoteOpen((prev) => {
                      if (!prev) {
                        setNoteDraft('');
                        setNoteError('');
                        setNoteSuccess('');
                      }
                      return !prev;
                    })
                  }
                  disabled={!canActOnTask}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 disabled:opacity-60"
                >
                  Add note
                </button>
                {focusedTask.status === 'in_progress' ? (
                  <button
                    type="button"
                    onClick={handleDoneRequest}
                    disabled={!canActOnTask || doneSaving}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 disabled:opacity-60"
                  >
                    {doneSaving ? 'Sending...' : 'Mark done'}
                  </button>
                ) : null}
              </div>
              {selfAssignError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                  {selfAssignError}
                </div>
              ) : null}
              {selfAssignSuccess ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                  {selfAssignSuccess}
                </div>
              ) : null}
              {doneError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                  {doneError}
                </div>
              ) : null}
              {doneSuccess ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                  {doneSuccess}
                </div>
              ) : null}

              {readOnly ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                  You have view-only access. Ask a manager to update tasks.
                </div>
              ) : null}
              </div>
            </div>
          </>
        ) : null}
        {assignModalOpen && focusedTask && isAdmin ? (
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-slate-900/50 px-4 pb-12 pt-32 backdrop-blur-sm sm:pt-36"
            onClick={closeAssignModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                    Assign users
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    {focusedTask.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600"
                >
                  <XCircle className="w-3 h-3 text-slate-600" />
                  Close
                </button>
              </div>
              {assignError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                  {assignError}
                </div>
              ) : null}
              {assignSuccess ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                  {assignSuccess}
                </div>
              ) : null}
              {usersLoading ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  Loading users...
                </div>
              ) : usersError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                  {usersError}
                </div>
              ) : users.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  No active users available.
                </div>
              ) : (
                <div className="mt-4 max-h-64 space-y-1 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  {users.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={assignDraftIds.includes(member.id)}
                        onChange={() => toggleAssignDraft(member.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900"
                      />
                      <span className="font-medium">{member.name}</span>
                      <span className="text-[10px] text-slate-400">{member.email}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAssignUsers}
                  disabled={assignSaving}
                  className="rounded-full bg-slate-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {assignSaving ? 'Saving...' : 'Update assignments'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {createOpen && canCreate ? (
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-slate-900/50 px-4 pb-12 pt-32 backdrop-blur-sm sm:pt-36"
            onClick={() => {
              setAssigneesDropdownOpen(false);
              setCreateOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                    Create new task
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
              setAssigneesDropdownOpen(false);
              setCreateOpen(false);
            }}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600"
                >
                  <XCircle className="w-3 h-3 text-slate-600" />
                  Close
                </button>
              </div>
              {createError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {createError}
                </div>
              ) : null}
              {createSuccess ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {createSuccess}
                </div>
              ) : null}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <div className="flex items-end gap-2">
                    <label className="flex-1 space-y-1">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Title
                      </span>
                      <input
                        value={createDraft.title}
                        onChange={(event) =>
                          setCreateDraft((prev) => ({ ...prev, title: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                      />
                    </label>
                    <div className="relative" ref={assigneesDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setAssigneesDropdownOpen(!assigneesDropdownOpen)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Users className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-medium">
                          {createDraft.assigneeIds.length > 0
                            ? `${createDraft.assigneeIds.length} selected`
                            : 'Assign'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${assigneesDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {assigneesDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                          <div className="p-3 border-b border-slate-200">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Assignees
                            </div>
                          </div>
                          {usersLoading ? (
                            <div className="p-4 text-sm text-slate-600">
                              Loading users...
                            </div>
                          ) : usersError ? (
                            <div className="p-4 text-sm text-rose-700">
                              {usersError}
                            </div>
                          ) : users.length === 0 ? (
                            <div className="p-4 text-sm text-slate-600">
                              No active users available.
                            </div>
                          ) : (
                            <div className="p-2 space-y-1">
                              {users.map((member) => (
                                <label key={member.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={createDraft.assigneeIds.includes(member.id)}
                                    onChange={() => toggleDraftAssignee(member.id)}
                                    className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                                  />
                                  <span className="font-medium text-slate-800">{member.name}</span>
                                  <span className="text-xs text-slate-500">{member.email}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          <div className="p-3 border-t border-slate-200">
                            <div className="text-xs text-slate-500">
                              {isAdmin
                                ? 'Assignments apply immediately.'
                                : 'Assignments require admin approval.'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Due date
                  </span>
                  <input
                    type="date"
                    value={createDraft.dueDate}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({ ...prev, dueDate: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Priority
                  </span>
                  <select
                    value={createDraft.priority}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        priority: event.target.value as TaskPriority,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Project
                  </span>
                  <input
                    value={createDraft.project}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({ ...prev, project: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Tags
                  </span>
                  <input
                    value={createDraft.tags}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({ ...prev, tags: event.target.value }))
                    }
                    placeholder="client, onboarding"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Detail
                  </span>
                  <textarea
                    rows={2}
                    value={createDraft.detail}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({ ...prev, detail: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Notes
                  </span>
                  <textarea
                    rows={2}
                    value={createDraft.notes}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                  />
                </label>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={createSaving}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {createSaving ? 'Saving...' : isAdmin ? 'Create task' : 'Submit request'}
                </button>
                <button
                  type="button"
                  onClick={() => {
              setAssigneesDropdownOpen(false);
              setCreateOpen(false);
            }}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600"
                >
                  <XCircle className="w-3 h-3 text-slate-600" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {canCreate && (
          <button
            type="button"
            onClick={() =>
              setCreateOpen((prev) => {
                if (!prev) {
                  setCreateError('');
                  setCreateSuccess('');
                }
                return !prev;
              })
            }
            style={{
              borderRadius: '9999px',
              transition: 'all 0.3s ease-in-out, border-radius 0.3s ease-in-out, background-color 0.3s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderRadius = '1rem';
              e.currentTarget.style.backgroundColor = '#4f46e5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderRadius = '9999px';
              e.currentTarget.style.backgroundColor = '#6366f1';
            }}
            className="fixed right-6 bottom-8 z-50 group flex items-center justify-center h-10 bg-[#6366f1] text-white shadow-[0_10px_25px_-16px_rgba(99,102,241,0.8)] transition-all duration-300 ease-in-out hover:shadow-[0_15px_35px_-12px_rgba(99,102,241,0.6)] w-10 hover:w-40"
          >
            <span className="group-hover:opacity-0 group-hover:scale-75 transition-all duration-300 text-xl font-light">
              +
            </span>
            <span className="absolute opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 text-xs font-semibold uppercase tracking-[0.18em] whitespace-nowrap">
              New Task
            </span>
          </button>
        )}

        {/* Reject Reason Modal */}
        {rejectReasonModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Reject Done Request</h2>
              <p className="text-sm text-slate-600 mb-4">Please provide a reason for rejecting this done request. This reason will be added to the task notes.</p>
              <textarea
                value={rejectReasonDraft}
                onChange={(e) => setRejectReasonDraft(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent focus:border-slate-300 focus:ring-slate-300 resize-none"
                rows={4}
              />
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setRejectReasonModalOpen(false);
                    setRejectReasonDraft('');
                    setRejectingRequestId(null);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <XCircle className="w-4 h-4 text-slate-600" />
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!token || !rejectingRequestId) return;
                    try {
                      await api(`/tasks/done-requests/${rejectingRequestId}/reject`, {
                        method: 'POST',
                        body: JSON.stringify({ reason: rejectReasonDraft.trim() || null }),
                      }, token);
                      await loadDoneRequests();
                      await loadTasks();
                      setRejectReasonModalOpen(false);
                      setRejectReasonDraft('');
                      setRejectingRequestId(null);
                    } catch (err) {
                      console.error('Failed to reject:', err);
                    }
                  }}
                  className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
