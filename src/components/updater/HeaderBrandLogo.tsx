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
  onTrigger,
}) => {
  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    hapticMedium();

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
      aria-label="SARWAR.CYOU Vault Trigger"
      className={`inline-flex items-center select-none bg-transparent border-0 p-0 cursor-pointer focus:outline-none group ${className}`}
    >
      <span
        className={`font-['Space_Grotesk',sans-serif] font-black ${trackingClass} text-sm sm:text-base uppercase text-white flex items-center group-hover:opacity-90 transition-opacity`}
      >
        SARWAR<span className="text-[#ccff00]">.CYOU</span>
      </span>
    </div>
  );
};

export default HeaderBrandLogo;
