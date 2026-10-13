/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef } from 'react';
import { getDirectImageUrl } from '../utils/imageUrlResolver';
import type { AlbumData } from '../types';

interface PreloaderScreenProps {
  albums: AlbumData[];
  onLoaded: () => void;
}

export const PreloaderScreen: React.FC<PreloaderScreenProps> = ({
  albums,
  onLoaded,
}) => {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const hasStartedRef = useRef(false);

  // Living chromatic color stops for branding pulse
  const [currentColor, setCurrentColor] = useState('#00D2FF');

  useEffect(() => {
    let animId: number;
    const startTime = performance.now();
    const cycleColors = ['#00D2FF', '#9D00FF', '#FF0055', '#FF9900', '#00D2FF'];

    const updateColor = (now: number) => {
      const t = ((now - startTime) % 4000) / 4000;
      const index = Math.floor(t * (cycleColors.length - 1));
      setCurrentColor(cycleColors[index]);
      animId = requestAnimationFrame(updateColor);
    };

    animId = requestAnimationFrame(updateColor);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Asset pre-caching engine
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const urlsToPreload: string[] = [];

    // Harvest critical photo assets across all albums
    albums.forEach((album) => {
      const items = album.items || [];
      // Preload first 8 items per album for instant zero-buffer rendering
      const slice = items.slice(0, 8);
      slice.forEach((it, idx) => {
        const url = getDirectImageUrl(it, idx);
        if (url && !urlsToPreload.includes(url)) {
          urlsToPreload.push(url);
        }
      });
    });

    const totalAssets = Math.max(urlsToPreload.length, 1);
    let loadedCount = 0;

    urlsToPreload.forEach((url) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
      };
      img.onerror = () => {
        loadedCount++;
      };
      img.src = url;
    });

    // Smooth progress interpolation loop
    let currentDisplay = 0;
    const loopStartTime = performance.now();
    const minLoadTimeMs = 1500; // guarantee luxury brand presence
    const maxSafetyTimeMs = 3800; // guarantee never getting stuck
    let progressAnimId: number;

    const tick = (now: number) => {
      const elapsed = now - loopStartTime;
      const actualRatio = loadedCount / totalAssets;

      // Eased progress target
      let targetProgress = Math.min(Math.round(actualRatio * 100), 100);

      // Enforce smooth minimum time curve
      const timeRatio = Math.min(elapsed / minLoadTimeMs, 1);
      const timeBasedCap = Math.round(timeRatio * 100);

      if (elapsed < minLoadTimeMs) {
        targetProgress = Math.min(targetProgress, timeBasedCap);
      }

      // Safety timeout forces 100%
      if (elapsed >= maxSafetyTimeMs) {
        targetProgress = 100;
      }

      // Smooth step towards target
      if (currentDisplay < targetProgress) {
        currentDisplay += Math.max(1, Math.round((targetProgress - currentDisplay) * 0.15));
        if (currentDisplay > 100) currentDisplay = 100;
        setProgress(currentDisplay);
      }

      if (currentDisplay >= 100 && (elapsed >= minLoadTimeMs || actualRatio >= 1)) {
        // Complete! Wait 250ms at 100% then smoothly dissolve
        window.setTimeout(() => {
          setIsFadingOut(true);
          window.setTimeout(() => {
            setIsDone(true);
            onLoaded();
          }, 850);
        }, 220);
        return;
      }

      progressAnimId = requestAnimationFrame(tick);
    };

    progressAnimId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(progressAnimId);
  }, [albums, onLoaded]);

  if (isDone) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        transition: 'opacity 850ms cubic-bezier(0.16, 1, 0.3, 1), transform 850ms cubic-bezier(0.16, 1, 0.3, 1), filter 850ms cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.02)' : 'scale(1)',
        filter: isFadingOut ? 'blur(10px)' : 'blur(0px)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0a0a0c] select-none"
    >
      {/* 1. Subtle hairline architectural dot grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px]" />

      {/* 2. Soft atmospheric vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />

      {/* 3. Central Living Chromatic Branding */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Glowing Play Glyph */}
        <div className="flex items-center justify-center animate-pulse duration-1000">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill={currentColor}
            style={{
              filter: `drop-shadow(0 0 24px ${currentColor})`,
              transition: 'fill 0.4s ease, filter 0.4s ease',
            }}
          >
            <path d="M5.5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.78 2.586A1.5 1.5 0 005.5 3.868z" />
          </svg>
        </div>

        {/* Brand Wordmark */}
        <span
          style={{
            backgroundImage: `linear-gradient(135deg, #FFFFFF 0%, ${currentColor} 60%, #FFFFFF 100%)`,
            textShadow: `0 0 35px ${currentColor}44`,
          }}
          className="font-space font-black tracking-[0.28em] text-2xl sm:text-3xl md:text-4xl bg-clip-text text-transparent uppercase transition-all duration-300"
        >
          SARWAR C YOU
        </span>

        {/* Razor-thin hairline progress line */}
        <div className="w-52 sm:w-64 h-[1px] bg-white/10 relative overflow-hidden mt-4">
          <div
            style={{
              width: `${progress}%`,
              transition: 'width 120ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="h-full bg-gradient-to-r from-[#00D2FF] via-[#9D00FF] to-[#00D2FF]"
          />
        </div>

        {/* Editorial Percentage Counter & Monospace Status */}
        <div className="flex items-center justify-between w-52 sm:w-64 text-[10px] font-mono tracking-[0.25em] text-white/50 uppercase mt-1">
          <span>ARCHIVE // INIT</span>
          <span className="text-[#00D2FF] font-semibold">{progress}%</span>
        </div>
      </div>
    </div>
  );
};
