'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopNav from '../../components/TopNav';
import { api } from '../../lib/api';
import { type ClientUser, saveAuth } from '../../lib/auth';
import { useAuth } from '../../lib/useAuth';
import { User, Lock, CreditCard } from 'lucide-react';

function getInitials(name?: string | null) {
  if (!name) return 'DM';
  return name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type TabType = 'profile' | 'security' | 'payment';

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  
  // Profile tab state
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [editingBio, setEditingBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  
  // Security tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace('/auth');
    }
  }, [loading, user, token, router]);

  useEffect(() => {
    if (user) {
      setEditingName(user.name || '');
      setEditingEmail(user.email || '');
      setEditingBio(user.bio || '');
    }
  }, [user]);

  const handleEdit = () => {
    if (user) {
      setEditingName(user.name || '');
      setEditingEmail(user.email || '');
      setEditingBio(user.bio || '');
      setIsEditing(true);
      setSaveError('');
    }
  };

  const handleCancel = () => {
    if (user) {
      setEditingName(user.name || '');
      setEditingEmail(user.email || '');
      setEditingBio(user.bio || '');
      setIsEditing(false);
      setSaveError('');
    }
  };

  async function handleSave() {
    if (!user || !token) return;
    if (!editingName.trim() || !editingEmail.trim()) {
      setSaveError('Name and email are required');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const res = await api(
        '/users/me',
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: editingName.trim(),
            email: editingEmail.trim(),
            bio: editingBio.trim() || null,
          }),
        },
        token,
      );
      const payload = res as { user?: ClientUser };
      if (payload.user && token) {
        saveAuth(payload.user, token);
        setIsEditing(false);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to update profile';
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (!user || !token) return;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    
    if (newPassword.length < 3) {
      setPasswordError('New password must be at least 3 characters');
      return;
    }

    setChangingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);
    
    try {
      await api(
        '/users/me/password',
        {
          method: 'PATCH',
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        },
        token,
      );
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to change password';
      setPasswordError(error);
    } finally {
      setChangingPassword(false);
    }
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#f4f8ff] via-[#eef2ff] to-white text-slate-900">
        <TopNav />
        <div className="mx-auto w-full min-h-screen pt-[57px]">
          <div className="px-4 py-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Loading profile...
            </div>
          </div>
        </div>
      </main>
    );
  }

  const initials = getInitials(user.userName);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f4f8ff] via-[#eef2ff] to-white text-slate-900">
      <TopNav />
      <div className="mx-auto w-full min-h-screen pt-[57px]">
        <div className="grid gap-4 min-h-screen xl:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <section
            className="app-shell-sidebar flex flex-col gap-2"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="app-shell-kicker text-[11px] uppercase tracking-[0.26em]">Settings</p>
                  <h1 className="app-shell-title text-lg font-semibold">Account</h1>
                </div>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveTab('profile')}
                  data-active={activeTab === 'profile'}
                  className="app-shell-link flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                >
                  <User className="w-5 h-5" />
                  <span>Profile</span>
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  data-active={activeTab === 'security'}
                  className="app-shell-link flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                >
                  <Lock className="w-5 h-5" />
                  <span>Security</span>
                </button>
                <button
                  onClick={() => setActiveTab('payment')}
                  data-active={activeTab === 'payment'}
                  className="app-shell-link flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Payment</span>
                </button>
              </div>
            </div>
          </section>

          {/* Main Content */}
          <section className="flex-1 px-4 py-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              {activeTab === 'profile' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-slate-900">Profile Settings</h1>
                  </div>

                  {/* Avatar Section */}
                  <div className="flex items-center gap-6 border-b border-slate-200 pb-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white shadow-lg ring-2 ring-slate-200">
                        {initials}
                      </div>
                      <span className="text-center text-xs font-medium text-slate-500">
                        Image avatars removed for a cleaner workspace.
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{user.userName}</h2>
                      <p className="text-sm text-slate-600">{user.email}</p>
                    </div>
                  </div>

                  {saveError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {saveError}
                    </div>
                  )}

                  {/* Profile Fields */}
                  <div className="space-y-6">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          disabled={saving}
                          placeholder="Your full name"
                        />
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
                          {user.name || 'Not set'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Email
                      </label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editingEmail}
                          onChange={(e) => setEditingEmail(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          disabled={saving}
                          placeholder="your.email@example.com"
                        />
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
                          {user.email}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Bio
                      </label>
                      {isEditing ? (
                        <textarea
                          value={editingBio}
                          onChange={(e) => setEditingBio(e.target.value)}
                          rows={4}
                          maxLength={1000}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                          disabled={saving}
                          placeholder="Tell us about yourself..."
                        />
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 whitespace-pre-wrap min-h-[100px]">
                          {user.bio || 'No bio added yet'}
                        </div>
                      )}
                      {isEditing && (
                        <p className="mt-1 text-xs text-slate-500">
                          {editingBio.length}/1000 characters
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Role
                      </label>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
                        {user.role}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {isEditing ? (
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-wait disabled:opacity-60"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={saving}
                        className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-wait disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'security' && (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                      <h1 className="text-3xl font-bold text-slate-900">Security Settings</h1>
                      <p className="mt-2 text-sm text-slate-600">
                        Change your password to keep your account secure
                      </p>
                    </div>

                    {passwordError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {passwordError}
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        Password changed successfully!
                      </div>
                    )}

                    <div className="space-y-6">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          disabled={changingPassword}
                          placeholder="Enter your current password"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          disabled={changingPassword}
                          placeholder="Enter your new password"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Must be at least 3 characters
                        </p>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          disabled={changingPassword}
                          placeholder="Confirm your new password"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handlePasswordChange}
                        disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                        className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-wait disabled:opacity-60"
                      >
                        {changingPassword ? 'Changing Password...' : 'Change Password'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'payment' && (
                <div className="space-y-8">
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900">Payment Settings</h1>
                    <p className="mt-2 text-sm text-slate-600">
                      Payment options coming soon
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
                    <CreditCard className="mx-auto h-12 w-12 text-slate-400" />
                    <p className="mt-4 text-sm font-medium text-slate-600">
                      Payment settings will be available here
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
