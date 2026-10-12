import React from 'react';

export const BrandLogo: React.FC = () => {
  return (
    <div className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 z-30 select-none pointer-events-auto flex items-center gap-3.5 group cursor-pointer transition-transform duration-300 hover:scale-105">
      {/* Modern Electric-Blue Play Button Capsule */}
      <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-[#0c1527] via-[#050a14] to-[#02050b] border border-[#00D2FF]/40 shadow-[0_0_20px_rgba(0,210,255,0.35)] group-hover:shadow-[0_0_28px_rgba(0,210,255,0.6)] group-hover:border-[#00D2FF]/80 transition-all duration-300">
        {/* Ambient Ring */}
        <div className="absolute inset-1 rounded-xl border border-[#00D2FF]/20" />
        {/* Electric Blue Play Triangle */}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          className="ml-0.5 text-[#00D2FF] drop-shadow-[0_0_8px_#00D2FF] group-hover:scale-110 transition-transform duration-300"
        >
          <path
            d="M5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.28 2.586A1.5 1.5 0 005 3.868z"
            fill="url(#playGrad)"
          />
          <defs>
            <linearGradient id="playGrad" x1="5" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="0.4" stopColor="#00D2FF" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col">
        <span className="font-space font-black tracking-[0.2em] text-base sm:text-lg bg-gradient-to-r from-white via-[#b8f2ff] to-[#00D2FF] bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(0,210,255,0.35)] leading-tight">
          SARWARCYOU
        </span>
        <span className="font-mono text-[9px] tracking-[0.28em] text-white/40 uppercase font-semibold">
          3D MEDIA ARCHIVE
        </span>
      </div>
    </div>
  );
};
