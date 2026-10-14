import React, { useEffect, useMemo, useRef, useState } from 'react';

interface BrandLogoProps {
  activeAlbumIndex?: number;
  isLightMode?: boolean;
}

// Chromatic Color stops: White -> Neon Blue -> Violet -> Crimson -> Amber -> White
const CHROMATIC_STOPS = [
  { r: 255, g: 255, b: 255 }, // White
  { r: 0, g: 210, b: 255 },   // Electric Neon Blue
  { r: 157, g: 0, b: 255 },   // Electric Violet
  { r: 255, g: 0, b: 85 },    // Crimson
  { r: 255, g: 153, b: 0 },   // Amber
  { r: 255, g: 255, b: 255 }, // White
];

function interpolateColor(t: number): { hex: string; rgb: string } {
  // t is 0..1
  const scaled = t * (CHROMATIC_STOPS.length - 1);
  const index = Math.floor(scaled);
  const frac = scaled - index;
  const c1 = CHROMATIC_STOPS[index];
  const c2 = CHROMATIC_STOPS[Math.min(index + 1, CHROMATIC_STOPS.length - 1)];

  const r = Math.round(c1.r + (c2.r - c1.r) * frac);
  const g = Math.round(c1.g + (c2.g - c1.g) * frac);
  const b = Math.round(c1.b + (c2.b - c1.b) * frac);

  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  return { hex, rgb: `rgb(${r}, ${g}, ${b})` };
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  activeAlbumIndex = 0,
  isLightMode = false,
}) => {
  const [currentColor, setCurrentColor] = useState('#00D2FF');
  const faviconCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faviconLinkRef = useRef<HTMLLinkElement | null>(null);

  // 1. Living chromatic gradient cycle & real-time favicon sync
  useEffect(() => {
    // Find or create favicon element
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'shortcut icon';
      document.head.appendChild(link);
    }
    faviconLinkRef.current = link;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    faviconCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');

    let startTime = performance.now();
    let frameId: number;
    let lastFaviconUpdate = 0;

    const updateLivingColor = (time: number) => {
      // 12-second slow, luxury-grade cycle across the chromatic spectrum
      const cycleDuration = 12000;
      const progress = ((time - startTime) % cycleDuration) / cycleDuration;
      const { hex } = interpolateColor(progress);
      setCurrentColor(hex);

      // Throttle favicon updates to ~15 FPS to avoid unnecessary browser overhead
      if (time - lastFaviconUpdate > 66 && ctx && link) {
        lastFaviconUpdate = time;
        ctx.clearRect(0, 0, 64, 64);

        // Draw modern electric play glyph
        ctx.fillStyle = hex;
        ctx.shadowColor = hex;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        // Centered equilateral triangle with rounded vertices
        const cx = 33;
        const cy = 32;
        const r = 24;
        ctx.moveTo(cx + r * 0.8, cy);
        ctx.lineTo(cx - r * 0.6, cy - r * 0.75);
        ctx.lineTo(cx - r * 0.6, cy + r * 0.75);
        ctx.closePath();
        ctx.fill();

        link.href = canvas.toDataURL('image/png');
      }

      frameId = requestAnimationFrame(updateLivingColor);
    };

    frameId = requestAnimationFrame(updateLivingColor);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  // 2. Corner Cycling across albums (0: TL, 1: TR, 2: BR, 3: BL)
  const cornerIndex = activeAlbumIndex % 4;

  const cornerClasses = useMemo(() => {
    switch (cornerIndex) {
      case 0:
        return 'top-6 left-6 sm:top-8 sm:left-8';
      case 1:
        return 'top-6 right-6 sm:top-8 sm:right-8';
      case 2:
        return 'bottom-6 right-6 sm:bottom-8 sm:right-8';
      case 3:
        return 'bottom-6 left-6 sm:bottom-8 sm:left-8';
      default:
        return 'top-6 left-6 sm:top-8 sm:left-8';
    }
  }, [cornerIndex]);

  return (
    <div
      className={`fixed ${cornerClasses} z-40 select-none pointer-events-auto flex items-center gap-3.5 group cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105`}
    >
      {/* Dynamic Glowing Play Glyph */}
      <div className="flex items-center justify-center w-7 h-7 md:w-10 md:h-10">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill={currentColor}
          style={{
            filter: `drop-shadow(0 0 16px ${currentColor})`,
            transition: 'filter 0.3s ease',
          }}
          className="h-7 w-7 md:h-10 md:w-10 group-hover:scale-105 transition-transform duration-300"
        >
          <path d="M5.5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.78 2.586A1.5 1.5 0 005.5 3.868z" />
        </svg>
      </div>

      {/* Prominent Scaled Brand Name with Living Chromatic Flow */}
      <span
        style={{
          backgroundImage: isLightMode
            ? `linear-gradient(135deg, #050811 0%, #1a2536 45%, ${currentColor} 100%)`
            : `linear-gradient(135deg, #FFFFFF 0%, ${currentColor} 55%, #FFFFFF 100%)`,
          textShadow: isLightMode
            ? `0 2px 14px rgba(0,0,0,0.12)`
            : `0 0 24px ${currentColor}55`,
        }}
        className="font-brand font-black tracking-wider md:tracking-widest text-lg sm:text-xl md:text-2xl lg:text-3xl bg-clip-text text-transparent leading-none uppercase select-none transition-all duration-300"
      >
        SARWARCYOU
      </span>
    </div>
  );
};
