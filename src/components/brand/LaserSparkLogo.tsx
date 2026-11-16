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
 * Variation 1: Aerodynamic Horizon Wordmark (Harmonized Ribbon + Clean Cyber Apex)
 * Custom-architected SPARK typography with Symmetrical Keystone symmetry:
 * S -> [A R] -> W (Center Crown) -> [A R] . C Y O U
 * Color Scheme: Restored Yellowish-White Neon / Acid Lime (#CCFF00 & #FFFFFF)
 * Features:
 * - Full-Span Traveling Spark Wave (S -> U) through Stark White (#FFFFFF) & Neon Acid Lime (#CCFF00)
 * - Synchronized Baseline Optical Horizon Flare
 * - Ambient Base Underlay for 100% Geometric Presence
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
      <style>{`
        @keyframes sweepLaserTrack {
          0% { left: 5%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: 95%; opacity: 0; }
        }
        .anim-sweep-track {
          animation: sweepLaserTrack 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* Baseline Optical Laser Horizon */}
      <div className="absolute bottom-[3px] left-[6%] right-[6%] h-[1.5px] bg-gradient-to-r from-transparent via-[#ccff00]/40 to-transparent pointer-events-none z-10">
        {/* Sweeping Yellowish-White Flare Trail */}
        <div
          className="anim-sweep-track absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[110px] h-[7px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.95)_0%,rgba(204,255,0,0.85)_40%,transparent_80%)] blur-[2px] pointer-events-none"
        />
        {/* Sweeping White Laser Core Node */}
        <div
          className="anim-sweep-track absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[4px] h-[4px] bg-white rounded-full shadow-[0_0_8px_#ffffff,0_0_16px_#ccff00,0_0_24px_#ccff00] pointer-events-none"
        />
      </div>

      {/* SVG Wordmark with Full-Span Traveling Spark */}
      <svg
        viewBox="0 0 820 68"
        width={width}
        height={height}
        className="relative z-20 filter drop-shadow-[0_0_18px_rgba(204,255,0,0.45)]"
      >
        <defs>
          {/* Continuous Full-Span Traveling Spark Wave (S -> U) in Yellowish-White Neon */}
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
        <g stroke="url(#logoAmbientBase)" strokeWidth="8" strokeLinecap="butt" strokeLinejoin="round" fill="none">
          {/* S (x: 10 to 74) */}
          <path d="M 74 12 L 28 12 A 10 10 0 0 0 28 32 L 56 32 A 10 10 0 0 1 56 52 L 10 52" />
          {/* A1 (x: 90 to 152) */}
          <path d="M 90 52 L 121 12 L 152 52 M 104 38 L 138 38" />
          {/* R1 (x: 166 to 226) */}
          <path d="M 188 12 L 208 12 A 10 10 0 0 1 208 32 L 178 32 A 10 10 0 0 0 166 42 L 166 52" />
          <path d="M 198 32 L 226 52" />
          {/* W (Center Keystone, x: 240 to 316) */}
          <path d="M 240 12 L 256 52 L 278 20 L 300 52 L 316 12" />
          {/* A2 (x: 330 to 392) */}
          <path d="M 330 52 L 361 12 L 392 52 M 344 38 L 378 38" />
          {/* R2 (x: 406 to 466) */}
          <path d="M 428 12 L 448 12 A 10 10 0 0 1 448 32 L 418 32 A 10 10 0 0 0 406 42 L 406 52" />
          <path d="M 438 32 L 466 52" />
          {/* Separator Dot */}
          <rect x="478" y="44" width="8" height="8" fill="rgba(255, 255, 255, 0.45)" stroke="none" />
          {/* C (x: 504 to 560) */}
          <path d="M 560 12 L 524 12 A 10 10 0 0 0 514 22 L 514 42 A 10 10 0 0 0 524 52 L 560 52" />
          {/* Y (x: 574 to 630) */}
          <path d="M 574 12 L 602 32 L 602 52 M 630 12 L 602 32" />
          {/* O (x: 644 to 704) */}
          <path d="M 664 12 L 684 12 A 10 10 0 0 1 684 52 L 664 52 A 10 10 0 0 1 664 12 Z" />
          {/* U (x: 718 to 774) */}
          <path d="M 718 12 L 718 42 A 10 10 0 0 0 728 52 L 764 52 A 10 10 0 0 0 774 42 L 774 12" />
        </g>

        {/* Layer 2: Live Full-Span Active Traveling Spark Wave (S -> U) */}
        <g stroke="url(#logoTravelingSpark)" strokeWidth="8" strokeLinecap="butt" strokeLinejoin="round" fill="none">
          {/* S */}
          <path d="M 74 12 L 28 12 A 10 10 0 0 0 28 32 L 56 32 A 10 10 0 0 1 56 52 L 10 52" />
          {/* A1 */}
          <path d="M 90 52 L 121 12 L 152 52 M 104 38 L 138 38" />
          {/* R1 */}
          <path d="M 188 12 L 208 12 A 10 10 0 0 1 208 32 L 178 32 A 10 10 0 0 0 166 42 L 166 52" />
          <path d="M 198 32 L 226 52" />
          {/* W (Center Keystone) */}
          <path d="M 240 12 L 256 52 L 278 20 L 300 52 L 316 12" />
          {/* A2 */}
          <path d="M 330 52 L 361 12 L 392 52 M 344 38 L 378 38" />
          {/* R2 */}
          <path d="M 428 12 L 448 12 A 10 10 0 0 1 448 32 L 418 32 A 10 10 0 0 0 406 42 L 406 52" />
          <path d="M 438 32 L 466 52" />
          {/* Separator Dot */}
          <rect x="478" y="44" width="8" height="8" fill="#ccff00" stroke="none" />
          {/* C */}
          <path d="M 560 12 L 524 12 A 10 10 0 0 0 514 22 L 514 42 A 10 10 0 0 0 524 52 L 560 52" />
          {/* Y */}
          <path d="M 574 12 L 602 32 L 602 52 M 630 12 L 602 32" />
          {/* O */}
          <path d="M 664 12 L 684 12 A 10 10 0 0 1 684 52 L 664 52 A 10 10 0 0 1 664 12 Z" />
          {/* U */}
          <path d="M 718 12 L 718 42 A 10 10 0 0 0 728 52 L 764 52 A 10 10 0 0 0 774 42 L 774 12" />
        </g>
      </svg>
    </div>
  );
};

export default LaserSparkLogo;
