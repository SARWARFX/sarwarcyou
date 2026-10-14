import { useEffect } from 'react';

/**
 * useDynamicFavicon
 * Synchronizes the browser tab favicon with the on-screen harmonic hue rotation.
 * Renders the metallic emblem into a canvas and rotates its hue over an 8-second cycle,
 * perfectly synchronized with .brand-harmonic-graphic and .brand-harmonic-text.
 */
export function useDynamicFavicon(emblemSrc = '/favicon-emblem.png') {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const faviconImg = new Image();
    faviconImg.src = emblemSrc;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    let faviconLink = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
    if (!faviconLink) {
      faviconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    }
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.id = 'dynamic-favicon';
      faviconLink.type = 'image/png';
      faviconLink.rel = 'shortcut icon';
      document.head.appendChild(faviconLink);
    }

    let start = 0;
    let animId: number;
    let lastRender = 0;

    function step(timestamp: number) {
      if (!start) start = timestamp;
      const progress = (timestamp - start) % 8000;
      const degrees = (progress / 8000) * 360;

      // Throttle canvas & favicon URI updates to ~18 FPS (every 55ms) to keep tab icon silky smooth without CPU overhead
      if (ctx && faviconImg.complete && timestamp - lastRender > 55) {
        lastRender = timestamp;
        ctx.clearRect(0, 0, 64, 64);
        ctx.filter = `hue-rotate(${degrees}deg)`;
        ctx.drawImage(faviconImg, 0, 0, 64, 64);
        if (faviconLink) {
          faviconLink.href = canvas.toDataURL('image/png');
        }
      }
      animId = requestAnimationFrame(step);
    }

    animId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [emblemSrc]);
}
