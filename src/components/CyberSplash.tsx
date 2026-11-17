import React, { useEffect, useState } from 'react';
import { LaserSparkLogo } from './brand/LaserSparkLogo';

export interface CyberSplashProps {
  onComplete?: () => void;
  items?: any[]; // Kept for interface backward-compatibility
}

/**
 * 2B. Horizontal Razor Sweep Starter Screen
 * - Pure brand presentation: authentic SARWAR.CYOU logo only
 * - A single vertical hairline light guide sweeps smoothly from left to right
 * - Letters cleanly ignite directly behind the line into their living gradient
 * - Zero thumbnail caching during starter screen
 * - Smooth fade out handoff to homepage
 */
export const CyberSplash: React.FC<CyberSplashProps> = ({ onComplete }) => {
  const [dismissed, setDismissed] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // 1. Sweep animation plays for 1.9s
    // 2. At 2.1s, initiate smooth fade-out
    const dismissTimer = setTimeout(() => {
      setDismissed(true);
    }, 2100);

    // 3. At 2.7s, fully unmount and notify completion
    const removeTimer = setTimeout(() => {
      setRemoved(true);
      onComplete?.();
    }, 2700);

    return () => {
      clearTimeout(dismissTimer);
      clearTimeout(removeTimer);
    };
  }, [onComplete]);

  if (removed) return null;

  return (
    <div
      id="splashLayer"
      className={`fixed inset-0 z-[999999] flex items-center justify-center bg-[#030406] select-none transition-opacity duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        dismissed ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      style={{ borderRadius: 0, outline: 'none' }}
    >
      {/* Subtle Dark Ambient Void */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.05)_0%,rgba(139,92,246,0.03)_50%,transparent_75%)] pointer-events-none" />

      {/* 2B. Horizontal Razor Sweep Logo Stage */}
      <div className="relative flex items-center justify-center overflow-hidden p-8 sm:p-12 z-10 w-full max-w-[600px]">
        {/* Razor-Thin Vertical Hairline Light Guide */}
        <div className="cyber-sweep-line" />

        {/* Clean Logo Reveal (Unmasked behind the sweep line) */}
        <div className="cyber-sweep-logo filter drop-shadow-[0_0_16px_rgba(139,92,246,0.5)] drop-shadow-[0_0_26px_rgba(56,189,248,0.35)]">
          <LaserSparkLogo width={360} height={48} interactive={false} />
        </div>
      </div>

      <style>{`
        @keyframes v2bSweepLine {
          0% {
            left: 5%;
            opacity: 0;
          }
          15% {
            left: 10%;
            opacity: 1;
          }
          85% {
            left: 90%;
            opacity: 1;
          }
          100% {
            left: 95%;
            opacity: 0;
          }
        }

        @keyframes v2bLogoReveal {
          0% {
            clip-path: inset(0 100% 0 0);
            opacity: 0.3;
          }
          15% {
            clip-path: inset(0 90% 0 0);
            opacity: 1;
          }
          85% {
            clip-path: inset(0 0% 0 0);
            opacity: 1;
          }
          100% {
            clip-path: inset(0 0% 0 0);
            opacity: 1;
          }
        }

        .cyber-sweep-line {
          position: absolute;
          top: 15%;
          height: 70%;
          width: 2px;
          background: linear-gradient(180deg, transparent, #38bdf8 30%, #ffffff 50%, #8b5cf6 70%, transparent);
          box-shadow: 0 0 10px #38bdf8, 0 0 20px #8b5cf6;
          z-index: 20;
          animation: v2bSweepLine 1.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          pointer-events: none;
        }

        .cyber-sweep-logo {
          clip-path: inset(0 100% 0 0);
          animation: v2bLogoReveal 1.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default CyberSplash;
