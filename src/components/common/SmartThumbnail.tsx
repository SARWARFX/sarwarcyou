import React, { useState, useEffect } from 'react';

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
  const cleanSrc = typeof src === 'string' && src.trim() !== '' ? src.trim() : null;
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
      className={`relative overflow-hidden bg-[#08080a] border border-white/10 rounded-sm select-none ${aspectClass} ${containerClassName}`}
    >
      {/* 1. ACID AVANT-GARDE LOADING SKELETON LAYER */}
      {cleanSrc && !isLoaded && !hasError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none bg-[#08080a]">
          {/* Sweeping Acid Lime Anamorphic Scanline */}
          <div
            className="absolute inset-0 w-full h-full animate-laser-shimmer pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(204,255,0,0.03) 25%, rgba(204,255,0,0.18) 50%, rgba(255,255,255,0.12) 53%, rgba(204,255,0,0.03) 75%, transparent 100%)',
            }}
          />

          {/* Avant-Garde Framing Corner Reticle Ticks */}
          <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#ccff00]/40" />
          <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[#ccff00]/40" />
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-[#ccff00]/40" />
          <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[#ccff00]/40" />

          {/* Center Telemetry */}
          <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
            {/* Pulsing Acid Lime Glyph with Neon Bloom */}
            <div className="relative flex items-center justify-center w-7 h-7">
              <span className="absolute w-5 h-5 rounded-full border border-[#ccff00]/50 animate-ping opacity-60" />
              <span className="w-2 h-2 rounded-full bg-[#ccff00] shadow-[0_0_10px_#ccff00]" />
            </div>

            {/* Loading Telemetry Label */}
            <span className="font-mono font-bold text-[9px] tracking-[0.26em] text-[#ccff00] uppercase mt-2.5 truncate max-w-full px-2 flex items-center gap-1.5 drop-shadow-[0_0_6px_rgba(204,255,0,0.4)]">
              LOADING
            </span>
          </div>
        </div>
      )}

      {/* 2. ERROR / ARCHIVE FALLBACK */}
      {hasError || !cleanSrc ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#08080a] p-3 text-center border border-white/5">
          <div className="w-2 h-2 rounded-full bg-[#ccff00]/40 mb-2 shadow-[0_0_6px_rgba(204,255,0,0.3)]" />
          <span className="font-mono font-bold text-[9px] tracking-widest text-neutral-400 uppercase">
            ARCHIVE // READY
          </span>
          {fallbackTitle && (
            <span className="text-[9px] font-mono tracking-wider text-neutral-500 uppercase mt-1 truncate max-w-[85%]">
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
