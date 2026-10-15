import React from 'react';

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xs tracking-[0.16em]',
    md: 'text-sm sm:text-base tracking-[0.2em]',
    lg: 'text-lg sm:text-2xl tracking-[0.24em]'
  }[size];

  return (
    <div className={`cyber-wordmark inline-flex items-center select-none font-brand font-black cursor-default ${sizeClasses} ${className}`}>
      SARWARCYOU
    </div>
  );
};

export default BrandLogo;
