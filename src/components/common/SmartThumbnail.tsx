import React, { useState, useEffect } from 'react';
import { getLocalCachedPhotoUrl } from '../../services/photoSyncManager';

export interface SmartThumbnailProps {
  src?: string | null;
  alt?: string;
  className?: string;
  containerClassName?: string;
  aspectClass?: string;
  fallbackTitle?: string;
  children?: React.ReactNode;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const SmartThumbnail: React.FC<SmartThumbnailProps> = ({
  src,
  alt = 'Thumbnail',
  className = '',
  containerClassName = '',
  aspectClass = '',
  fallbackTitle,
  children,
  loading = 'lazy',
  decoding = 'async',
  onClick,
}) => {
  const localSrc = getLocalCachedPhotoUrl(src);
  const cleanSrc = localSrc || (typeof src === 'string' && src.trim() !== '' ? src.trim() : null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(!cleanSrc);

  // Reset states when the image source changes
  useEffect(() => {
    if (!cleanSrc) {
      setHasError(true);
      setIsLoaded(false);
    } else {
      setHasError(false);
      setIsLoaded(false);
    }
  }, [cleanSrc]);

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-[#05080e] border border-white/10 rounded-sm select-none ${aspectClass} ${containerClassName}`}
    >
      {/* 1. LOADING SKELETON LAYER (Mounted while cleanSrc exists and !isLoaded && !hasError) */}
      {cleanSrc && !isLoaded && !hasError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none bg-[#05080e]">
          {/* Sweeping Laser Shimmer */}
          <div
            className="absolute inset-0 w-full h-full animate-laser-shimmer pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.04) 35%, rgba(255,255,255,0.12) 50%, rgba(56,189,248,0.04) 65%, transparent 100%)',
            }}
          />

          {/* Center Telemetry */}
          <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
            {/* Pulsing subtle dot inside expanding ring */}
            <div className="relative flex items-center justify-center w-6 h-6">
              <span className="absolute w-4 h-4 rounded-full bg-white/20 animate-ping" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
            </div>

            {/* Loading Text */}
            <span className="font-['Google Sans'] font-medium text-[10px] tracking-[0.24em] text-zinc-500 uppercase mt-2 truncate max-w-full px-2">
              LOADING...
            </span>
          </div>
        </div>
      )}

      {/* 2. ERROR / ARCHIVE FALLBACK */}
      {hasError || !cleanSrc ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-[#05080e] via-[#090e17] to-[#020408] p-3 text-center">
          <div className="w-2 h-2 rounded-full bg-slate-600/50 mb-2" />
          <span className="font-['Google Sans'] font-medium text-[10px] tracking-widest text-slate-400 uppercase drop-shadow">
            MEDIA ARCHIVE // READY
          </span>
          {fallbackTitle && (
            <span className="text-[9px] font-mono tracking-wider text-slate-500 uppercase mt-1 truncate max-w-[85%]">
              {fallbackTitle}
            </span>
          )}
        </div>
      ) : (
        /* 3. IMAGE ELEMENT & TRANSITION */
        <img
          src={cleanSrc}
          alt={alt}
          loading={loading}
          decoding={decoding}
          onLoad={() => {
            setIsLoaded(true);
            setHasError(false);
          }}
          onError={() => {
            setHasError(true);
            setIsLoaded(false);
          }}
          ref={(img) => {
            if (img && img.complete && img.naturalWidth > 0 && !isLoaded) {
              setIsLoaded(true);
              setHasError(false);
            }
          }}
          className={`w-full h-full object-cover transition-opacity duration-500 ease-out ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
        />
      )}

      {/* 4. Optional Overlay Elements (Play Buttons, Badges, Vignettes) */}
      {children}
    </div>
  );
};

export default SmartThumbnail;
