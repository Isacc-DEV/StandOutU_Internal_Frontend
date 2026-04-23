import { readAuth } from './auth';

const DEFAULT_API_PORT = 4000;

function getConfiguredApiPort() {
  const raw = (process.env.NEXT_PUBLIC_API_PORT || '').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : String(DEFAULT_API_PORT);
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export class ApiNetworkError extends Error {
  constructor(url: string, message: string) {
    super(`Network error contacting API (${url}): ${message}`);
    this.name = 'ApiNetworkError';
  }
}

export function isApiNetworkError(error: unknown): boolean {
  if (error instanceof ApiNetworkError) return true;
  if (!error || typeof error !== 'object') return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.startsWith('Network error contacting API');
}

function resolveApiBase(): string {
  const envBase = (process.env.NEXT_PUBLIC_API_BASE || '').trim();
  if (envBase) {
    const normalized = envBase.replace(/\/$/, '');
    if (normalized.startsWith('/')) {
      return normalized;
    }
    if (typeof window !== 'undefined') {
      try {
        const envUrl = new URL(normalized);
        if (isLocalHostname(envUrl.hostname) && !isLocalHostname(window.location.hostname)) {
          const port = envUrl.port || getConfiguredApiPort();
          return `${window.location.protocol}//${window.location.hostname}:${port}`;
        }
      } catch {
        // Fall through to use the env base as-is.
      }
    }
    return normalized;
  }
  if (typeof window === 'undefined') return '';
  const { origin, protocol, hostname, port } = window.location;
  const apiPort = getConfiguredApiPort();
  if (port === apiPort) {
    return origin;
  }
  return `${protocol}//${hostname}:${apiPort}`;
}

export const API_BASE = resolveApiBase();

function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return path;
  if (base.startsWith('/')) {
    if (typeof window === 'undefined') return `${base}${path}`;
    const prefix = base.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return new URL(`${prefix}${normalizedPath}`, window.location.origin).toString();
  }
  return new URL(path, base).toString();
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
  tokenOverride?: string | null,
): Promise<T> {
  const bearer =
    tokenOverride ??
    (typeof window !== 'undefined' ? readAuth()?.token ?? undefined : undefined);

  const mergedHeaders: Record<string, string> = {
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  
  // Don't set Content-Type for FormData - browser will set it with boundary
  if (init?.body && !(init.body instanceof FormData) && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json';
  }

  const url = buildApiUrl(path);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: mergedHeaders,
      cache: 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiNetworkError(url, message);
  }

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('smartwork_user');
          localStorage.removeItem('smartwork_token');
          window.location.href = '/auth';
        } catch (err) {
          console.error('Failed clearing auth after 401', err);
        }
      }
      throw new Error('Unauthorized');
    }
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function workspaceApi<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('smartwork_token') : null;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const url = buildApiUrl(path);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error contacting API (${url || 'unknown'}): ${message}`);
  }
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('smartwork_token');
        window.localStorage.removeItem('smartwork_user');
        window.location.href = '/auth';
      }
      throw new Error('Unauthorized');
    }
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      // Ignore JSON parse errors and show raw text.
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}
