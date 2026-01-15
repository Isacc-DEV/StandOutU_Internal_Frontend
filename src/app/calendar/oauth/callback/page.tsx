'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { readAuth } from '@/lib/auth';

function OAuthCallbackPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // Check if this is a callback from backend with tokens
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const expiresAt = searchParams.get('expires_at');
      const idToken = searchParams.get('id_token');
      const email = searchParams.get('email');
      const displayName = searchParams.get('display_name');
      const providerAccountId = searchParams.get('provider_account_id');

      if (accessToken && email) {
        // This is a callback from backend with tokens
        try {
          const auth = readAuth();
          if (!auth?.token) {
            router.push('/auth');
            return;
          }

          // Store account in backend
          await api('/calendar/oauth/accounts', {
            method: 'POST',
            body: JSON.stringify({
              providerAccountId: providerAccountId || email,
              email,
              displayName: displayName || undefined,
              accessToken,
              refreshToken: refreshToken || undefined,
              expiresAt: expiresAt ? parseInt(expiresAt, 10) : undefined,
              idToken: idToken || undefined,
            }),
          }, auth.token);

          router.push('/calendar?success=connected');
        } catch (err) {
          console.error('OAuth callback error:', err);
          const message = err instanceof Error ? err.message : 'Failed to connect account';
          router.push(`/calendar?error=${encodeURIComponent(message)}`);
        }
      } else {
        // Handle errors
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          router.push(`/calendar?error=${encodeURIComponent(errorDescription || error)}`);
        } else {
          router.push('/calendar?error=invalid_callback');
        }
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing OAuth connection...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <OAuthCallbackPageContent />
    </Suspense>
  );
}
