import { useEffect } from 'react';

/**
 * useDynamicFavicon & Brand Color Engine
 *
 * Drives the continuous complementary color cycle:
 * - Base Hue θ rotates continuously from 0° to 360° over 12 seconds via a single requestAnimationFrame loop.
 * - Color A (Hue θ, 90% sat, 60% light) -> Applied synchronously to Logo Part A (#logo-part-a) and Title Part A (#title-sarwar).
 * - Color B (Complementary Hue (θ + 180) % 360, 90% sat, 60% light) -> Applied synchronously to Logo Part B (#logo-part-b) and Title Part B (#title-cyou).
 * - Dynamic glow effects applied via CSS variables:
 *     --brand-color-a, --brand-color-b, --glow-a, --glow-b
 * - Dynamic Synchronized Favicon Canvas Engine:
 *     Offscreen 64x64 canvas draws the identical two-piece geometric triangle (points 50,10 63,36 33,90 20,90 for Part A;
 *     points 68,46 90,90 46,90 for Part B) with current Color A and Color B, continuously updating <link id="dynamic-favicon">.
 * - Throttled to ~18 FPS (55ms) for zero CPU overhead.
 * - Pauses canvas rendering when document.hidden is true to conserve battery/resources, resuming immediately on focus.
 */
export function useDynamicFavicon(_legacyEmblemSrc?: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Create offscreen canvas for dynamic favicon
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Find or create dynamic favicon link
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

    const DURATION = 12000; // 12 seconds per full revolution
    const root = document.documentElement;
    let animId: number;
    let lastFaviconRender = 0;

    const renderFavicon = (colorA: string, colorB: string) => {
      if (!ctx || !faviconLink) return;
      ctx.clearRect(0, 0, 64, 64);

      ctx.save();
      // Scale 0..100 vector space to 64x64 canvas
      ctx.scale(0.64, 0.64);

      // Component A: Left Quadrilateral Body (SARWAR)
      // points="50,10 63,36 33,90 20,90"
      ctx.beginPath();
      ctx.moveTo(50, 10);
      ctx.lineTo(63, 36);
      ctx.lineTo(33, 90);
      ctx.lineTo(20, 90);
      ctx.closePath();
      ctx.fillStyle = colorA;
      ctx.fill();

      // Component B: Bottom-Right Triangle (CYOU)
      // points="68,46 90,90 46,90"
      ctx.beginPath();
      ctx.moveTo(68, 46);
      ctx.lineTo(90, 90);
      ctx.lineTo(46, 90);
      ctx.closePath();
      ctx.fillStyle = colorB;
      ctx.fill();

      ctx.restore();

      faviconLink.href = canvas.toDataURL('image/png');
    };

    function step(timestamp: number) {
      // Continuous Base Hue θ rotation (0° to 360° over 12s)
      const theta = ((timestamp % DURATION) / DURATION) * 360;
      const thetaComp = (theta + 180) % 360;

      // High saturation (90%) and balanced lightness (60%)
      const colorA = `hsl(${theta.toFixed(1)}, 90%, 60%)`;
      const colorB = `hsl(${thetaComp.toFixed(1)}, 90%, 60%)`;
      const glowA = `hsla(${theta.toFixed(1)}, 90%, 60%, 0.35)`;
      const glowB = `hsla(${thetaComp.toFixed(1)}, 90%, 60%, 0.35)`;

      // Set CSS custom properties on root
      root.style.setProperty('--brand-color-a', colorA);
      root.style.setProperty('--brand-color-b', colorB);
      root.style.setProperty('--glow-a', glowA);
      root.style.setProperty('--glow-b', glowB);

      // Synchronize favicon canvas if page is visible (throttled to ~18 FPS, 55ms)
      if (!document.hidden && timestamp - lastFaviconRender > 55) {
        lastFaviconRender = timestamp;
        renderFavicon(colorA, colorB);
      }

      animId = requestAnimationFrame(step);
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        lastFaviconRender = 0; // Trigger immediate render upon returning to the tab
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    animId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
