import { useEffect } from 'react';

/**
 * Strict background scroll lock hook.
 * Prevents mobile rubber-banding and background page scrolling
 * by fixing body position at current scrollY and restoring position on unmount.
 */
export function useLockBodyScroll(isOpen: boolean = true) {
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const originalStyle = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.classList.add('viewing-media');

    return () => {
      // 1. Instantly disable smooth scroll so the restore happens in 0ms without animated auto-scroll
      const html = document.documentElement;
      const prevHtmlScrollBehavior = html.style.scrollBehavior;
      const prevBodyScrollBehavior = document.body.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      document.body.style.scrollBehavior = 'auto';

      // 2. Revert styles
      document.body.style.position = originalStyle.position;
      document.body.style.top = originalStyle.top;
      document.body.style.width = originalStyle.width;
      document.body.style.overflow = originalStyle.overflow;
      document.body.classList.remove('viewing-media');

      // 3. Immediately restore exact scroll position
      window.scrollTo(0, scrollY);

      // 4. Restore smooth scroll behavior on next frame
      requestAnimationFrame(() => {
        html.style.scrollBehavior = prevHtmlScrollBehavior;
        document.body.style.scrollBehavior = prevBodyScrollBehavior;
      });
    };
  }, [isOpen]);
}

export default useLockBodyScroll;
