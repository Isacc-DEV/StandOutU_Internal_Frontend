'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminReportsView from '../../reports/AdminReportsView';
import TopNav from '../../../components/TopNav';
import { useAuth } from '../../../lib/useAuth';

export default function AdminReportsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const canReview = user?.role === 'ADMIN';

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace('/auth');
      return;
    }
    if (!canReview) {
      router.replace('/reports');
    }
  }, [loading, user, token, canReview, router]);

  if (loading || !user || !token || !canReview) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f4f8ff] via-[#eef2ff] to-white text-slate-900">
      <TopNav />
      <div className="mx-auto w-full min-h-screen pt-[57px]">
        <AdminReportsView token={token} />
      </div>
    </main>
  );
}
