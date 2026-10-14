import React, { useState, useEffect, useRef } from 'react';
import { preloadInitialThumbnails } from '../utils/clientVideoThumbnails';

interface SplashPreloaderProps {
  isReady?: boolean;
  initialVideoUrls?: string[];
}

export const SplashPreloader: React.FC<SplashPreloaderProps> = ({
  isReady = false,
  initialVideoUrls = [],
}) => {
  const [progress, setProgress] = useState<number>(12);
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem('sarwarcyou_splash_completed') === 'true') {
        return false;
      }
    } catch {
      // ignore storage errors
    }
    return true;
  });
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [colorProgress, setColorProgress] = useState<number>(0);
  const startTimeRef = useRef<number>(0);
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (startTimeRef.current === 0) {
      startTimeRef.current = performance.now();
    }
  }, []);

  useEffect(() => {
    let frameId: number;
    const start = performance.now();
    const update = (now: number) => {
      setColorProgress(((now - start) % 4000) / 4000);
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Smooth progress ticker: fills to ~88% while initial Hugging Face metadata fetches
  useEffect(() => {
    if (!isVisible) return;

    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        const remaining = 90 - prev;
        const step = Math.max(0.6, remaining * 0.12);
        return Math.min(88, prev + step);
      });
    }, 60);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let fadeTimer: number;
    let removeTimer: number;
    let hasCompleted = false;

    const completePreload = () => {
      if (hasCompleted) return;
      hasCompleted = true;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);

      setProgress(100);

      try {
        sessionStorage.setItem('sarwarcyou_splash_completed', 'true');
      } catch {
        // ignore storage errors
      }

      fadeTimer = window.setTimeout(() => {
        setIsFadingOut(true);
        removeTimer = window.setTimeout(() => {
          setIsVisible(false);
        }, 500);
      }, 350);
    };

    // Minimum display threshold: ~1.4s ensures clean aesthetic pacing
    const triggerCompleteWhenReady = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const minDisplayThreshold = 1400;
      const remainingTime = Math.max(0, minDisplayThreshold - elapsed);

      window.setTimeout(() => {
        completePreload();
      }, remainingTime);
    };

    // Safety fallback timeout: max 2.8 seconds guarantees zero permanent lockout
    const hardTimeout = window.setTimeout(() => {
      completePreload();
    }, 2800);

    if (isReady) {
      if (initialVideoUrls && initialVideoUrls.length > 0) {
        preloadInitialThumbnails(initialVideoUrls, 6, 2600).then(() => {
          triggerCompleteWhenReady();
        });
      } else {
        triggerCompleteWhenReady();
      }
    }

    return () => {
      clearTimeout(hardTimeout);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [isReady, initialVideoUrls, isVisible]);

  if (!isVisible) return null;

  const hue = Math.round(colorProgress * 360);
  const glowColor = `hsl(${hue}, 85%, 65%)`;

  return (
    <div
      role="status"
      aria-label="Loading platform"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black transition-opacity duration-500 ease-out select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
    >
      {/* Clean, dark, minimal container with zero clutter */}
      <div className="relative z-10 flex flex-col items-center gap-5 sm:gap-6 w-full max-w-full px-4 text-center">
        {/* Main Display Title - Single Line Guaranteed */}
        <h1 className="w-full max-w-full font-brand font-black tracking-widest text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl text-white uppercase leading-none drop-shadow-[0_0_35px_rgba(255,255,255,0.2)] whitespace-nowrap overflow-hidden text-center truncate">
          This site does not show ads
        </h1>

        {/* Directly beneath this text, render only the sleek, smooth horizontal loading progress bar */}
        <div className="w-56 sm:w-72 md:w-80 h-[3px] bg-zinc-900 rounded-full overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, #00D2FF 0%, ${glowColor} 50%, #9D00FF 100%)`,
              boxShadow: `0 0 14px ${glowColor}aa`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
