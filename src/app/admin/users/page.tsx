'use client';
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Ban, X, Check, Users } from "lucide-react";
import { api } from "../../../lib/api";
import { ClientUser } from "../../../lib/auth";
import { useAuth } from "../../../lib/useAuth";
import AdminShell from "../../../components/AdminShell";

const roles = ["ADMIN", "MANAGER", "BIDDER", "OBSERVER"] as const;

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const modalRoot = typeof document !== "undefined" ? document.body : null;
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<{ type: 'edit' | 'delete' | 'ban', userId: string, userName: string, role?: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
    void loadUsers(token);
  }, [loading, user, token, router]);

  async function loadUsers(authToken: string) {
    try {
      const list = await api<ClientUser[]>("/users?includeObservers=true", undefined, authToken);
      setUsers(list);
    } catch (err) {
      console.error(err);
      setError("Failed to load users.");
    }
  }

  const filteredUsers = users.filter((u) => u.id !== user?.id && u.isActive !== false);

  function getInitials(userName: string): string {
    return userName
      .split(' ')
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  }

  function handleEdit(user: ClientUser) {
    setEditingId(user.id);
    setEditingRole(user.role);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingRole("");
  }

  function handleSaveEdit() {
    if (!editingId || !token) return;
    const targetUser = users.find((u) => u.id === editingId);
    if (!targetUser || editingRole === targetUser.role) {
      cancelEdit();
      return;
    }
    setPendingAction({ type: 'edit', userId: editingId, userName: targetUser.userName, role: editingRole });
    setConfirmOpen(true);
  }

  function handleDelete(user: ClientUser) {
    setPendingAction({ type: 'delete', userId: user.id, userName: user.userName });
    setConfirmOpen(true);
  }

  function handleBan(user: ClientUser) {
    setPendingAction({ type: 'ban', userId: user.id, userName: user.userName });
    setConfirmOpen(true);
  }

  async function executeAction() {
    if (!pendingAction || !token) return;
    setActionLoading(true);
    setError("");

    try {
      if (pendingAction.type === 'edit' && pendingAction.role) {
        await api(`/users/${pendingAction.userId}/role`, { method: "PATCH", body: JSON.stringify({ role: pendingAction.role }) }, token);
      } else if (pendingAction.type === 'ban') {
        await api(`/users/${pendingAction.userId}/ban`, { method: "PATCH", body: JSON.stringify({}) }, token);
      } else if (pendingAction.type === 'delete') {
        await api(`/users/${pendingAction.userId}`, { method: "DELETE" }, token);
      }
      await loadUsers(token);
      setConfirmOpen(false);
      setPendingAction(null);
      setEditingId(null);
      setEditingRole("");
    } catch (err: any) {
      console.error(err);
      const message = err?.message || "Failed to perform action.";
      if (pendingAction.type === 'delete' && message.includes("404") || message.includes("not found")) {
        setError("Delete endpoint not available.");
      } else {
        setError(message);
      }
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
                Admin
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                User & role management
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Promote observers, manage managers, and keep bidder access in sync.
          </p>
        </header>
        <div className="space-y-6">

        {error && (
          <div className="rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-6 bg-slate-50 px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-600">
            <div>Avatar</div>
            <div>User Name</div>
            <div>Email</div>
            <div>Role</div>
            <div>Actions</div>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredUsers.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">No users found.</div>
            ) : (
              filteredUsers.map((u) => {
                const isEditing = editingId === u.id;
                const hasAvatar = Boolean(u.avatarUrl) && u.avatarUrl?.toLowerCase() !== 'nope';
                const initials = getInitials(u.userName || u.name || 'U');
                return (
                  <div key={u.id} className="grid grid-cols-6 items-center px-4 py-3 text-sm text-slate-800">
                    <div className="flex items-center">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {hasAvatar ? (
                          <img src={u.avatarUrl!} alt={`${u.userName} avatar`} className="h-full w-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                    </div>
                    <div className="font-semibold text-slate-900">{u.userName}</div>
                    <div className="text-slate-700">{u.email}</div>
                    <div className="text-slate-700">
                      {isEditing ? (
                        <select
                          value={editingRole}
                          onChange={(e) => setEditingRole(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:ring-slate-300"
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        u.role
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={actionLoading || editingRole === u.role}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-60"
                            title="Save"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(u)}
                            disabled={actionLoading}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                            title="Edit role"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBan(u)}
                            disabled={actionLoading || u.isActive === false}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-300 text-orange-700 transition hover:bg-orange-50 disabled:opacity-60"
                            title="Ban user"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={actionLoading}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-300 text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {modalRoot && confirmOpen && pendingAction
          ? createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-6">
            <div
              className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-700">
                  {pendingAction.type === 'edit' && 'Confirm role change'}
                  {pendingAction.type === 'delete' && 'Confirm deletion'}
                  {pendingAction.type === 'ban' && 'Confirm ban'}
                </p>
                <h3 className="text-xl font-semibold text-amber-900 mt-1">
                  {pendingAction.type === 'edit' && `Change role of "${pendingAction.userName}" to ${pendingAction.role}?`}
                  {pendingAction.type === 'delete' && `Delete account "${pendingAction.userName}"? This action cannot be undone.`}
                  {pendingAction.type === 'ban' && `Ban user "${pendingAction.userName}"? They will not be able to log in.`}
                </h3>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setConfirmOpen(false);
                    setPendingAction(null);
                  }}
                  disabled={actionLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-500 text-white shadow-sm transition hover:bg-rose-600 hover:border-rose-400 disabled:opacity-60"
                  title="No, cancel"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => void executeAction()}
                  disabled={actionLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 hover:border-emerald-400 disabled:opacity-60"
                  title="Yes, confirm"
                >
                  {actionLoading ? (
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
        </div>
      </div>
    </AdminShell>
  );
}
