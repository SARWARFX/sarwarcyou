import React from 'react';

export interface LaserSparkLogoProps {
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  width?: number | string;
  height?: number | string;
  interactive?: boolean;
}

/**
 * Modern High-End Living Wordmark
 * - SARWAR in wide, expansive SPARK letterforms
 * - .CYOU inside an integrated cyber-capsule badge
 * - Painted in a slowly moving White -> Blue -> Violet gradient
 */
export const LaserSparkLogo: React.FC<LaserSparkLogoProps> = ({
  className = '',
  onClick,
  title = 'SARWAR.CYOU',
  width = 280,
  height = 38,
  interactive = true,
}) => {
  return (
    <div
      onClick={onClick}
      title={title}
      className={`relative inline-flex items-center select-none group ${
        interactive
          ? 'cursor-pointer hover:-translate-y-0.5 hover:brightness-110 transition-all duration-200'
          : ''
      } ${className}`}
    >
      {/* SVG Wordmark (Slowly moving White -> Blue -> Violet Gradient) */}
      <svg
        viewBox="0 0 820 70"
        width={width}
        height={height}
        className="relative z-20 filter drop-shadow-[0_0_12px_rgba(139,92,246,0.45)] drop-shadow-[0_0_20px_rgba(56,189,248,0.35)] group-hover:drop-shadow-[0_0_18px_rgba(139,92,246,0.8)] group-hover:drop-shadow-[0_0_28px_rgba(56,189,248,0.65)] transition-all duration-200"
      >
        <defs>
          {/* Slowly Moving White -> Blue -> Violet Linear Gradient */}
          <linearGradient
            id="logoWhiteBlueVioletGrad"
            x1="0"
            y1="0"
            x2="1640"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            {/* Cycle 1 (0 to 820) */}
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="8%" stopColor="#67e8f9" />
            <stop offset="16%" stopColor="#38bdf8" />
            <stop offset="25%" stopColor="#6366f1" />
            <stop offset="35%" stopColor="#8b5cf6" />
            <stop offset="42%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#ffffff" />

            {/* Cycle 2 (820 to 1640) - Seamless Duplicate */}
            <stop offset="58%" stopColor="#67e8f9" />
            <stop offset="66%" stopColor="#38bdf8" />
            <stop offset="75%" stopColor="#6366f1" />
            <stop offset="85%" stopColor="#8b5cf6" />
            <stop offset="92%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#ffffff" />

            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-820,0"
              to="0,0"
              dur="10s"
              repeatCount="indefinite"
            />
          </linearGradient>

          <filter id="logoGradientGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.8" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. SARWAR Hero Wordmark */}
        <g
          stroke="url(#logoWhiteBlueVioletGrad)"
          strokeWidth="8.5"
          strokeLinecap="butt"
          strokeLinejoin="round"
          fill="none"
          filter="url(#logoGradientGlow)"
        >
          {/* S (x: 10 to 86) */}
          <path d="M 84 12 L 30 12 A 10.5 10.5 0 0 0 30 33 L 64 33 A 10.5 10.5 0 0 1 64 54 L 10 54" />
          {/* A1 (x: 104 to 174) */}
          <path d="M 104 54 L 139 12 L 174 54 M 118 40 L 160 40" />
          {/* R1 (x: 192 to 260) */}
          <path d="M 216 12 L 240 12 A 10.5 10.5 0 0 1 240 33 L 204 33 A 10.5 10.5 0 0 0 192 43.5 L 192 54" />
          <path d="M 228 33 L 260 54" />
          {/* W (x: 278 to 362) */}
          <path d="M 278 12 L 296 54 L 320 20 L 344 54 L 362 12" />
          {/* A2 (x: 380 to 450) */}
          <path d="M 380 54 L 415 12 L 450 54 M 394 40 L 436 40" />
          {/* R2 (x: 468 to 536) */}
          <path d="M 492 12 L 516 12 A 10.5 10.5 0 0 1 516 33 L 480 33 A 10.5 10.5 0 0 0 468 43.5 L 468 54" />
          <path d="M 504 33 L 536 54" />
        </g>

        {/* 2. .CYOU Cyber Tag Pill */}
        <g
          stroke="url(#logoWhiteBlueVioletGrad)"
          strokeLinecap="butt"
          strokeLinejoin="round"
          fill="none"
          filter="url(#logoGradientGlow)"
        >
          {/* Cyber Pill Capsule */}
          <rect
            x="560"
            y="16"
            width="210"
            height="34"
            rx="8"
            stroke="url(#logoWhiteBlueVioletGrad)"
            strokeWidth="2.2"
            fill="rgba(139, 92, 246, 0.08)"
          />
          {/* Dot */}
          <circle cx="582" cy="33" r="3.5" fill="url(#logoWhiteBlueVioletGrad)" stroke="none" />
          {/* C */}
          <path d="M 622 23 L 604 23 A 5 5 0 0 0 598 28 L 598 38 A 5 5 0 0 0 604 43 L 622 43" strokeWidth="3.2" />
          {/* Y */}
          <path d="M 632 23 L 646 33 L 646 43 M 660 23 L 646 33" strokeWidth="3.2" />
          {/* O */}
          <path d="M 680 23 L 690 23 A 5 5 0 0 1 690 43 L 680 43 A 5 5 0 0 1 680 23 Z" strokeWidth="3.2" />
          {/* U */}
          <path d="M 710 23 L 710 38 A 5 5 0 0 0 715 43 L 729 43 A 5 5 0 0 0 734 38 L 734 23" strokeWidth="3.2" />
        </g>
      </svg>
    </div>
  );
};

export default LaserSparkLogo;
