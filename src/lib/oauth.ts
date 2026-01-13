const MS_CLIENT_ID = process.env.NEXT_PUBLIC_MS_CLIENT_ID || '';
const MS_TENANT_ID = process.env.NEXT_PUBLIC_MS_TENANT_ID || process.env.MS_TENANT_ID || 'common';

const baseScope = 'openid profile email offline_access Calendars.Read User.Read';
const includeSharedCalendars =
  process.env.MS_GRAPH_SHARED_CALENDARS === 'true' ||
  (MS_TENANT_ID !== 'common' && MS_TENANT_ID !== 'consumers');
const scope = includeSharedCalendars ? `${baseScope} Calendars.Read.Shared` : baseScope;

export function getAzureADOAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope,
    state: randomString(32),
  });
  return `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function handleAzureADCallback(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number; idToken?: string; providerAccountId: string; email: string; displayName?: string }> {
  if (!MS_CLIENT_ID) {
    throw new Error('MS_CLIENT_ID is not configured');
  }

  // Exchange code for tokens
  const tokenParams = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope,
  });

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    },
  );

  if (!tokenRes.ok) {
    const errorData = await tokenRes.json().catch(() => ({}));
    throw new Error(errorData.error_description || 'Failed to exchange authorization code');
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };

  // Get user profile
  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let email = '';
  let displayName: string | undefined;
  let providerAccountId = '';

  if (profileRes.ok) {
    const profile = (await profileRes.json()) as {
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
      id?: string;
    };
    email = profile.mail || profile.userPrincipalName || '';
    displayName = profile.displayName;
    providerAccountId = profile.id || email;
  }

  if (!email) {
    throw new Error('Failed to get user email from profile');
  }

  const expiresAt = tokenData.expires_in
    ? Math.floor(Date.now() / 1000) + tokenData.expires_in
    : undefined;

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    idToken: tokenData.id_token,
    providerAccountId,
    email,
    displayName,
  };
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
