import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'sarwarcyou_keep_screen_on';

let wakeLockSentinel: any = null;
let isKeepAwakeEnabled = false;
const listeners = new Set<(active: boolean) => void>();

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb(isKeepAwakeEnabled);
    } catch (e) {
      console.warn('[KeepAwake] Listener error:', e);
    }
  });
}

/**
 * Acquire wake lock on native Android or Web WakeLock API
 */
async function acquireLock(): Promise<boolean> {
  let success = false;

  // 1. Native Capacitor Android keep-awake
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.keepAwake();
      success = true;
    } catch (err) {
      console.warn('[KeepAwake] Native KeepAwake error:', err);
    }
  }

  // 2. Web Screen Wake Lock API (Web / PWA / fallback)
  if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
    try {
      if (wakeLockSentinel && !wakeLockSentinel.released) {
        // already acquired
      } else {
        wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
      success = true;
    } catch (err: any) {
      // Not allowed or user interaction needed
      console.warn('[KeepAwake] Web WakeLock request error:', err?.message || err);
    }
  }

  return success;
}

/**
 * Release wake lock
 */
async function releaseLock(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.allowSleep();
    } catch (err) {
      console.warn('[KeepAwake] Native allowSleep error:', err);
    }
  }

  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch (err) {
      console.warn('[KeepAwake] Web WakeLock release error:', err);
    }
    wakeLockSentinel = null;
  }
}

/**
 * Enable keep screen on
 */
export async function enableKeepScreenOn(): Promise<boolean> {
  isKeepAwakeEnabled = true;
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {}

  const result = await acquireLock();
  notifyListeners();
  return result;
}

/**
 * Disable keep screen on
 */
export async function disableKeepScreenOn(): Promise<boolean> {
  isKeepAwakeEnabled = false;
  try {
    localStorage.setItem(STORAGE_KEY, 'false');
  } catch {}

  await releaseLock();
  notifyListeners();
  return true;
}

/**
 * Toggle keep screen on
 */
export async function toggleKeepScreenOn(): Promise<boolean> {
  if (isKeepAwakeEnabled) {
    await disableKeepScreenOn();
    return false;
  } else {
    await enableKeepScreenOn();
    return true;
  }
}

/**
 * Check if keep screen on is currently active
 */
export function getKeepScreenOnState(): boolean {
  return isKeepAwakeEnabled;
}

/**
 * Subscribe to state changes
 */
export function subscribeKeepScreenOn(callback: (active: boolean) => void): () => void {
  listeners.add(callback);
  callback(isKeepAwakeEnabled);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Initialize on app startup (restores user preference from localStorage)
 */
export function initKeepAwake(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') {
      isKeepAwakeEnabled = true;
      acquireLock().catch(() => {});
      notifyListeners();
    }
  } catch {}

  // Handle re-acquiring lock when app comes back to foreground
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isKeepAwakeEnabled) {
        acquireLock().catch(() => {});
      }
    });
  }
}
