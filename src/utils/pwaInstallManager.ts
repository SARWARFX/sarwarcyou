/**
 * PWA Install & Standalone Mode Manager
 * Handles BeforeInstallPromptEvent, iOS detection, and standalone state.
 */

let deferredPrompt: any = null;
const listeners = new Set<(canInstall: boolean) => void>();

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Global listener for beforeinstallprompt
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((cb) => cb(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((cb) => cb(false));
  });
}

export function hasDeferredPrompt(): boolean {
  return deferredPrompt !== null;
}

export function subscribeInstallable(callback: (canInstall: boolean) => void): () => void {
  listeners.add(callback);
  callback(deferredPrompt !== null || (!isStandalone() && isIos()));
  return () => {
    listeners.delete(callback);
  };
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable'> {
  if (isIos() && !isStandalone()) {
    return 'ios';
  }

  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      listeners.forEach((cb) => cb(false));
      return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
    } catch {
      return 'unavailable';
    }
  }

  return 'unavailable';
}
