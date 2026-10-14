import React from 'react';

interface BrandDeltaLogoProps {
  id?: string;
  gradientId?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export const BrandDeltaLogo: React.FC<BrandDeltaLogoProps> = ({
  id = 'brand-delta-logo',
  gradientId = 'brand-dynamic-gradient',
  width = 48,
  height = 48,
  className = '',
}) => {
  return (
    <svg
      id={id}
      viewBox="0 0 120 120"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-delta-logo overflow-visible flex-shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop id="svg-gradient-mid" className="svg-gradient-mid" offset="50%" stop-color="hsl(205, 100%, 65%)" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      {/* Piece 1: Left Angled Leg */}
      <path d="M 60,15 L 43,45 L 29,69 L 45,69 L 55,52 L 67,31 Z" fill={`url(#${gradientId})`} />
      {/* Piece 2: Right Slant Beam */}
      <path d="M 67,31 L 52,56 L 68,56 L 93,105 L 109,105 L 75,37 Z" fill={`url(#${gradientId})`} />
      {/* Piece 3: Bottom Left Fold & Base */}
      <path d="M 45,69 L 29,69 L 11,105 L 38,105 L 53,75 L 68,75 L 68,56 L 52,56 Z" fill={`url(#${gradientId})`} />
    </svg>
  );
};

// Compatibility export
export const BrandTriangleLogo = BrandDeltaLogo;

interface BrandWordmarkProps {
  className?: string;
}

export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  className = '',
}) => {
  return (
    <h1 className={`brand-title font-brand font-black select-none leading-none whitespace-nowrap m-0 p-0 flex items-center ${className}`}>
      SARWARCYOU
    </h1>
  );
};

interface BrandLogoProps {
  className?: string;
  logoSize?: number | string;
  wordmarkClassName?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  logoSize = 48,
  wordmarkClassName = 'text-xl sm:text-2xl md:text-3xl tracking-wider',
}) => {
  return (
    <div className={`flex items-center justify-center gap-2.5 sm:gap-3.5 select-none ${className}`}>
      <BrandDeltaLogo width={logoSize} height={logoSize} />
      <BrandWordmark className={wordmarkClassName} />
    </div>
  );
};

export default BrandLogo;
