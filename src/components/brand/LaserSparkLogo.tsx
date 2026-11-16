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
 * Variation 2: Hierarchical Cyber-Block (SARWAR Hero + .CYOU Tech Tag)
 * High-impact branding:
 * - SARWAR in wide, expansive, high-presence SPARK letterforms
 * - .CYOU inside an integrated glowing cyber-capsule badge
 * - PURE FLOATING LOGO (No baseline laser track/flare underneath)
 * - Yellowish-White Neon (#CCFF00 & #FFFFFF) with live traveling spark wave
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
        interactive ? 'cursor-pointer hover:-translate-y-0.5 transition-transform duration-200' : ''
      } ${className}`}
    >
      {/* SVG Wordmark (Pure Floating Vector - No Underneath Spark Graphic) */}
      <svg
        viewBox="0 0 820 70"
        width={width}
        height={height}
        className="relative z-20 filter drop-shadow-[0_0_18px_rgba(204,255,0,0.55)]"
      >
        <defs>
          {/* Continuous Full-Span Traveling Spark Wave (SARWAR -> .CYOU) in Yellowish-White Neon */}
          <linearGradient id="logoTravelingSpark" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="-0.3" stopColor="#050805" />
            <stop offset="-0.15" stopColor="#557700" />
            <stop offset="0.0" stopColor="#99dd00" />
            <stop offset="0.1" stopColor="#ccff00" />
            <stop offset="0.15" stopColor="#ffffff" />
            <stop offset="0.2" stopColor="#ccff00" />
            <stop offset="0.3" stopColor="#99dd00" />
            <stop offset="0.45" stopColor="#557700" />
            <stop offset="0.6" stopColor="#050805" />

            <animate attributeName="x1" values="-60%; 100%" dur="3.2s" repeatCount="indefinite" />
            <animate attributeName="x2" values="40%; 200%" dur="3.2s" repeatCount="indefinite" />
          </linearGradient>

          {/* Ambient Base Underlay */}
          <linearGradient id="logoAmbientBase" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(204, 255, 0, 0.35)" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.45)" />
            <stop offset="100%" stopColor="rgba(204, 255, 0, 0.35)" />
          </linearGradient>
        </defs>

        {/* Layer 1: Ambient Base Track (Ensures complete glyph visibility at all times) */}
        <g stroke="url(#logoAmbientBase)" strokeWidth="8.5" strokeLinecap="butt" strokeLinejoin="round" fill="none">
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
            stroke="rgba(204, 255, 0, 0.45)"
            strokeWidth="1.8"
            fill="rgba(204, 255, 0, 0.05)"
          />
          {/* Dot */}
          <circle cx="582" cy="33" r="3.5" fill="#ccff00" stroke="none" />
          {/* C */}
          <path d="M 622 23 L 604 23 A 5 5 0 0 0 598 28 L 598 38 A 5 5 0 0 0 604 43 L 622 43" strokeWidth="3" />
          {/* Y */}
          <path d="M 632 23 L 646 33 L 646 43 M 660 23 L 646 33" strokeWidth="3" />
          {/* O */}
          <path d="M 680 23 L 690 23 A 5 5 0 0 1 690 43 L 680 43 A 5 5 0 0 1 680 23 Z" strokeWidth="3" />
          {/* U */}
          <path d="M 710 23 L 710 38 A 5 5 0 0 0 715 43 L 729 43 A 5 5 0 0 0 734 38 L 734 23" strokeWidth="3" />
        </g>

        {/* Layer 2: Live Full-Span Active Traveling Spark Wave */}
        <g stroke="url(#logoTravelingSpark)" strokeWidth="8.5" strokeLinecap="butt" strokeLinejoin="round" fill="none">
          {/* S */}
          <path d="M 84 12 L 30 12 A 10.5 10.5 0 0 0 30 33 L 64 33 A 10.5 10.5 0 0 1 64 54 L 10 54" />
          {/* A1 */}
          <path d="M 104 54 L 139 12 L 174 54 M 118 40 L 160 40" />
          {/* R1 */}
          <path d="M 216 12 L 240 12 A 10.5 10.5 0 0 1 240 33 L 204 33 A 10.5 10.5 0 0 0 192 43.5 L 192 54" />
          <path d="M 228 33 L 260 54" />
          {/* W */}
          <path d="M 278 12 L 296 54 L 320 20 L 344 54 L 362 12" />
          {/* A2 */}
          <path d="M 380 54 L 415 12 L 450 54 M 394 40 L 436 40" />
          {/* R2 */}
          <path d="M 492 12 L 516 12 A 10.5 10.5 0 0 1 516 33 L 480 33 A 10.5 10.5 0 0 0 468 43.5 L 468 54" />
          <path d="M 504 33 L 536 54" />
        </g>
      </svg>
    </div>
  );
};

export default LaserSparkLogo;
