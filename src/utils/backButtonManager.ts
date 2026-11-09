import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

export type BackHandler = () => boolean | void;

class BackButtonManager {
  private handlers: BackHandler[] = [];
  private isListenerAttached = false;
  private lastBackPressTime = 0;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined' || this.isListenerAttached) return;
    this.isListenerAttached = true;

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      // 1. Process active stack of registered back handlers (top of stack first)
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        const handler = this.handlers[i];
        const handled = handler();
        // If handler explicitly returns false, continue down stack; otherwise consider handled
        if (handled !== false) {
          return;
        }
      }

      // 2. If browser history can go back
      if (canGoBack && window.history.length > 1) {
        window.history.back();
        return;
      }

      // 3. Root Home screen: double-tap back within 2 seconds to exit app
      const now = Date.now();
      if (now - this.lastBackPressTime < 2000) {
        CapacitorApp.exitApp();
      } else {
        this.lastBackPressTime = now;
        this.showToast('Press back again to exit');
      }
    }).catch(() => {});
  }

  /**
   * Push a back-button handler. Returns an unregister function.
   */
  public pushHandler(handler: BackHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.removeHandler(handler);
    };
  }

  public removeHandler(handler: BackHandler) {
    const idx = this.handlers.indexOf(handler);
    if (idx !== -1) {
      this.handlers.splice(idx, 1);
    }
  }

  private showToast(message: string) {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('native-back-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'native-back-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 84px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(14, 18, 24, 0.92);
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 13px;
      font-family: 'Roboto Condensed', sans-serif;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      z-index: 999999;
      pointer-events: none;
      transition: opacity 0.25s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 1800);
  }
}

export const backButtonManager = new BackButtonManager();

/**
 * React hook to register a back-button handler while a component/modal is active.
 */
export function useBackButton(handler: BackHandler, active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    return backButtonManager.pushHandler(handler);
  }, [handler, active]);
}
