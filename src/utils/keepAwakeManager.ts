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
 * Acquire screen wake lock via standard Web Screen Wake Lock API
 */
async function acquireLock(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock?.request) {
    try {
      if (wakeLockSentinel && !wakeLockSentinel.released) {
        return true;
      }
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      return true;
    } catch (err: any) {
      console.warn('[KeepAwake] Web WakeLock request notice:', err?.message || err);
      return false;
    }
  }
  return false;
}

/**
 * Release wake lock
 */
async function releaseLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch (err) {
      console.warn('[KeepAwake] Web WakeLock release notice:', err);
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
 * Initialize on web startup (restores user preference from localStorage)
 */
export function initKeepAwake(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') {
      isKeepAwakeEnabled = true;
      acquireLock().catch(() => {});
      notifyListeners();
    } else {
      isKeepAwakeEnabled = false;
      releaseLock().catch(() => {});
      notifyListeners();
    }
  } catch {
    releaseLock().catch(() => {});
  }

  // Handle re-acquiring lock when tab/window comes back to foreground
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isKeepAwakeEnabled) {
        acquireLock().catch(() => {});
      }
    });
  }
}
