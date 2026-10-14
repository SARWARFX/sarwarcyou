import React from 'react';
import { BRAND_CONFIG } from '../config/brand';

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  imgClassName = '',
}) => {
  const brand =
    typeof window !== 'undefined' && window.BRAND_CONFIG
      ? window.BRAND_CONFIG
      : BRAND_CONFIG;

  return (
    <a
      href="/"
      className={`brand-link flex items-center select-none ${className}`}
      aria-label={`${brand.name} Home`}
    >
      <img
        src={brand.logoSrc}
        alt={brand.name}
        className={`site-brand-logo ${imgClassName}`}
      />
    </a>
  );
};

export default BrandLogo;
