import React from 'react';

export interface InitializingArchiveLoaderProps {
  progress: number; // 0 to 100
  scheme?: 'blue' | 'red'; // 'blue' for tab switching, 'red' for page switching
  className?: string;
}

/**
 * Standard High-Tech Text-as-Slider Loading Screen:
 * - Tab switching: Blue Color Scheme (Electric Blue & Sky Cyan with moving gradient)
 * - Page switching: Red Color Scheme (Crimson & Rose Red with moving gradient)
 * - Zero boxes, zero outlines, zero background
 * - Text color wipes left-to-right as progress advances 0% -> 100%
 * - Guaranteed reach to the very right edge of 'ARCHIVE'
 */
export const InitializingArchiveLoader: React.FC<InitializingArchiveLoaderProps> = ({
  progress,
  scheme = 'blue',
  className = '',
}) => {
  const isRed = scheme === 'red';
  const clamped = Math.max(0, Math.min(100, progress));

  // Logo Brand Colors: Blue vs Red
  const accentColor = isRed ? '#ef4444' : '#38bdf8';
  const gradStyle = isRed
    ? {
        backgroundImage: 'linear-gradient(90deg, #ef4444 0%, #f43f5e 35%, #fb7185 70%, #ef4444 100%)',
        backgroundSize: '200% auto',
      }
    : {
        backgroundImage: 'linear-gradient(90deg, #38bdf8 0%, #3b82f6 35%, #60a5fa 70%, #38bdf8 100%)',
        backgroundSize: '200% auto',
      };

  const laserShadow = isRed
    ? '2px 0 12px rgba(239,68,68,0.95), 4px 0 20px rgba(244,63,94,0.6)'
    : '2px 0 12px rgba(56,189,248,0.95), 4px 0 20px rgba(59,130,246,0.6)';

  const textShadowGlow = isRed
    ? '0 0 12px rgba(239,68,68,0.85), 0 0 24px rgba(244,63,94,0.5)'
    : '0 0 12px rgba(56,189,248,0.85), 0 0 24px rgba(59,130,246,0.5)';

  return (
    <div
      className={`relative inline-block font-bold uppercase select-none text-base sm:text-lg md:text-xl tracking-[0.22em] whitespace-nowrap ${className}`}
      style={{ fontFamily: "'Science Gothic', sans-serif" }}
    >
      {/* Base Layer: Initial two-color dimmed state */}
      <div className="opacity-25 transition-opacity duration-300">
        <span className="text-white">INITIALIZING </span>
        <span style={{ color: accentColor }}>ARCHIVE</span>
      </div>

      {/* Active Progress Layer: Fills in glowing brand colors from left to the very right edge */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-300 ease-out"
        style={{
          width: `${clamped}%`,
          borderRight: clamped < 100 ? `2px solid ${accentColor}` : 'none',
          boxShadow: clamped < 100 ? laserShadow : 'none',
        }}
      >
        <div className="whitespace-nowrap flex items-center">
          <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.75)]">
            INITIALIZING&nbsp;
          </span>
          <span
            className="animate-brand-grad-move inline-block"
            style={{
              ...gradStyle,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(${textShadowGlow})`,
            }}
          >
            ARCHIVE
          </span>
        </div>
      </div>
    </div>
  );
};

export default InitializingArchiveLoader;
