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
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#030712] select-none app-screen-fade ${
        dismissed ? 'opacity-0 scale-[0.96] pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'
      }`}
    >
      {/* STAGE FOR INLINE ANIMATIONS */}
      <div id="animStage" className="relative w-64 h-64 flex items-center justify-center">
        <div className="relative w-52 h-52 flex items-center justify-center">
          {/* Horizontal Anamorphic Lens Flare Line */}
          <div className="absolute w-64 h-0.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent v2-flare z-20 pointer-events-none" />

          {/* Rotating HUD Target Reticle */}
          <svg className="absolute inset-0 w-full h-full text-cyan-400 v2-reticle-spin" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="54" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="10 8" />
            <circle cx="60" cy="60" r="46" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 6" opacity="0.6" />
            <line x1="60" y1="2" x2="60" y2="16" stroke="#38bdf8" strokeWidth="2" />
            <line x1="60" y1="104" x2="60" y2="118" stroke="#38bdf8" strokeWidth="2" />
            <line x1="2" y1="60" x2="16" y2="60" stroke="#38bdf8" strokeWidth="2" />
            <line x1="104" y1="60" x2="118" y2="60" stroke="#38bdf8" strokeWidth="2" />
          </svg>

          {/* Aperture Blades Shutter (SVG) */}
          <svg className="absolute w-40 h-40 text-cyan-400" viewBox="0 0 100 100" fill="none">
            <path className="v2-blade-1" d="M50 15 L85 50 L50 85 Z" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" fill="rgba(2, 132, 199, 0.08)" />
            <path className="v2-blade-2" d="M15 50 L50 15 L50 85 Z" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="4 2" fill="rgba(3, 7, 18, 0.2)" />
          </svg>

          {/* Central High-Impact Play Glyph */}
          <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#030712] to-[#0c1e38] border border-cyan-400/80 shadow-2xl shadow-sky-500/50 flex items-center justify-center">
            <svg className="w-10 h-10 text-cyan-300 fill-current translate-x-1 filter drop-shadow(0 0 12px #38bdf8)" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Brand Typography Lockup */}
      <div className="mt-4 flex flex-col items-center text-center z-10">
        <h2 id="brandTitle" className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-sky-400 tracking-[0.26em] logo-text-anim">
          SARWARCYOU
        </h2>
        <p id="brandSub" className="text-[10px] text-cyan-400/80 font-mono-code tracking-[0.25em] uppercase mt-2 sub-tag-anim">
          QUANTUM MEDIA VAULT
        </p>
      </div>

      {/* Animated Bottom Progress Track */}
      <div className="w-24 h-1 bg-slate-900 rounded-full mt-6 overflow-hidden border border-slate-800/80 z-10">
        <div id="splashProgress" className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 w-full animate-pulse" />
      </div>

      {/* Small bottom hardware security badge */}
      <div className="absolute bottom-8 flex items-center gap-2 text-slate-600 text-[10px] font-mono-code z-10">
        <svg className="w-3.5 h-3.5 text-cyan-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span>SCOPED HARDWARE ENCLAVE</span>
      </div>
    </div>
  );
};
