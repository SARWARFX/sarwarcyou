import React, { useCallback } from 'react';
import { hapticMedium } from '../../utils/hapticsManager';

export interface HeaderBrandLogoProps {
  className?: string;
  trackingClass?: string;
  variant?: 'monolith' | 'cspr' | 'minimal';
  onTrigger?: () => void;
}

export const HeaderBrandLogo: React.FC<HeaderBrandLogoProps> = ({
  className = '',
  trackingClass = 'tracking-[0.25em]',
  variant = 'monolith',
  onTrigger,
}) => {
  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    hapticMedium();

    // Toggle Concealed Terminal Drawer (which automatically checks for updates and displays notification)
    if (onTrigger) {
      onTrigger();
    }
  }, [onTrigger]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleLogoClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleLogoClick(e as any);
        }
      }}
      aria-label="SARWARCYOU"
      className={`inline-flex items-center select-none bg-transparent border-0 p-0 cursor-pointer focus:outline-none ${className}`}
    >
      <span
        className={`font-['Roboto_Condensed'] font-black ${trackingClass} text-sm uppercase text-white/95 flex items-center`}
      >
        {variant === 'cspr' ? (
          <>
            SARWAR<span className="text-[#38bdf8]">.CYOU</span>
          </>
        ) : (
          <>
            SARWAR<span className="text-[#00f0ff]">CYOU</span>
          </>
        )}
      </span>
    </div>
  );
};

export default HeaderBrandLogo;
