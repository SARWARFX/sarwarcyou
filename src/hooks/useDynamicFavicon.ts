import { useEffect } from 'react';

/**
 * useDynamicFavicon & Tri-Fold Interlocking Delta Spectral Engine
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
 *   filled with the exact createLinearGradient(0, 0, 64, 64) and tri-fold interlocking delta paths (~15 FPS throttle).
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
      // Scale 0..120 vector coordinates to 64x64 canvas
      ctx.scale(64 / 120, 64 / 120);
      ctx.fillStyle = grad;

      // Piece 1: Left Angled Leg (d="M 60,15 L 43,45 L 29,69 L 45,69 L 55,52 L 67,31 Z")
      ctx.beginPath();
      ctx.moveTo(60, 15);
      ctx.lineTo(43, 45);
      ctx.lineTo(29, 69);
      ctx.lineTo(45, 69);
      ctx.lineTo(55, 52);
      ctx.lineTo(67, 31);
      ctx.closePath();
      ctx.fill();

      // Piece 2: Right Slant Beam (d="M 67,31 L 52,56 L 68,56 L 93,105 L 109,105 L 75,37 Z")
      ctx.beginPath();
      ctx.moveTo(67, 31);
      ctx.lineTo(52, 56);
      ctx.lineTo(68, 56);
      ctx.lineTo(93, 105);
      ctx.lineTo(109, 105);
      ctx.lineTo(75, 37);
      ctx.closePath();
      ctx.fill();

      // Piece 3: Bottom Left Fold & Base (d="M 45,69 L 29,69 L 11,105 L 38,105 L 53,75 L 68,75 L 68,56 L 52,56 Z")
      ctx.beginPath();
      ctx.moveTo(45, 69);
      ctx.lineTo(29, 69);
      ctx.lineTo(11, 105);
      ctx.lineTo(38, 105);
      ctx.lineTo(53, 75);
      ctx.lineTo(68, 75);
      ctx.lineTo(68, 56);
      ctx.lineTo(52, 56);
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
      const svgMidStops = document.querySelectorAll<SVGStopElement>('#svg-gradient-mid, .svg-gradient-mid');
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
