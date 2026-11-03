import React, { useEffect, useRef, useState, useCallback } from 'react';

interface ScreensaverXPProps {
  isSuppressed?: boolean;
}

export const ScreensaverXP: React.FC<ScreensaverXPProps> = ({ isSuppressed = false }) => {
  const [isActive, setIsActive] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Position and velocity for the bouncing logo
  const posRef = useRef({ x: 100, y: 100, vx: 2, vy: 1.6 });
  const logoBoxRef = useRef<HTMLDivElement>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isActive) {
      setIsActive(false);
    }

    if (!isSuppressed) {
      timeoutRef.current = window.setTimeout(() => {
        setIsActive(true);
      }, 30000); // 30 seconds idle timer
    }
  }, [isActive, isSuppressed]);

  // Handle suppression when modal media is playing
  useEffect(() => {
    if (isSuppressed) {
      setIsActive(false);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      resetTimer();
    }
  }, [isSuppressed, resetTimer]);

  // Attach global user activity listeners
  useEffect(() => {
    const handleActivity = () => {
      resetTimer();
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('mousedown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('wheel', handleActivity, { passive: true });

    resetTimer();

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('wheel', handleActivity);
    };
  }, [resetTimer]);

  // Bouncing animation physics loop
  useEffect(() => {
    if (!isActive) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const logoW = 200;
    const logoH = 120;

    // Pick a random starting point
    posRef.current.x = Math.max(20, Math.random() * (window.innerWidth - logoW - 40));
    posRef.current.y = Math.max(20, Math.random() * (window.innerHeight - logoH - 40));
    posRef.current.vx = (Math.random() > 0.5 ? 1 : -1) * (1.8 + Math.random() * 0.8);
    posRef.current.vy = (Math.random() > 0.5 ? 1 : -1) * (1.4 + Math.random() * 0.8);

    const updatePosition = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pos = posRef.current;

      pos.x += pos.vx;
      pos.y += pos.vy;

      // Bounce off horizontal viewport walls
      if (pos.x <= 0) {
        pos.x = 0;
        pos.vx = Math.abs(pos.vx);
      } else if (pos.x + logoW >= vw) {
        pos.x = vw - logoW;
        pos.vx = -Math.abs(pos.vx);
      }

      // Bounce off vertical viewport walls
      if (pos.y <= 0) {
        pos.y = 0;
        pos.vy = Math.abs(pos.vy);
      } else if (pos.y + logoH >= vh) {
        pos.y = vh - logoH;
        pos.vy = -Math.abs(pos.vy);
      }

      if (logoBoxRef.current) {
        logoBoxRef.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      }

      animFrameRef.current = requestAnimationFrame(updatePosition);
    };

    animFrameRef.current = requestAnimationFrame(updatePosition);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      onClick={resetTimer}
      className="fixed inset-0 z-[10000] bg-black cursor-none select-none overflow-hidden touch-none"
      style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}
    >
      <div
        ref={logoBoxRef}
        className="absolute top-0 left-0 will-change-transform flex flex-col items-center justify-center p-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]"
        style={{ width: '200px', height: '120px' }}
      >
        {/* Authentic Windows XP 4-Color Wave Flag */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg viewBox="0 0 88 88" className="w-16 h-16 filter drop-shadow-md">
            {/* Top-Left Red Pane */}
            <path
              d="M 10,12 C 22,7 34,16 42,12 C 43,26 43,40 43,40 C 33,44 21,35 10,40 Z"
              fill="#e73827"
            />
            {/* Top-Right Green Pane */}
            <path
              d="M 45,12 C 54,8 67,16 78,11 C 78,25 78,39 78,39 C 67,43 55,36 45,40 Z"
              fill="#74b52c"
            />
            {/* Bottom-Left Blue Pane */}
            <path
              d="M 10,43 C 22,38 34,47 42,43 C 43,57 43,71 43,71 C 33,75 21,66 10,71 Z"
              fill="#0099e5"
            />
            {/* Bottom-Right Yellow Pane */}
            <path
              d="M 45,43 C 54,39 67,48 78,43 C 78,57 78,71 78,71 C 67,75 55,67 45,71 Z"
              fill="#ffb700"
            />
          </svg>
        </div>
        <div className="mt-2 text-center text-white select-none">
          <div className="text-[10px] tracking-widest text-neutral-400 uppercase font-sans">
            Microsoft
          </div>
          <div className="text-sm font-bold tracking-wide flex items-center justify-center gap-1">
            <span>Windows</span>
            <span className="text-amber-500 text-xs font-black italic">XP</span>
          </div>
        </div>
      </div>
    </div>
  );
};
