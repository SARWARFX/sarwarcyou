import React, { useCallback } from 'react';
import { hapticMedium } from '../../utils/hapticsManager';
import { LaserSparkLogo } from '../brand/LaserSparkLogo';

export interface HeaderBrandLogoProps {
  className?: string;
  trackingClass?: string;
  variant?: 'monolith' | 'cspr' | 'minimal';
  onTrigger?: () => void;
}

export const HeaderBrandLogo: React.FC<HeaderBrandLogoProps> = ({
  className = '',
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
      <LaserSparkLogo width={150} height={22} interactive={false} />
    </div>
  );
};

export default HeaderBrandLogo;
