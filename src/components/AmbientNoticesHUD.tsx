import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

const NOTICES: { prefix: string; email: string; suffix: string }[] = [
  {
    prefix: 'Encountering issues? Reach out to ',
    email: 'contact@sarwar.cyou',
    suffix: '',
  },
  {
    prefix: 'Need assistance? Contact ',
    email: 'support@sarwar.cyou',
    suffix: '',
  },
  {
    prefix: 'Want your media featured? Email a public Google Drive link to ',
    email: 'publisher@sarwar.cyou',
    suffix: ' for editorial review.',
  },
];

export interface AmbientNoticesHUDProps {
  className?: string;
  style?: React.CSSProperties;
  visibleDurationMs?: number; // Duration to remain visible (~8.5s)
  intervalMs?: number;        // Interval between notifications (~90s / 1.5 min)
  initialDelayMs?: number;    // Delay before the first notification (~7s)
}

export const AmbientNoticesHUD: React.FC<AmbientNoticesHUDProps> = ({
  className = '',
  style,
  visibleDurationMs = 8500,
  intervalMs = 90000,
  initialDelayMs = 7000,
}) => {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [fade, setFade] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveredRef = useRef(false);
  isHoveredRef.current = isHovered;

  // Dismiss currently showing notice and schedule the next cycle
  const dismissNotice = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    setFade(false);

    if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    fadeOutTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setIndex((prev) => (prev + 1) % NOTICES.length);

      // Schedule next appearance after the interval
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      nextTimerRef.current = setTimeout(() => {
        showNotice();
      }, intervalMs);
    }, 450);
  }, [intervalMs]);

  // Show the notice with smooth transition
  const showNotice = useCallback(() => {
    setIsVisible(true);

    requestAnimationFrame(() => {
      setFade(true);
    });

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        dismissNotice();
      }
    }, visibleDurationMs);
  }, [visibleDurationMs, dismissNotice]);

  // Initial mount trigger
  useEffect(() => {
    nextTimerRef.current = setTimeout(() => {
      showNotice();
    }, initialDelayMs);

    return () => {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    };
  }, [initialDelayMs, showNotice]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (isVisible && fade) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        dismissNotice();
      }, 3500);
    }
  };

  if (!isVisible) {
    return null;
  }

  const current = NOTICES[index];

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto select-text font-mono text-xs text-white/95 max-w-sm sm:max-w-md transition-all duration-450 ease-out transform ${
        fade
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
      } ${className}`}
      style={{
        background: 'rgba(4, 7, 15, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        borderLeft: '3px solid #00f0ff',
        borderRadius: '6px',
        padding: '9px 12px 9px 14px',
        textShadow: '0 1px 4px #000, 0 0 8px #000',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(0, 240, 255, 0.18)',
        ...style,
      }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse flex-shrink-0" />
          <span className="leading-relaxed text-[11px] sm:text-xs text-zinc-100 break-words">
            {current.prefix}
            <a
              href={`mailto:${current.email}`}
              className="text-[#00f0ff] hover:underline font-semibold transition-colors"
            >
              {current.email}
            </a>
            {current.suffix}
          </span>
        </div>

        {/* Quick dismiss button */}
        <button
          type="button"
          onClick={dismissNotice}
          className="text-zinc-400 hover:text-[#00f0ff] hover:bg-white/10 rounded p-1 transition-all flex-shrink-0 active:scale-90"
          title="Dismiss notice"
          aria-label="Dismiss notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default AmbientNoticesHUD;
