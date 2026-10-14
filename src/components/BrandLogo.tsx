import React from 'react';

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  imgClassName = '',
}) => {
  return (
    <a
      href="/"
      className={`brand-link flex items-center select-none ${className}`}
      aria-label="SARWARCYOU Home"
    >
      <img
        src="/SARWARCYOU.svg"
        alt="SARWARCYOU"
        className={`site-brand-logo ${imgClassName}`}
      />
    </a>
  );
};

export default BrandLogo;
