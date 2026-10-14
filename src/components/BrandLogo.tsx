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
  width = 42,
  height = 42,
  className = '',
}) => {
  return (
    <svg
      id={id}
      viewBox="0 0 100 100"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-delta-logo overflow-visible flex-shrink-0 ${className}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop id="svg-gradient-mid" className="svg-gradient-mid" offset="50%" stop-color="hsl(205, 100%, 65%)" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      {/* Segment 1: Top-Left Apex Bar */}
      <path d="M 50,6 L 62,28 L 47,56 L 31,56 Z" fill={`url(#${gradientId})`} />
      {/* Segment 2: Bottom-Left Foot & Center Fold */}
      <path d="M 24,67 L 41,67 L 54,92 L 11,92 L 24,67 Z M 44,67 L 58,41 L 69,61 L 55,61 Z" fill={`url(#${gradientId})`} />
      {/* Segment 3: Right Slanted Leg */}
      <path d="M 64,19 L 50,46 L 63,69 L 89,92 L 100,92 Z" fill={`url(#${gradientId})`} />
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
  logoSize = 42,
  wordmarkClassName = '',
}) => {
  return (
    <div className={`brand-lockup flex items-center justify-center gap-[10px] m-0 p-0 select-none ${className}`}>
      <BrandDeltaLogo width={logoSize} height={logoSize} />
      <BrandWordmark className={wordmarkClassName} />
    </div>
  );
};

export default BrandLogo;
