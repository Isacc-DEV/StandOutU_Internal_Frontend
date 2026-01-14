'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Check, X } from "lucide-react";
import { api } from "../../../lib/api";
import { ClientUser } from "../../../lib/auth";
import { useAuth } from "../../../lib/useAuth";
import AdminShell from "../../../components/AdminShell";

export default function BannedUsersPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [bannedUsers, setBannedUsers] = useState<ClientUser[]>([]);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'approve', userId: string, userName: string } | null>(null);
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
    void loadBannedUsers(token);
  }, [loading, user, token, router]);

  async function loadBannedUsers(authToken: string) {
    try {
      const allUsers = await api<ClientUser[]>("/users?includeObservers=true", undefined, authToken);
      const banned = allUsers.filter(u => u.role !== "NONE" && u.isActive === false);
      setBannedUsers(banned);
    } catch (err) {
      console.error(err);
      setError("Failed to load banned users.");
    }
  }

  function handleDelete(user: ClientUser) {
    setPendingAction({ type: 'delete', userId: user.id, userName: user.userName });
    setConfirmOpen(true);
  }

  function handleApprove(user: ClientUser) {
    setPendingAction({ type: 'approve', userId: user.id, userName: user.userName });
    setConfirmOpen(true);
  }

  async function executeAction() {
    if (!pendingAction || !token) return;
    setActionLoading(true);
    setError("");

    try {
      if (pendingAction.type === 'delete') {
        await api(`/users/${pendingAction.userId}`, { method: "DELETE" }, token);
      } else if (pendingAction.type === 'approve') {
        await api(`/users/${pendingAction.userId}/approve`, { method: "PATCH", body: JSON.stringify({}) }, token);
      }
      await loadBannedUsers(token);
      setConfirmOpen(false);
      setPendingAction(null);
    } catch (err: any) {
      console.error(err);
      const message = err?.message || "Failed to perform action.";
      setError(message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900">Banned users</h1>
          <p className="text-sm text-slate-600">Manage banned user accounts. Approve to restore access or delete permanently.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-600">
            <div>Name</div>
            <div>Email</div>
            <div>Role</div>
            <div>Actions</div>
          </div>
          <div className="divide-y divide-slate-200">
            {bannedUsers.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">No banned users.</div>
            ) : (
              bannedUsers.map((u) => (
                <div key={u.id} className="grid grid-cols-4 items-center px-4 py-3 text-sm text-slate-800">
                  <div className="font-semibold text-slate-900">{u.userName}</div>
                  <div className="text-slate-700">{u.email}</div>
                  <div className="text-slate-700">{u.role}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(u)}
                      disabled={actionLoading}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                      title="Approve (restore access)"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={actionLoading}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                      title="Delete account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {confirmOpen && pendingAction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6">
            <div
              className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-700">
                  {pendingAction.type === 'delete' && 'Confirm deletion'}
                  {pendingAction.type === 'approve' && 'Confirm approval'}
                </p>
                <h3 className="text-xl font-semibold text-amber-900 mt-1">
                  {pendingAction.type === 'delete' && `Delete account "${pendingAction.userName}"? This action cannot be undone.`}
                  {pendingAction.type === 'approve' && `Approve user "${pendingAction.userName}"? They will be able to log in again.`}
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
        )}
      </div>
    </AdminShell>
  );
}
