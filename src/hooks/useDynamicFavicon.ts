import { useEffect } from 'react';

/**
 * useDynamicFavicon & Interlocking Delta Spectral Engine
 *
 * Drives the unified, synchronized spectral gradient:
 * - 3-stop linear gradient: [ #ffffff (0%) -> HSL(θ, 100%, 65%) (50%) -> #ffffff (100%) ]
 * - Base Hue θ initializes at Electric Blue (θ ≈ 205°) and smoothly cycles 360° over 18 seconds.
 * - Single requestAnimationFrame loop updating root CSS variables:
 *     --current-hue: θ;
 *     --dynamic-accent-hue: θdeg;
 *     --brand-dynamic-color: hsl(θ, 100%, 65%);
 *     --brand-dynamic-glow: hsla(θ, 100%, 65%, 0.35);
 * - Simultaneously updates all #svg-gradient-mid / .svg-gradient-mid SVG stop colors.
 * - Synchronizes browser dynamic favicon in real time via an offscreen 64x64 canvas
 *   drawing the exact 3-segment interlocking delta paths filled with the active gradient (~15 FPS throttle).
 * - Fully pauses rendering during document.hidden to eliminate battery/CPU drain.
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

    const DURATION = 18000; // 18 seconds per full revolution (smooth ambient cycle)
    const INITIAL_HUE = 205; // Initialize at Electric Blue (205°)
    const root = document.documentElement;
    let animId: number;
    let lastFaviconRender = 0;
    let startTimestamp = 0;

    const renderFavicon = (midColor: string) => {
      if (!ctx || !faviconLink) return;
      ctx.clearRect(0, 0, 64, 64);

      // Generate canvas linear gradient from top-left to bottom-right
      const grad = ctx.createLinearGradient(0, 0, 64, 64);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, midColor);
      grad.addColorStop(1, '#ffffff');

      ctx.save();
      // Scale 0..100 vector coordinates to 64x64 canvas
      ctx.scale(0.64, 0.64);
      ctx.fillStyle = grad;

      // Segment 1: Top-Left Apex Bar (d="M 50,6 L 62,28 L 47,56 L 31,56 Z")
      ctx.beginPath();
      ctx.moveTo(50, 6);
      ctx.lineTo(62, 28);
      ctx.lineTo(47, 56);
      ctx.lineTo(31, 56);
      ctx.closePath();
      ctx.fill();

      // Segment 2: Bottom-Left Foot & Center Fold (d="M 24,67 L 41,67 L 54,92 L 11,92 L 24,67 Z M 44,67 L 58,41 L 69,61 L 55,61 Z")
      ctx.beginPath();
      ctx.moveTo(24, 67);
      ctx.lineTo(41, 67);
      ctx.lineTo(54, 92);
      ctx.lineTo(11, 92);
      ctx.closePath();
      ctx.moveTo(44, 67);
      ctx.lineTo(58, 41);
      ctx.lineTo(69, 61);
      ctx.lineTo(55, 61);
      ctx.closePath();
      ctx.fill();

      // Segment 3: Right Slanted Leg (d="M 64,19 L 50,46 L 63,69 L 89,92 L 100,92 Z")
      ctx.beginPath();
      ctx.moveTo(64, 19);
      ctx.lineTo(50, 46);
      ctx.lineTo(63, 69);
      ctx.lineTo(89, 92);
      ctx.lineTo(100, 92);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      faviconLink.href = canvas.toDataURL('image/png');
    };

    function step(timestamp: number) {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;

      // Continuous Hue θ rotation initializing at 205°
      const theta = (INITIAL_HUE + ((elapsed % DURATION) / DURATION) * 360) % 360;
      const thetaFormatted = theta.toFixed(1);

      const midColor = `hsl(${thetaFormatted}, 100%, 65%)`;
      const glowColor = `hsla(${thetaFormatted}, 100%, 65%, 0.35)`;

      // Set CSS variables on document root
      root.style.setProperty('--current-hue', thetaFormatted);
      root.style.setProperty('--dynamic-accent-hue', `${thetaFormatted}deg`);
      root.style.setProperty('--brand-dynamic-color', midColor);
      root.style.setProperty('--brand-dynamic-glow', glowColor);
      root.style.setProperty('--brand-color-a', midColor);

      // Simultaneously update SVG gradient stop-colors directly
      const midElement = document.getElementById('svg-gradient-mid');
      if (midElement) {
        midElement.setAttribute('stop-color', midColor);
        midElement.style.stopColor = midColor;
      }
      const svgMidStops = document.querySelectorAll<SVGStopElement>('.svg-gradient-mid');
      for (let i = 0; i < svgMidStops.length; i++) {
        svgMidStops[i].setAttribute('stop-color', midColor);
        svgMidStops[i].style.stopColor = midColor;
      }

      // Synchronize favicon canvas if document is active & visible (throttled to ~15 FPS / ~66ms)
      if (!document.hidden && timestamp - lastFaviconRender > 66) {
        lastFaviconRender = timestamp;
        renderFavicon(midColor);
      }

      // Continue animation loop only if tab remains visible
      if (!document.hidden) {
        animId = requestAnimationFrame(step);
      }
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Resuming from background: force immediate render and restart loop
        lastFaviconRender = 0;
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(step);
      } else {
        // Backgrounded: cancel loop to eliminate battery drain
        cancelAnimationFrame(animId);
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
