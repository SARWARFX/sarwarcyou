import React from 'react';

interface LaserIconProps {
  className?: string;
  size?: number | string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/**
 * Variation 4: Kinetic Laser Shimmer Wave Icons
 * Pure vector outlines in Stark White (#FFFFFF) & Pure Electric Cyan (#00F0FF)
 * Zero background, zero button boxes, with active laser wave sweep animation.
 */

export const LaserCloseIcon: React.FC<LaserIconProps> = ({ className = '', size = 30, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    <line x1="7" y1="7" x2="25" y2="25" stroke="url(#laserShimmerGrad)" strokeWidth="2.4" strokeLinecap="square" />
    <line x1="25" y1="7" x2="7" y2="25" stroke="url(#laserShimmerGrad)" strokeWidth="2.4" strokeLinecap="square" />
  </svg>
);

export const LaserPrevIcon: React.FC<LaserIconProps> = ({ className = '', size = 30, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    <path d="M 21 7 L 11 16 L 21 25" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" />
  </svg>
);

export const LaserNextIcon: React.FC<LaserIconProps> = ({ className = '', size = 30, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    <path d="M 11 7 L 21 16 L 11 25" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" />
  </svg>
);

export const LaserDownloadIcon: React.FC<LaserIconProps> = ({ className = '', size = 28, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    <line x1="16" y1="5" x2="16" y2="19" stroke="url(#laserShimmerGrad)" strokeWidth="2.4" strokeLinecap="square" />
    <path d="M 10 13 L 16 19 L 22 13" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter" />
    <line x1="6" y1="26" x2="26" y2="26" stroke="url(#laserShimmerGrad)" strokeWidth="2.4" strokeLinecap="square" />
  </svg>
);

export const LaserZoomInIcon: React.FC<LaserIconProps> = ({ className = '', size = 24, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    <line x1="12" y1="5" x2="12" y2="19" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinecap="square" />
    <line x1="5" y1="12" x2="19" y2="12" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinecap="square" />
  </svg>
);

export const LaserZoomOutIcon: React.FC<LaserIconProps> = ({ className = '', size = 24, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    <line x1="5" y1="12" x2="19" y2="12" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinecap="square" />
  </svg>
);

export const LaserPlayIcon: React.FC<LaserIconProps> = ({ className = '', size = 28, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    <path d="M 8 5 L 22 14 L 8 23 Z" fill="rgba(0, 240, 255, 0.1)" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinejoin="miter" />
  </svg>
);

export const LaserPauseIcon: React.FC<LaserIconProps> = ({ className = '', size = 28, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    <line x1="9" y1="5" x2="9" y2="23" stroke="url(#laserShimmerGrad)" strokeWidth="2.4" strokeLinecap="square" />
    <line x1="19" y1="5" x2="19" y2="23" stroke="url(#laserShimmerGrad)" strokeWidth="2.4" strokeLinecap="square" />
  </svg>
);

export interface LaserVolumeIconProps extends LaserIconProps {
  isMuted?: boolean;
}

export const LaserVolumeIcon: React.FC<LaserVolumeIconProps> = ({ className = '', size = 24, isMuted = false, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    {/* Speaker Horn */}
    <path d="M 5 10 L 9 10 L 14 5 L 14 23 L 9 18 L 5 18 Z" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinejoin="miter" />
    {isMuted ? (
      <line x1="18" y1="9" x2="25" y2="19" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinecap="square" />
    ) : (
      <>
        <path d="M 18 10 C 19.5 11.5, 19.5 16.5, 18 18" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2" strokeLinecap="square" />
        <path d="M 22 7 C 24.5 9.5, 24.5 18.5, 22 21" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2" strokeLinecap="square" />
      </>
    )}
  </svg>
);

export const LaserFullscreenIcon: React.FC<LaserIconProps> = ({ className = '', size = 24, onClick, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    onClick={onClick}
    style={style}
    className={`laser-shimmer-icon select-none transition-transform duration-200 hover:scale-115 ${className}`}
  >
    <path d="M 5 10 L 5 5 L 10 5" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinecap="square" />
    <path d="M 18 5 L 23 5 L 23 10" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinecap="square" />
    <path d="M 5 18 L 5 23 L 10 23" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinecap="square" />
    <path d="M 18 23 L 23 23 L 23 18" fill="none" stroke="url(#laserShimmerGrad)" strokeWidth="2.2" strokeLinecap="square" />
  </svg>
);
