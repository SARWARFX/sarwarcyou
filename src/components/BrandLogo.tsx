import React from 'react';

export interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
}) => {
  const iconFrameSizes = {
    sm: 'w-7 h-7 rounded-lg',
    md: 'w-8 h-8 sm:w-9 sm:h-9 rounded-xl',
    lg: 'w-10 h-10 sm:w-11 sm:h-11 rounded-xl',
  }[size];

  const textSizeClasses = {
    sm: 'text-xs tracking-[0.16em]',
    md: 'text-sm sm:text-base tracking-[0.2em]',
    lg: 'text-lg sm:text-xl tracking-[0.24em]',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none font-brand font-black cursor-pointer group/logo ${className}`}>
      {/* Modern, Glowing Play Button Icon inside minimalist frame */}
      <div
        className={`relative ${iconFrameSizes} bg-black/70 border border-white/20 p-1 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.35),inset_0_0_8px_rgba(0,229,255,0.2)] transition-all duration-300 group-hover/logo:scale-105 group-hover/logo:border-[#00E5FF]/60 group-hover/logo:shadow-[0_0_20px_rgba(0,229,255,0.5)]`}
      >
        <div className="absolute inset-0 rounded-inherit bg-gradient-to-br from-[#60a5fa]/20 via-[#3b82f6]/20 to-[#8b5cf6]/20 blur-xs" />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-[0_0_6px_rgba(0,229,255,0.8)]"
        >
          <defs>
            <linearGradient id="brand-play-tri" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#60a5fa" />
              <stop offset="65%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path
            d="M8.5 6.2C8.5 5.4 9.4 4.9 10.1 5.3L18.2 10.4C18.8 10.8 18.8 11.7 18.2 12.1L10.1 17.2C9.4 17.6 8.5 17.1 8.5 16.3V6.2Z"
            fill="url(#brand-play-tri)"
          />
        </svg>
      </div>

      {showText && (
        <span
          className={`brand-gradient-text uppercase font-sans font-black leading-none drop-shadow ${textSizeClasses}`}
        >
          SARWARCYOU
        </span>
      )}
    </div>
  );
};

export default BrandLogo;
