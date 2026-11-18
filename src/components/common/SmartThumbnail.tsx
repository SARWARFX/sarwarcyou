import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface SmartThumbnailProps {
  src?: string | null;
  videoSrc?: string | null;
  enableHoverPreview?: boolean;
  alt?: string;
  className?: string;
  containerClassName?: string;
  aspectClass?: string;
  fallbackTitle?: string;
  children?: React.ReactNode | ((state: { isPreviewActive: boolean }) => React.ReactNode);
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const SmartThumbnail: React.FC<SmartThumbnailProps> = ({
  src,
  videoSrc,
  enableHoverPreview = false,
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

  // Micro Hover Preview States (Option B: 10% to 35% continuous loop)
  const [isPreviewActive, setIsPreviewActive] = useState<boolean>(false);
  const [previewProgress, setPreviewProgress] = useState<number>(0);
  const hoverTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!videoSrc || !enableHoverPreview) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // 250ms debounce before spinning up video decoder to avoid rapid cursor sweeping
    hoverTimerRef.current = window.setTimeout(() => {
      setIsPreviewActive(true);
    }, 250);
  }, [videoSrc, enableHoverPreview]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsPreviewActive(false);
    setPreviewProgress(0);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch {}
    }
  }, []);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    v.muted = true;
    v.defaultMuted = true;
    const dur = v.duration;
    if (dur && !isNaN(dur) && dur > 0) {
      // Option B: Start at 10% of total video duration
      v.currentTime = dur * 0.1;
    }
    v.play().catch(() => {});
  }, []);

  const handleCanPlay = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    v.muted = true;
    v.defaultMuted = true;
    v.play().catch(() => {});
  }, []);

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    const dur = v.duration;
    if (!dur || isNaN(dur) || dur <= 0) return;

    const start = dur * 0.1; // 10%
    const end = dur * 0.35;  // 35%

    // Option B: Loop continuously between 10% and 35% while hovered
    if (v.currentTime >= end || v.currentTime < start) {
      v.currentTime = start;
    }

    const sliceLength = end - start;
    if (sliceLength > 0) {
      const pct = Math.min(100, Math.max(0, ((v.currentTime - start) / sliceLength) * 100));
      setPreviewProgress(pct);
    }
  }, []);

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden bg-[#08080a] border border-white/10 rounded-none select-none ${aspectClass} ${containerClassName}`}
      style={{ borderRadius: 0, outline: 'none' }}
    >
      {/* 1. ACID AVANT-GARDE LOADING SKELETON LAYER */}
      {cleanSrc && !isLoaded && !hasError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none bg-[#08080a]">
          {/* Sweeping Acid Lime Anamorphic Scanline */}
          <div
            className="absolute inset-0 w-full h-full animate-laser-shimmer pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(0, 240, 255,0.03) 25%, rgba(0, 240, 255,0.18) 50%, rgba(255,255,255,0.12) 53%, rgba(0, 240, 255,0.03) 75%, transparent 100%)',
            }}
          />

          {/* Avant-Garde Framing Corner Reticle Ticks */}
          <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#00f0ff]/40" />
          <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[#00f0ff]/40" />
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-[#00f0ff]/40" />
          <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[#00f0ff]/40" />

          {/* Center Telemetry */}
          <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
            {/* Pulsing Acid Lime Glyph with Neon Bloom */}
            <div className="relative flex items-center justify-center w-7 h-7">
              <span className="absolute w-5 h-5 rounded-full border border-[#00f0ff]/50 animate-ping opacity-60" />
              <span className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]" />
            </div>

            {/* Loading Telemetry Label */}
            <span className="font-mono font-bold text-[9px] tracking-[0.26em] text-[#00f0ff] uppercase mt-2.5 truncate max-w-full px-2 flex items-center gap-1.5 drop-shadow-[0_0_6px_rgba(0, 240, 255,0.4)]">
              LOADING
            </span>
          </div>
        </div>
      )}

      {/* 2. ERROR / ARCHIVE FALLBACK */}
      {hasError || !cleanSrc ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#08080a] p-3 text-center border border-white/5">
          <div className="w-2 h-2 rounded-full bg-[#00f0ff]/40 mb-2 shadow-[0_0_6px_rgba(0, 240, 255,0.3)]" />
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

      {/* 4. ACTIVE MICRO VIDEO PREVIEW LAYER (Option B: 10% to 35% continuous loop) */}
      {isPreviewActive && videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onTimeUpdate={handleTimeUpdate}
          className="absolute inset-0 w-full h-full object-cover z-20 pointer-events-none transition-opacity duration-300"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        />
      )}

      {/* 5. TACTICAL THIN MICRO PROGRESS TRACK */}
      {isPreviewActive && (
        <div
          className="absolute bottom-0 inset-x-0 h-[2px] bg-white/20 z-30 pointer-events-none overflow-hidden"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          <div
            className="h-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8] transition-all duration-75 ease-linear"
            style={{ width: `${previewProgress}%`, borderRadius: 0 }}
          />
        </div>
      )}

      {/* 6. SUBTLE CYBER PREVIEW TELEMETRY CHIP */}
      {isPreviewActive && (
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/85 border border-[#38bdf8]/40 shadow-[0_0_8px_rgba(0,0,0,0.8)] z-30 pointer-events-none flex items-center gap-1.5 animate-fade-in"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          <span className="w-1.5 h-1.5 bg-[#38bdf8] shadow-[0_0_6px_#38bdf8] animate-pulse inline-block" />
          <span className="text-[9px] font-mono font-bold tracking-wider text-[#38bdf8] uppercase">
            PREVIEW
          </span>
        </div>
      )}

      {/* 7. OPTIONAL OVERLAY ELEMENTS (Play Buttons, Badges, Vignettes) */}
      {typeof children === 'function' ? children({ isPreviewActive }) : children}
    </div>
  );
};

export default SmartThumbnail;
