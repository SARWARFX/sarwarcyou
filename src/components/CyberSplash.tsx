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
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#000000] select-none transition-all duration-700 ease-out ${
        dismissed ? 'opacity-0 scale-[0.98] pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'
      }`}
    >
      {/* Minimalist Apple-Style Brand Lockup */}
      <div className="flex flex-col items-center text-center z-10 transition-transform duration-700">
        <h2 className="text-2xl sm:text-3xl font-['Roboto_Condensed'] font-black text-white tracking-[0.3em] uppercase">
          SARWAR<span className="text-white/50">CYOU</span>
        </h2>
        <p className="text-[10px] text-zinc-400 tracking-[0.35em] font-sans uppercase mt-2.5">
          CELEBRITY ARCHIVE &middot; CINEMA
        </p>

        {/* Refined Minimalist Thin Progress Line */}
        <div className="w-28 h-[1.5px] bg-white/10 rounded-full mt-7 overflow-hidden">
          <div className="h-full bg-white/70 w-full animate-pulse transition-all duration-700" />
        </div>
      </div>
    </div>
  );
};
