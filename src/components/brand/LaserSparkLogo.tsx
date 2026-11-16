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
 * Option 2: Sweeping Laser Particle Scan Logo (Strictly Stark White & Pure Electric Cyan)
 * Features scattered monoline letterforms with detached crossbars and a real-time sweeping
 * laser particle spark on the optical horizon line.
 */
export const LaserSparkLogo: React.FC<LaserSparkLogoProps> = ({
  className = '',
  onClick,
  title = 'SARWAR.CYOU',
  width = 240,
  height = 36,
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
          0% { left: 8%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: 92%; opacity: 0; }
        }
        .anim-sweep-track {
          animation: sweepLaserTrack 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* Baseline Optical Laser Horizon */}
      <div className="absolute bottom-[2px] left-[6%] right-[6%] h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff]/85 to-transparent pointer-events-none z-10">
        {/* Sweeping Cyan Comet Trail */}
        <div
          className="anim-sweep-track absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[85px] h-[8px] bg-[radial-gradient(ellipse_at_center,rgba(0,240,255,0.95)_0%,transparent_75%)] blur-[2px] pointer-events-none"
        />
        {/* Sweeping White Laser Core Node */}
        <div
          className="anim-sweep-track absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[4.5px] h-[4.5px] bg-white rounded-full shadow-[0_0_8px_#ffffff,0_0_18px_#00f0ff] pointer-events-none"
        />
      </div>

      {/* Scattered Monoline SVG Wordmark (Strictly White & Electric Cyan) */}
      <svg
        viewBox="0 0 740 90"
        width={width}
        height={height}
        className="relative z-20 filter drop-shadow-[0_0_12px_rgba(0,0,0,0.95)]"
      >
        <g transform="translate(10, 15)">
          {/* S: Floating top bar, continuous middle loop, floating bottom bar */}
          <line x1="16" y1="6" x2="48" y2="6" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" />
          <path
            d="M 48 14 L 16 14 C 8 14, 8 26, 16 26 L 38 26 C 46 26, 46 38, 38 38 L 8 38"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="square"
          />
          <line x1="8" y1="46" x2="40" y2="46" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" />

          {/* A: Inverted chevron with a floating cyan crossbar */}
          <path d="M 68 46 L 90 6 L 112 46" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" />
          <line x1="74" y1="30" x2="106" y2="30" stroke="#00f0ff" strokeWidth="2.2" strokeLinecap="round" />

          {/* R: High loop + detached floating angled leg */}
          <path
            d="M 132 46 L 132 6 L 158 6 C 170 6, 170 24, 158 24 L 132 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="square"
          />
          <line x1="152" y1="24" x2="168" y2="46" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" />

          {/* W: Precise sharp scattered double chevron */}
          <path
            d="M 188 6 L 198 46 L 212 20 L 226 46 L 236 6"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />

          {/* A: Inverted chevron with floating cyan crossbar */}
          <path d="M 256 46 L 278 6 L 300 46" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" />
          <line x1="262" y1="30" x2="294" y2="30" stroke="#00f0ff" strokeWidth="2.2" strokeLinecap="round" />

          {/* R: Detached leg */}
          <path
            d="M 320 46 L 320 6 L 346 6 C 358 6, 358 24, 346 24 L 320 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="square"
          />
          <line x1="340" y1="24" x2="356" y2="46" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" />

          {/* Separator Dot: Rhombus in Electric Cyan */}
          <polygon points="380,44 386,34 394,34 388,44" fill="#00f0ff" />

          {/* CYOU in Pure Electric Cyan */}
          {/* C */}
          <path
            d="M 444 14 L 420 14 C 408 14, 408 38, 420 38 L 444 38"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="3"
            strokeLinecap="square"
          />
          {/* Y */}
          <path
            d="M 462 6 L 476 24 L 490 6"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="3"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <line x1="476" y1="28" x2="476" y2="46" stroke="#00f0ff" strokeWidth="3" strokeLinecap="square" />
          {/* O */}
          <path
            d="M 520 8 C 508 16, 508 36, 520 44"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 528 8 C 540 16, 540 36, 528 44"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* U */}
          <line x1="560" y1="6" x2="560" y2="20" stroke="#00f0ff" strokeWidth="3" strokeLinecap="square" />
          <path
            d="M 560 26 L 560 36 C 560 46, 588 46, 588 36 L 588 6"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="3"
            strokeLinecap="square"
          />
        </g>
      </svg>
    </div>
  );
};

export default LaserSparkLogo;
