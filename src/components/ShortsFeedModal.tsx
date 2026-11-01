import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Volume2, VolumeX, Share2, Check, AlertTriangle, Loader2, Play, Pause } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { getVideoStreamUrl, getDirectHfVideoUrl, getMediaUrl } from '../utils/imageUrlResolver';
import { getThumbnailUrl } from '../utils/thumbnailResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';

export interface ShortsFeedModalProps {
  isOpen: boolean; onClose: () => void; shorts: StageMediaItem[]; initialIndex: number; onIndexChange?: (newIndex: number) => void;
}

export const ShortsFeedModal: React.FC<ShortsFeedModalProps> = ({
  isOpen, onClose, shorts, initialIndex = 0, onIndexChange,
}) => {
  useLockBodyScroll(isOpen);
  const [activeIndex, setActiveIndex] = useState(initialIndex || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [failedPermanently, setFailedPermanently] = useState<Record<number, boolean>>({});
  const [landscapeMap, setLandscapeMap] = useState<Record<number, boolean>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [centerIcon, setCenterIcon] = useState<{ idx: number; type: 'play' | 'pause'; id: number } | null>(null);
  const [showControls, setShowControls] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const failedItemsRef = useRef(new Set<string>());
  const hasInitialScrolledRef = useRef(false);
  const iconTimerRef = useRef<number | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

  // Auto-hide HUD controls after 2.5s of inactivity while playing
  const scheduleAutoHide = useCallback(() => {
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = window.setTimeout(() => {
      const currentVideo = videoRefs.current[activeIndex];
      if (currentVideo && !currentVideo.paused) {
        setShowControls(false);
      }
    }, 2500);
  }, [activeIndex]);

  // Keep controls visible on activeIndex change and schedule idle auto-hide
  useEffect(() => {
    setShowControls(true);
    scheduleAutoHide();
  }, [activeIndex, scheduleAutoHide]);

  // Desktop mouse movement reveals HUD and resets 2.5s idle timer
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  // Screen tap handler:
  // - If controls are hidden: reveals controls and starts 2.5s auto-hide timer
  // - If controls are visible: toggles play / pause
  const handleScreenTap = useCallback((idx: number) => {
    const v = videoRefs.current[idx];
    if (!v) return;

    if (!showControls) {
      setShowControls(true);
      scheduleAutoHide();
      return;
    }

    if (v.paused) {
      v.play().catch(() => {});
      setCenterIcon({ idx, type: 'play', id: Date.now() });
      scheduleAutoHide();
    } else {
      v.pause();
      setCenterIcon({ idx, type: 'pause', id: Date.now() });
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      setShowControls(true);
    }

    if (iconTimerRef.current) clearTimeout(iconTimerRef.current);
    iconTimerRef.current = window.setTimeout(() => setCenterIcon(null), 700);
  }, [showControls, scheduleAutoHide]);

  // Break the infinite fallback loop (Single-shot fallback per itemKey)
  const handleVideoError = useCallback((idx: number, item: StageMediaItem, currentSrc: string) => {
    const itemKey = item.id || item.url || item.name || String(idx);
    const directHfUrl = getDirectHfVideoUrl(item);
    if (!failedItemsRef.current.has(itemKey)) {
      failedItemsRef.current.add(itemKey);
      if (directHfUrl && currentSrc !== directHfUrl) {
        setOverrides((prev) => ({ ...prev, [idx]: directHfUrl }));
        const v = videoRefs.current[idx];
        if (v) { v.src = directHfUrl; v.load(); }
        return;
      }
    }
    setFailedPermanently((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        slideRefs.current[activeIndex + 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        slideRefs.current[activeIndex - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (e.key === 'm' || e.key === 'M') setIsMuted((prev) => !prev);
      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const v = videoRefs.current[activeIndex];
        if (!v) return;
        if (v.paused) {
          v.play().catch(() => {});
          setCenterIcon({ idx: activeIndex, type: 'play', id: Date.now() });
          scheduleAutoHide();
        } else {
          v.pause();
          setCenterIcon({ idx: activeIndex, type: 'pause', id: Date.now() });
          if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
          setShowControls(true);
        }
        if (iconTimerRef.current) clearTimeout(iconTimerRef.current);
        iconTimerRef.current = window.setTimeout(() => setCenterIcon(null), 700);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeIndex, onClose, scheduleAutoHide]);

  // Initial index accurate scrolling and playback on mount
  useEffect(() => {
    if (!isOpen || !containerRef.current || shorts.length === 0) return;
    hasInitialScrolledRef.current = false;
    const targetIdx = Math.max(0, Math.min(initialIndex || 0, shorts.length - 1));
    setActiveIndex(targetIdx);

    const targetElement =
      containerRef.current.querySelector<HTMLElement>(`[data-index="${targetIdx}"]`) ||
      slideRefs.current[targetIdx];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'instant', block: 'center' });
    }

    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i !== targetIdx) {
        v.pause();
        v.currentTime = 0;
      } else {
        v.muted = isMuted;
        v.play().catch(() => {
          v.muted = true;
          v.play().catch(() => {});
        });
      }
    });

    const timer = setTimeout(() => {
      hasInitialScrolledRef.current = true;
    }, 150);
    return () => clearTimeout(timer);
  }, [isOpen, initialIndex, shorts.length]);

  // Clean Native CSS Scroll-Snap Observer (threshold: 0.6)
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (!hasInitialScrolledRef.current) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idxAttr = entry.target.getAttribute('data-reel-index');
          if (idxAttr !== null) {
            const idx = parseInt(idxAttr, 10);
            if (!isNaN(idx)) {
              setActiveIndex(idx);
              onIndexChange?.(idx);
              videoRefs.current.forEach((v, i) => {
                if (!v) return;
                if (i !== idx) { v.pause(); v.currentTime = 0; }
                else { v.muted = isMuted; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); }
              });
            }
          }
        }
      });
    }, { root: containerRef.current, threshold: 0.6 });
    slideRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [isOpen, shorts.length, onIndexChange, isMuted]);

  const handleShare = async () => {
    const currentItem = shorts[activeIndex];
    if (!currentItem) return;
    const shareUrl = createShareableMediaUrl(currentItem, currentItem.category || 'shorts');
    if (await copyToClipboard(shareUrl)) { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
  };

  if (!isOpen) return null;
  if (!shorts || shorts.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md text-white p-6 select-none">
        <Loader2 className="w-10 h-10 animate-spin text-[#00f0ff] mb-4" />
        <p className="text-sm font-mono text-zinc-300 mb-6">No shorts available in this archive.</p>
        <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl bg-white/10 hover:bg-[#00f0ff]/20 border border-white/20 hover:border-[#00f0ff] text-white text-xs font-mono font-semibold transition-all cursor-pointer active:scale-95">
          Return to Explorer
        </button>
      </div>
    );
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center select-none overflow-hidden font-sans"
    >
      {/* Top HUD Controls - Auto-hides on mobile during playback */}
      <header
        className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-white/10 text-[#00f0ff] border border-[#00f0ff]/30 backdrop-blur-md">
          {activeIndex + 1} / {shorts.length}
        </span>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button type="button" onClick={() => setIsMuted((prev) => !prev)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#00f0ff]/20 text-white hover:text-[#00f0ff] border border-white/15 flex items-center justify-center transition-all cursor-pointer active:scale-95" title={isMuted ? 'Unmute (M)' : 'Mute (M)'}>
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button type="button" onClick={handleShare} className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#00f0ff]/20 text-white hover:text-[#00f0ff] border border-white/15 flex items-center justify-center transition-all cursor-pointer active:scale-95" title="Share Short">
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-red-500/20 text-white hover:text-red-400 border border-white/15 flex items-center justify-center transition-all cursor-pointer active:scale-95" title="Close (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Pure Native CSS Scroll-Snap Feed Container */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth overscroll-y-contain flex flex-col items-center no-scrollbar"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {shorts.map((item, idx) => {
          if (!item) return null;
          const streamUrl = overrides[idx] || getVideoStreamUrl(item) || getDirectHfVideoUrl(item);
          const posterUrl = getThumbnailUrl(item) || (item.thumbnail ? getMediaUrl(item.thumbnail) : '');
          const isLandscape = landscapeMap[idx];

          return (
            <div
              key={item.id || idx}
              ref={(el) => { slideRefs.current[idx] = el; }}
              data-index={idx}
              data-reel-index={idx}
              className="w-full h-screen shrink-0 snap-start snap-always relative flex items-center justify-center p-0 md:p-4"
            >
              <div
                onClick={() => handleScreenTap(idx)}
                className={`relative w-full h-full flex items-center justify-center transition-all duration-300 cursor-pointer select-none ${
                  isLandscape
                    ? 'w-full md:aspect-[16/9] md:max-w-[85vw] md:h-[80vh] md:max-h-[85vh]'
                    : 'w-full md:max-w-[480px] h-full md:max-h-[92vh]'
                }`}
              >
                {!failedPermanently[idx] ? (
                  <>
                    <video
                      ref={(el) => { videoRefs.current[idx] = el; }}
                      src={streamUrl}
                      poster={posterUrl || undefined}
                      playsInline
                      loop
                      muted={isMuted}
                      preload={Math.abs(idx - activeIndex) <= 1 ? 'auto' : 'none'}
                      className="w-full h-full object-contain rounded-none md:rounded-2xl shadow-2xl bg-black"
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        if (v.videoWidth && v.videoHeight) {
                          const isWide = v.videoWidth > v.videoHeight;
                          setLandscapeMap((prev) => (prev[idx] === isWide ? prev : { ...prev, [idx]: isWide }));
                        }
                      }}
                      onError={() => handleVideoError(idx, item, streamUrl)}
                    />
                    {centerIcon && centerIcon.idx === idx && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-out fade-out zoom-out duration-700">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl">
                          {centerIcon.type === 'play' ? (
                            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-[#00f0ff] fill-current ml-1" />
                          ) : (
                            <Pause className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-current" />
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full aspect-[9/16] max-h-[85vh] flex flex-col items-center justify-center bg-zinc-950/90 rounded-2xl p-6 text-center border border-white/10">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-3 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">Video Unavailable</h3>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShortsFeedModal;
