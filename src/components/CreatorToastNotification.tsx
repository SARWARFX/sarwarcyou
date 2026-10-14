import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface CreatorToastNotificationProps {
  isModalOpen?: boolean;
  hasBackToTop?: boolean;
}

const STORAGE_KEY = 'sarwarcyou_creator_toast_dismissed';

export const CreatorToastNotification: React.FC<CreatorToastNotificationProps> = ({
  isModalOpen = false,
  hasBackToTop = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const autoHideTimerRef = useRef<number | null>(null);
  const triggerTimerRef = useRef<number | null>(null);
  const isDismissedRef = useRef(false);

  // Check if previously dismissed in this session
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === 'true') {
        isDismissedRef.current = true;
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  const dismissPermanently = useCallback(() => {
    setIsFadingOut(true);
    isDismissedRef.current = true;
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }

    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }

    window.setTimeout(() => {
      setIsVisible(false);
    }, 450);
  }, []);

  // Trigger once per session after 25 seconds of browsing
  useEffect(() => {
    if (isDismissedRef.current) return;

    triggerTimerRef.current = window.setTimeout(() => {
      if (!isDismissedRef.current) {
        setIsVisible(true);
      }
    }, 25000);

    return () => {
      if (triggerTimerRef.current) {
        clearTimeout(triggerTimerRef.current);
      }
    };
  }, []);

  // 10-second auto-hide timer when visible, paused while hovered
  useEffect(() => {
    if (!isVisible || isFadingOut || isDismissedRef.current) return;

    if (isHovered) {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
      return;
    }

    // Auto-fade after 10s if not hovered
    autoHideTimerRef.current = window.setTimeout(() => {
      dismissPermanently();
    }, 10000);

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [isVisible, isHovered, isFadingOut, dismissPermanently]);

  // Zero Interruption: hide completely when a media modal/player is open or in fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!isVisible || isModalOpen || isFullscreen) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed z-40 pointer-events-auto transition-all duration-500 ease-out select-none ${
        hasBackToTop
          ? 'bottom-20 right-4 sm:bottom-22 sm:right-8'
          : 'bottom-5 right-4 sm:bottom-8 sm:right-8'
      } ${
        isFadingOut
          ? 'opacity-0 translate-y-3 pointer-events-none'
          : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full bg-[#0a0c10]/85 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.85)] border border-white/[0.08] text-zinc-300 font-['Rajdhani',sans-serif] text-[12px] sm:text-[13px] tracking-wide max-w-[90vw] sm:max-w-md">
        {/* Pulsing cyan dot indicator */}
        <span
          className="w-2 h-2 rounded-full bg-[#00D2FF] shadow-[0_0_8px_#00D2FF] shrink-0 animate-pulse"
          aria-hidden="true"
        />

        {/* Message */}
        <p className="leading-snug text-zinc-300">
          Want your media featured here? Share a public Google Drive link with{' '}
          <a
            href="mailto:publisher@sarwar.cyou"
            className="text-[#38bdf8] hover:text-white underline underline-offset-2 transition-all duration-200 decoration-[#38bdf8]/40 hover:decoration-white font-medium hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"
          >
            publisher@sarwar.cyou
          </a>
        </p>

        {/* Discrete Close Button (×) */}
        <button
          type="button"
          onClick={dismissPermanently}
          className="ml-1 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer shrink-0"
          title="Dismiss for this session"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
