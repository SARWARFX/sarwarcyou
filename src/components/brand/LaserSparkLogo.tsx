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
 * Option 3: Solid Cyber Neon (Static / Zero Flashing)
 * High-impact branding:
 * - SARWAR in wide, expansive, high-presence SPARK letterforms
 * - .CYOU inside an integrated glowing cyber-capsule badge
 * - PURE FLOATING LOGO (No baseline laser track/flare underneath)
 * - Rock-solid, unwavering Neon Acid Lime (#CCFF00) with soft atmospheric neon glow
 * - 100% Static: Zero flashing, zero color alternating, zero black dips
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
      {/* SVG Wordmark (Option 3: Solid Cyber Neon) */}
      <svg
        viewBox="0 0 820 70"
        width={width}
        height={height}
        className="relative z-20 filter drop-shadow-[0_0_16px_rgba(204,255,0,0.6)] group-hover:drop-shadow-[0_0_22px_rgba(204,255,0,0.85)] transition-all duration-200"
      >
        <defs>
          <filter id="solidNeonGlow">
            <feGaussianBlur stdDeviation="3.0" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          stroke="#ccff00"
          strokeWidth="8.5"
          strokeLinecap="butt"
          strokeLinejoin="round"
          fill="none"
          filter="url(#solidNeonGlow)"
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

          {/* .CYOU Cyber Tag Pill (x: 560 to 770) */}
          <rect
            x="560"
            y="16"
            width="210"
            height="34"
            rx="8"
            stroke="#ccff00"
            strokeWidth="2.2"
            fill="rgba(204, 255, 0, 0.08)"
          />
          {/* Dot */}
          <circle cx="582" cy="33" r="3.5" fill="#ccff00" stroke="none" />
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
