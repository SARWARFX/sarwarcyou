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
 * Modern Laser Spark Wordmark
 * - SARWAR in wide, expansive SPARK letterforms with laser-sharp miter stroke (4.5px)
 * - .CYOU inside a clean rectangular cyber badge (0px border-radius)
 * - Smooth Left-to-Right animated White -> Cyan -> Blue -> Violet gradient
 * - Specular cyan and violet double drop-shadow aura
 */
export const LaserSparkLogo: React.FC<LaserSparkLogoProps> = ({
  className = '',
  onClick,
  title = 'SARWAR.CYOU',
  width = 240,
  height = 32,
  interactive = true,
}) => {
  return (
    <div
      onClick={onClick}
      title={title}
      className={`relative inline-flex items-center select-none group ${
        interactive
          ? 'cursor-pointer hover:opacity-90 hover:brightness-110 transition-all duration-200'
          : ''
      } ${className}`}
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <svg
        viewBox="0 0 820 70"
        width={width}
        height={height}
        className="relative z-20 transition-all duration-200"
        style={{
          filter:
            'drop-shadow(0 0 16px rgba(139, 92, 246, 0.35)) drop-shadow(0 0 24px rgba(56, 189, 248, 0.25))',
          borderRadius: 0,
          outline: 'none',
          border: 'none',
        }}
      >
        <defs>
          {/* Left-to-Right Animated White -> Cyan -> Blue -> Violet Linear Gradient */}
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
        </defs>

        {/* 1. SARWAR Hero Wordmark (Laser Sharp 4.5px Stroke, Miter Join) */}
        <g
          stroke="url(#logoWhiteBlueVioletGrad)"
          strokeWidth="4.5"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          fill="none"
        >
          {/* S */}
          <path d="M 64 12 L 20 12 A 10.5 10.5 0 0 0 9.5 22.5 L 9.5 22.5 A 10.5 10.5 0 0 0 20 33 L 53.5 33 A 10.5 10.5 0 0 1 64 43.5 L 64 43.5 A 10.5 10.5 0 0 1 53.5 54 L 9.5 54" />
          {/* A1 */}
          <path d="M 94 54 L 118 12 L 142 54" />
          <line x1="104" y1="38" x2="132" y2="38" strokeWidth="3.5" />
          {/* R1 */}
          <path d="M 172 54 L 172 12 L 198 12 A 10.5 10.5 0 0 1 208.5 22.5 L 208.5 22.5 A 10.5 10.5 0 0 1 198 33 L 172 33" />
          <path d="M 194 33 L 216 54" />
          {/* W */}
          <path d="M 246 12 L 258 54 L 272 26 L 286 54 L 298 12" />
          {/* A2 */}
          <path d="M 328 54 L 352 12 L 376 54" />
          <line x1="338" y1="38" x2="366" y2="38" strokeWidth="3.5" />
          {/* R2 */}
          <path d="M 406 54 L 406 12 L 432 12 A 10.5 10.5 0 0 1 442.5 22.5 L 442.5 22.5 A 10.5 10.5 0 0 1 432 33 L 406 33" />
          <path d="M 428 33 L 450 54" />
        </g>

        {/* 2. .CYOU Rectangular Badge (Zero Radius, Precision Lines) */}
        <g stroke="url(#logoWhiteBlueVioletGrad)" fill="none">
          {/* Outer rectangular badge (rx=0, strokeWidth=2) */}
          <rect
            x="475"
            y="15"
            width="200"
            height="35"
            stroke="url(#logoWhiteBlueVioletGrad)"
            strokeWidth="2"
            fill="rgba(139, 92, 246, 0.08)"
          />
          {/* Dot */}
          <circle cx="495" cy="32.5" r="3" fill="url(#logoWhiteBlueVioletGrad)" stroke="none" />
          {/* C */}
          <path d="M 535 23 L 515 23 L 515 42 L 535 42" strokeWidth="3" />
          {/* Y */}
          <path d="M 545 23 L 558 32 L 558 42 M 571 23 L 558 32" strokeWidth="3" />
          {/* O */}
          <rect x="585" y="23" width="18" height="19" strokeWidth="3" />
          {/* U */}
          <path d="M 618 23 L 618 42 L 638 42 L 638 23" strokeWidth="3" />
        </g>
      </svg>
    </div>
  );
};

export default LaserSparkLogo;
