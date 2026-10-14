import React from 'react';

interface BrandTriangleLogoProps {
  id?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export const BrandTriangleLogo: React.FC<BrandTriangleLogoProps> = ({
  id = 'brand-triangle-logo',
  width = 48,
  height = 48,
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
      className={`brand-triangle-logo overflow-visible flex-shrink-0 ${className}`}
    >
      {/* Component A: Left Quadrilateral Body (SARWAR) */}
      <polygon
        id="logo-part-a"
        className="logo-part-a"
        points="50,10 63,36 33,90 20,90"
        fill="currentColor"
      />
      {/* Component B: Bottom-Right Triangle (CYOU) */}
      <polygon
        id="logo-part-b"
        className="logo-part-b"
        points="68,46 90,90 46,90"
        fill="currentColor"
      />
    </svg>
  );
};

interface BrandWordmarkProps {
  className?: string;
  titleSarwarId?: string;
  titleCyouId?: string;
}

export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  className = '',
  titleSarwarId = 'title-sarwar',
  titleCyouId = 'title-cyou',
}) => {
  return (
    <h1 className={`brand-title font-brand font-black select-none leading-none whitespace-nowrap m-0 p-0 flex items-center ${className}`}>
      <span id={titleSarwarId} className="brand-part-a">
        SARWAR
      </span>
      <span id={titleCyouId} className="brand-part-b">
        CYOU
      </span>
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
      <BrandTriangleLogo width={logoSize} height={logoSize} />
      <BrandWordmark className={wordmarkClassName} />
    </div>
  );
};

export default BrandLogo;
