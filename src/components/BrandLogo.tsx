import React from 'react';

interface BrandLogoProps {
  isLightMode?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ isLightMode = false }) => {
  return (
    <div className="fixed top-6 left-6 sm:top-8 sm:left-8 z-40 select-none pointer-events-auto flex items-center gap-3 group cursor-pointer transition-transform duration-300 hover:scale-105">
      {/* Minimalist Solid Electric-Blue Glowing Play Glyph (NO outlines, NO extra borders) */}
      <div className="flex items-center justify-center">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-[#00D2FF] drop-shadow-[0_0_14px_#00D2FF] group-hover:drop-shadow-[0_0_20px_#00D2FF] group-hover:scale-110 transition-all duration-300"
        >
          <path d="M5.5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.78 2.586A1.5 1.5 0 005.5 3.868z" />
        </svg>
      </div>

      {/* Brand Name in Futuristic Bold Typography (Pure White to Neon Blue or Deep Black to Cyan on Studio White) */}
      <span
        className={`font-space font-black tracking-[0.24em] text-lg sm:text-xl transition-all duration-500 leading-none ${
          isLightMode
            ? 'bg-gradient-to-r from-[#050811] via-[#15233c] to-[#0090C8] bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(0,144,200,0.25)]'
            : 'bg-gradient-to-r from-[#FFFFFF] via-[#8ae6ff] to-[#00D2FF] bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(0,210,255,0.4)]'
        }`}
      >
        SARWARCYOU
      </span>
    </div>
  );
};
