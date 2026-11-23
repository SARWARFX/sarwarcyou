type OfflineListener = (isBrowsingOffline: boolean) => void;
const listeners = new Set<OfflineListener>();

let browsingOfflineState = false;
let openOfflineModalListener: (() => void) | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setBrowsingOffline(false);
  });
}

export function isBrowsingOffline(): boolean {
  return browsingOfflineState;
}

export function setBrowsingOffline(val: boolean): void {
  browsingOfflineState = val;
  listeners.forEach((fn) => {
    try {
      fn(val);
    } catch {}
  });
}

export function subscribeBrowsingOffline(fn: OfflineListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function registerOpenOfflineModal(fn: () => void): () => void {
  openOfflineModalListener = fn;
  return () => {
    if (openOfflineModalListener === fn) {
      openOfflineModalListener = null;
    }
  };
}

export function triggerOpenOfflineModal(): void {
  openOfflineModalListener?.();
}
