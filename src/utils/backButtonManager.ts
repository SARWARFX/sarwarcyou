import { useEffect } from 'react';

export type BackHandler = () => boolean | void;

class BackButtonManager {
  private handlers: BackHandler[] = [];
  private isListenerAttached = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined' || this.isListenerAttached) return;
    this.isListenerAttached = true;

    // Handle Escape key for web modal dismissal
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        for (let i = this.handlers.length - 1; i >= 0; i--) {
          const handler = this.handlers[i];
          const handled = handler();
          if (handled !== false) {
            e.preventDefault();
            return;
          }
        }
      }
    });

    // Handle browser popstate
    window.addEventListener('popstate', () => {
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        const handler = this.handlers[i];
        const handled = handler();
        if (handled !== false) {
          return;
        }
      }
    });
  }

  public pushHandler(handler: BackHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  public removeHandler(handler: BackHandler): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }
}

export const backButtonManager = new BackButtonManager();

export function useBackButton(handler: BackHandler, isEnabled = true): void {
  useEffect(() => {
    if (!isEnabled) return;
    const unregister = backButtonManager.pushHandler(handler);
    return () => {
      unregister();
    };
  }, [handler, isEnabled]);
}
