/**
 * Centralized Dock Notification Hub
 *
 * Emits and manages notifications routed through the tactical navigation dock:
 * 1. Sudden Internet Disconnection (flashing OFFLINE badge + 10s auto-dismiss)
 * 2. Metered Mobile Data Detection (10s auto-dismiss)
 * 3. Broken / Unknown Link (404 route -> redirects to homepage + 10s auto-dismiss)
 *
 * Keeps all notifications inside the dock rather than intrusive full-window dialogs.
 */

export type DockNotificationType = 'offline' | 'metered' | 'broken_link';

export interface DockNotification {
  id: string;
  type: DockNotificationType;
  title: string;
  message: string;
  durationMs: number;
  attemptedPath?: string;
}

type NotificationListener = (notification: DockNotification | null) => void;

let currentNotification: DockNotification | null = null;
const listeners = new Set<NotificationListener>();
let timerId: ReturnType<typeof setTimeout> | null = null;

export function triggerDockNotification(params: {
  type: DockNotificationType;
  title: string;
  message: string;
  durationMs?: number;
  attemptedPath?: string;
}): void {
  const duration = params.durationMs ?? 10000;
  const notif: DockNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: params.type,
    title: params.title,
    message: params.message,
    durationMs: duration,
    attemptedPath: params.attemptedPath,
  };

  currentNotification = notif;
  listeners.forEach((listener) => {
    try {
      listener(currentNotification);
    } catch (e) {
      console.warn('Dock notification listener error:', e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dock-notification', { detail: notif }));
  }

  if (timerId) clearTimeout(timerId);
  timerId = setTimeout(() => {
    currentNotification = null;
    listeners.forEach((listener) => {
      try {
        listener(null);
      } catch (e) {
        console.warn('Dock notification listener clear error:', e);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dock-notification-clear'));
    }
  }, duration);
}

export function clearDockNotification(): void {
  if (timerId) clearTimeout(timerId);
  currentNotification = null;
  listeners.forEach((listener) => {
    try {
      listener(null);
    } catch (e) {
      console.warn('Dock notification listener clear error:', e);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dock-notification-clear'));
  }
}

export function subscribeDockNotification(listener: NotificationListener): () => void {
  listeners.add(listener);
  // Emit current notification immediately to new subscriber
  listener(currentNotification);
  return () => {
    listeners.delete(listener);
  };
}

// Global browser event listeners setup (offline & metered connection transitions)
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    triggerDockNotification({
      type: 'offline',
      title: 'CONNECTION LOST',
      message: 'Internet disconnected. Operating in offline archive mode from local cache.',
      durationMs: 10000,
    });
  });

  const conn =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;

  if (conn && conn.addEventListener) {
    conn.addEventListener('change', () => {
      const isMetered = Boolean(conn.type === 'cellular' || conn.saveData === true);
      if (isMetered && navigator.onLine) {
        triggerDockNotification({
          type: 'metered',
          title: 'METERED DATA DETECTED',
          message: 'Connected via mobile data. Streaming videos or shorts may consume significant cellular data.',
          durationMs: 10000,
        });
      }
    });
  }
}
