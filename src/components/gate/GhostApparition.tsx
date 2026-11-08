import React from 'react';

interface GhostApparitionProps {
  onClick?: (e: React.MouseEvent) => void;
  isUnlocked?: boolean;
}

export const GhostApparition: React.FC<GhostApparitionProps> = ({
  onClick,
  isUnlocked = false,
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.cancelable) e.preventDefault();
          onClick?.(e as any);
        }
      }}
      aria-label="Spectral Ghost Apparition. Tap to open albums."
      className={`group relative flex flex-col items-center justify-center cursor-pointer select-none outline-none transition-all duration-700 ${
        isUnlocked
          ? 'opacity-0 scale-90 pointer-events-none blur-sm'
          : 'opacity-100 scale-100 pointer-events-auto hover:scale-105 active:scale-95'
      }`}
      style={{
        filter: 'drop-shadow(0 0 25px rgba(56, 189, 248, 0.35)) drop-shadow(0 0 55px rgba(14, 165, 233, 0.2))',
      }}
    >
      <style>{`
        @keyframes ghostBobbing {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-16px) rotate(1.2deg);
          }
        }
        @keyframes ghostEyeGlow {
          0%, 100% {
            opacity: 0.9;
            filter: drop-shadow(0 0 6px #ffffff) drop-shadow(0 0 14px #38bdf8);
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 10px #ffffff) drop-shadow(0 0 22px #38bdf8);
          }
        }
        @keyframes ghostTailSway {
          0%, 100% {
            transform: skewX(0deg) scaleY(1);
          }
          50% {
            transform: skewX(2.5deg) scaleY(1.04);
          }
        }
        @keyframes soulMoteFloat {
          0% {
            transform: translateY(0px) scale(0.6);
            opacity: 0;
          }
          30% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-40px) scale(1.1);
            opacity: 0;
          }
        }
        .animate-ghost-float {
          animation: ghostBobbing 4.8s ease-in-out infinite;
        }
        .animate-ghost-eyes {
          animation: ghostEyeGlow 3.2s ease-in-out infinite;
        }
        .animate-ghost-tail {
          animation: ghostTailSway 3.6s ease-in-out infinite;
          transform-origin: center top;
        }
        .mote-1 {
          animation: soulMoteFloat 3.8s ease-out infinite 0.4s;
        }
        .mote-2 {
          animation: soulMoteFloat 4.2s ease-out infinite 1.6s;
        }
        .mote-3 {
          animation: soulMoteFloat 3.5s ease-out infinite 2.4s;
        }
      `}</style>

      {/* Floating Levitation Container */}
      <div className="relative animate-ghost-float flex flex-col items-center">
        {/* Soft Ambient Ethereal Glow Behind Ghost */}
        <div
          className="absolute inset-0 -m-8 rounded-full pointer-events-none -z-10 transition-opacity duration-500 opacity-60 group-hover:opacity-90"
          style={{
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(14, 165, 233, 0.12) 45%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />

        {/* Ambient Floating Soul Motes */}
        <div className="absolute -bottom-2 -left-3 w-2 h-2 rounded-full bg-cyan-300 mote-1 pointer-events-none blur-[0.5px]" />
        <div className="absolute -bottom-4 right-2 w-1.5 h-1.5 rounded-full bg-sky-200 mote-2 pointer-events-none blur-[0.5px]" />
        <div className="absolute -bottom-1 right-6 w-2.5 h-2.5 rounded-full bg-white mote-3 pointer-events-none blur-[1px]" />

        {/* Custom Hand-Crafted High-Definition Ghost SVG Apparition */}
        <svg
          viewBox="0 0 200 260"
          className="w-44 h-56 sm:w-52 sm:h-64 md:w-60 md:h-72 transition-transform duration-500 drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Spectral Body Gradient */}
            <linearGradient id="ghostBodyGrad" x1="100" y1="20" x2="100" y2="245" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#e0f2fe" stopOpacity="0.88" />
              <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.55" />
              <stop offset="85%" stopColor="#0284c7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.0" />
            </linearGradient>

            {/* Inner Shroud Depth Gradient */}
            <linearGradient id="ghostInnerShade" x1="100" y1="30" x2="100" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#03060a" stopOpacity="0.0" />
            </linearGradient>

            {/* Ghost Outer Glow Filter */}
            <filter id="spectralAura" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Eye Flare Gradient */}
            <radialGradient id="eyeFlareGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Outer Ambient Spectral Silhouette (soft ethereal wisp aura) */}
          <path
            d="M 100 18
               C 60 18, 34 50, 34 100
               C 34 140, 48 175, 42 205
               C 38 225, 48 238, 62 225
               C 74 212, 85 228, 100 238
               C 115 228, 126 212, 138 225
               C 152 238, 162 225, 158 205
               C 152 175, 166 140, 166 100
               C 166 50, 140 18, 100 18 Z"
            fill="url(#ghostBodyGrad)"
            filter="url(#spectralAura)"
            opacity="0.4"
            className="animate-ghost-tail"
          />

          {/* Main Translucent Ghostly Body with Flowing Vapor Folds */}
          <path
            d="M 100 24
               C 64 24, 40 54, 40 102
               C 40 144, 52 176, 46 206
               C 42 224, 52 235, 66 222
               C 78 210, 88 226, 100 235
               C 112 226, 122 210, 134 222
               C 148 235, 158 224, 154 206
               C 148 176, 160 144, 160 102
               C 160 54, 136 24, 100 24 Z"
            fill="url(#ghostBodyGrad)"
            className="animate-ghost-tail"
          />

          {/* Translucent Spectral Robe Fold Left */}
          <path
            d="M 68 85
               C 62 120, 68 165, 58 205
               C 64 195, 76 180, 80 145
               C 83 115, 78 92, 68 85 Z"
            fill="url(#ghostInnerShade)"
            opacity="0.6"
          />

          {/* Translucent Spectral Robe Fold Right */}
          <path
            d="M 132 85
               C 138 120, 132 165, 142 205
               C 136 195, 124 180, 120 145
               C 117 115, 122 92, 132 85 Z"
            fill="url(#ghostInnerShade)"
            opacity="0.6"
          />

          {/* Glowing Soul Core Wisp */}
          <ellipse
            cx="100"
            cy="110"
            rx="28"
            ry="45"
            fill="url(#eyeFlareGrad)"
            opacity="0.35"
          />

          {/* Spectral Glowing Eyes Container */}
          <g className="animate-ghost-eyes">
            {/* Left Eye Flare */}
            <circle cx="82" cy="92" r="14" fill="url(#eyeFlareGrad)" opacity="0.65" />
            {/* Left Eye Inner Slit / Pupil */}
            <ellipse
              cx="82"
              cy="92"
              rx="5"
              ry="7.5"
              transform="rotate(-8 82 92)"
              fill="#ffffff"
            />
            {/* Left Eye Deep Center */}
            <ellipse
              cx="82"
              cy="92"
              rx="2.5"
              ry="4.5"
              transform="rotate(-8 82 92)"
              fill="#e0f2fe"
            />

            {/* Right Eye Flare */}
            <circle cx="118" cy="92" r="14" fill="url(#eyeFlareGrad)" opacity="0.65" />
            {/* Right Eye Inner Slit / Pupil */}
            <ellipse
              cx="118"
              cy="92"
              rx="5"
              ry="7.5"
              transform="rotate(8 118 92)"
              fill="#ffffff"
            />
            {/* Right Eye Deep Center */}
            <ellipse
              cx="118"
              cy="92"
              rx="2.5"
              ry="4.5"
              transform="rotate(8 118 92)"
              fill="#e0f2fe"
            />
          </g>

          {/* Gentle Ethereal Floating Smile / Mystical Aura Curve */}
          <path
            d="M 94 116 Q 100 120 106 116"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
