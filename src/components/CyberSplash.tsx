import React, { useEffect, useState } from 'react';

interface CyberSplashProps {
  onComplete?: () => void;
}

export const CyberSplash: React.FC<CyberSplashProps> = ({ onComplete }) => {
  const [dismissed, setDismissed] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // 2.5s cinematic playback
    const dismissTimer = setTimeout(() => {
      setDismissed(true);
    }, 2500);

    // Unmount after smooth fade out (0.55s transition)
    const removeTimer = setTimeout(() => {
      setRemoved(true);
      if (onComplete) onComplete();
    }, 3050);

    return () => {
      clearTimeout(dismissTimer);
      clearTimeout(removeTimer);
    };
  }, [onComplete]);

  if (removed) return null;

  return (
    <div
      id="splashLayer"
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#050505] select-none app-screen-fade ${
        dismissed ? 'opacity-0 scale-[0.96] pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'
      }`}
    >
      {/* STAGE FOR INLINE ANIMATIONS */}
      <div id="animStage" className="relative w-64 h-64 flex items-center justify-center">
        <div className="relative w-52 h-52 flex items-center justify-center">
          {/* Horizontal Acid Lime Anamorphic Lens Flare Line */}
          <div className="absolute w-64 h-0.5 bg-gradient-to-r from-transparent via-[#ccff00] to-transparent v2-flare z-20 pointer-events-none drop-shadow-[0_0_12px_#ccff00]" />

          {/* Rotating Hairline Reticle */}
          <svg className="absolute inset-0 w-full h-full text-[#ccff00] v2-reticle-spin" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="54" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="10 8" opacity="0.3" />
            <circle cx="60" cy="60" r="46" stroke="#ccff00" strokeWidth="1" strokeDasharray="3 6" opacity="0.8" />
            <line x1="60" y1="2" x2="60" y2="16" stroke="#ccff00" strokeWidth="2" />
            <line x1="60" y1="104" x2="60" y2="118" stroke="#ccff00" strokeWidth="2" />
            <line x1="2" y1="60" x2="16" y2="60" stroke="#ccff00" strokeWidth="2" />
            <line x1="104" y1="60" x2="118" y2="60" stroke="#ccff00" strokeWidth="2" />
          </svg>

          {/* Aperture Blades Shutter (SVG) */}
          <svg className="absolute w-40 h-40" viewBox="0 0 100 100" fill="none">
            <path className="v2-blade-1" d="M50 15 L85 50 L50 85 Z" stroke="#ccff00" strokeWidth="1.2" strokeDasharray="4 2" fill="rgba(204, 255, 0, 0.04)" />
            <path className="v2-blade-2" d="M15 50 L50 15 L50 85 Z" stroke="#ffffff" strokeWidth="1" strokeDasharray="4 2" fill="rgba(255, 255, 255, 0.03)" opacity="0.6" />
          </svg>

          {/* Central High-Impact Play Glyph Emblem */}
          <div className="relative z-10 w-20 h-20 rounded-2xl bg-neutral-950 border border-[#ccff00] shadow-[0_0_30px_rgba(204,255,0,0.3)] flex items-center justify-center">
            <svg className="w-10 h-10 text-[#ccff00] fill-current translate-x-1 filter drop-shadow-[0_0_10px_#ccff00]" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Brand Typography Lockup */}
      <div className="mt-4 flex flex-col items-center text-center z-10 font-['Space_Grotesk',sans-serif]">
        <h2 id="brandTitle" className="text-2xl sm:text-3xl font-extrabold tracking-[0.22em] text-white logo-text-anim">
          SARWAR<span className="text-[#ccff00]">.CYOU</span>
        </h2>
        <p id="brandSub" className="text-[10px] text-[#ccff00] font-mono tracking-[0.3em] uppercase mt-2 sub-tag-anim">
          BIENNALE EDITION // VOL. 2026
        </p>
      </div>

      {/* Animated Bottom Acid Lime Progress Track */}
      <div className="w-24 h-1 bg-neutral-900 rounded-full mt-6 overflow-hidden border border-neutral-800 z-10">
        <div id="splashProgress" className="h-full bg-[#ccff00] w-full animate-pulse shadow-[0_0_8px_#ccff00]" />
      </div>

      {/* Micro Telemetry Stamp */}
      <div className="absolute bottom-8 flex items-center gap-2 text-neutral-500 text-[10px] font-mono z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00]"></span>
        <span>VERIFIED CINEMA ARCHIVE</span>
      </div>
    </div>
  );
};

export default CyberSplash;
