'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import TopNav from '../../components/TopNav';
import { useAuth } from '../../lib/useAuth';
import { CommunityContent } from './CommunityContent';

export default function CommunityPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <TopNav />
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-600">Loading...</div>
        </div>
      </main>
    );
  }

  return <CommunityContent />;
}
