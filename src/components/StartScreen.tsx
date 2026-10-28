import React, { useState, useEffect, useCallback } from 'react';
import './StartScreen.css';

export const STORAGE_SPLASH_SEEN = 'scy_splash_seen';

export const StartScreen: React.FC = () => {
  const [mounted, setMounted] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !sessionStorage.getItem(STORAGE_SPLASH_SEEN);
    } catch {
      return false;
    }
  });

  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleDismiss = useCallback(() => {
    if (!mounted || isFadingOut) return;
    try {
      sessionStorage.setItem(STORAGE_SPLASH_SEEN, 'true');
    } catch {
      // ignore storage quota/private browsing issues
    }
    setIsFadingOut(true);
    setTimeout(() => {
      setMounted(false);
    }, 300);
  }, [mounted, isFadingOut]);

  // Automatic timeline sequence:
  // 0s - 1.1s: Laser tracing
  // 1.1s - 1.5s: Current surge fill & bloom
  // 1.5s - 1.8s: Smooth fade-out
  useEffect(() => {
    if (!mounted) return;

    // Start fade out at 1.5s
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1500);

    // Unmount at 1.8s
    const unmountTimer = setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE_SPLASH_SEEN, 'true');
      } catch {
        // ignore
      }
      setMounted(false);
    }, 1800);

    // Instant skip on any keypress
    const handleKeyDown = () => {
      handleDismiss();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, handleDismiss]);

  if (!mounted) return null;

  return (
    <div
      role="banner"
      aria-label="Welcome to Sarwarcyou"
      className={`start-screen-container ${isFadingOut ? 'fading-out' : ''}`}
      onClick={handleDismiss}
      onTouchStart={handleDismiss}
    >
      {/* Soft Radial Ambient Bloom */}
      <div className="start-screen-ambient-bloom" />

      {/* SVG Neon Circuit Drawing "SARWARCYOU" */}
      <svg
        viewBox="0 0 1000 220"
        className="start-screen-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="50%"
          y="56%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="neon-circuit-text"
        >
          SARWARCYOU
        </text>
      </svg>

      {/* Subtle Skip Hint */}
      <div className="start-screen-skip-hint">
        [ Click or Press Any Key to Skip ]
      </div>
    </div>
  );
};

export default StartScreen;
