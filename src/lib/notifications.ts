import { useEffect, useRef } from 'react';

const REPORTS_LAST_SEEN_KEY = 'smartwork_reports_last_seen';
const NOTIFICATION_REFRESH_EVENT = 'smartwork-notifications-refresh';

function buildReportsLastSeenKey(userId: string, role: string) {
  return `${REPORTS_LAST_SEEN_KEY}:${userId}:${role.toLowerCase()}`;
}

export function getReportsLastSeen(userId: string, role: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(buildReportsLastSeenKey(userId, role));
}

export function setReportsLastSeen(userId: string, role: string, value?: string) {
  if (typeof window === 'undefined') return;
  const timestamp = value ?? new Date().toISOString();
  window.localStorage.setItem(buildReportsLastSeenKey(userId, role), timestamp);
  window.dispatchEvent(new Event(NOTIFICATION_REFRESH_EVENT));
}

export function triggerNotificationRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATION_REFRESH_EVENT));
}

export function subscribeNotificationRefresh(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(NOTIFICATION_REFRESH_EVENT, callback);
  return () => window.removeEventListener(NOTIFICATION_REFRESH_EVENT, callback);
}

type NotificationWebSocketMessage = {
  type?: string;
  notification?: {
    kind: string;
    message: string;
    href?: string | null;
  };
};

type UseNotificationWebSocketProps = {
  token: string | null;
  apiBase: string;
  onNotification: (notification: { kind: string; message: string; href?: string | null }) => void;
};

export function useNotificationWebSocket({ token, apiBase, onNotification }: UseNotificationWebSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const base = apiBase.startsWith('http') ? apiBase : window.location.origin;
      const wsUrl = new URL('/ws/notifications', base);
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl.searchParams.set('token', token);
      const socket = new WebSocket(wsUrl.toString());
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as NotificationWebSocketMessage;
          if (payload.type === 'notification' && payload.notification) {
            onNotification(payload.notification);
          }
        } catch (err) {
          console.error('Failed to parse notification message', err);
        }
      };

      socket.onclose = () => {
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(connect, 2500);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, apiBase, onNotification]);

  return { wsRef };
}
