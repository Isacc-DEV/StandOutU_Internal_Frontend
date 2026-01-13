import { NextRequest, NextResponse } from 'next/server';
import { handleAzureADCallback } from '@/lib/oauth';
import { api } from '@/lib/api';
import { readAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      new URL(`/calendar?error=${encodeURIComponent(errorDescription || error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/calendar?error=missing_code', request.url));
  }

  try {
    const auth = readAuth();
    if (!auth?.token) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }

    const redirectUri = new URL('/api/calendar/oauth/callback', request.url).toString();
    const tokens = await handleAzureADCallback(code, redirectUri);

    // Store account in backend
    await api('/calendar/oauth/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerAccountId: tokens.providerAccountId,
        email: tokens.email,
        displayName: tokens.displayName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        idToken: tokens.idToken,
      }),
    }, auth.token);

    return NextResponse.redirect(new URL('/calendar?success=connected', request.url));
  } catch (err) {
    console.error('OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Failed to connect account';
    return NextResponse.redirect(
      new URL(`/calendar?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
