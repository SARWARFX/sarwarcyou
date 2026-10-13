/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from 'lucide-react';
import { getDirectImageUrl, ensureHttps } from '../utils/imageUrlResolver';
import { downloadMedia } from '../utils/downloadMedia';
import type { AlbumData, StageMediaItem } from '../types';

interface YouTubeTheaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: AlbumData | null;
  initialIndex: number;
  onNextAlbum?: () => void;
  onPrevAlbum?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const YouTubeTheaterModal: React.FC<YouTubeTheaterModalProps> = ({
  isOpen,
  onClose,
  album,
  initialIndex,
  onNextAlbum,
  onPrevAlbum,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playlistContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef({ y: 0, time: 0 });

  // Sync index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
    setIsPlaying(true);
    setCurrentTime(0);
  }, [initialIndex, isOpen]);

  const items = useMemo(() => album?.items || [], [album]);
  const currentItem: StageMediaItem | undefined = items[currentIndex] || items[0];

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        goToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToIndex(currentIndex - 1);
      } else if (e.key === ' ' && currentItem?.type === 'video') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        handleMuteToggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, currentIndex, items.length, onClose, isFullscreen, currentItem?.type]);

  const goToIndex = useCallback(
    (idx: number) => {
      if (items.length === 0) return;
      const next = (idx + items.length) % items.length;
      setIsCrossfading(true);
      setIsZoomed(false);
      setCurrentIndex(next);
      window.setTimeout(() => {
        setIsCrossfading(false);
      }, 200);
    },
    [items.length]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const playlist = playlistContainerRef.current;
      const isOverPlaylist = playlist && playlist.contains(e.target as Node);
      if (isOverPlaylist && playlist) {
        const atBottom = playlist.scrollTop + playlist.clientHeight >= playlist.scrollHeight - 5;
        const atTop = playlist.scrollTop <= 5;
        if (e.deltaY > 65 && atBottom) {
          onClose();
          onNextAlbum?.();
        } else if (e.deltaY < -65 && atTop) {
          onClose();
          onPrevAlbum?.();
        }
      } else {
        if (e.deltaY > 65) {
          onClose();
          onNextAlbum?.();
        } else if (e.deltaY < -65) {
          onClose();
          onPrevAlbum?.();
        }
      }
    },
    [onClose, onNextAlbum, onPrevAlbum]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { y: e.touches[0].clientY, time: performance.now() };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
      const elapsed = performance.now() - touchStartRef.current.time;
      if (elapsed < 350) {
        if (deltaY > 100) {
          onClose();
          onNextAlbum?.();
        } else if (deltaY < -100) {
          onClose();
          onPrevAlbum?.();
        }
      }
    },
    [onClose, onNextAlbum, onPrevAlbum]
  );

  const handleDownload = useCallback(async () => {
    if (!currentItem || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      await downloadMedia(currentItem.url, currentItem.title || currentItem.id);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [currentItem, isDownloading]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
      }
      return next;
    });
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  if (!isOpen || !currentItem) return null;

  const rawUrl = ensureHttps(currentItem.url);
  let streamUrl = rawUrl;
  if (streamUrl.includes('drive.google.com') && !streamUrl.includes('/preview')) {
    streamUrl = streamUrl.replace(/\/view(\?.*)?$/, '/preview');
    if (!streamUrl.includes('/preview')) {
      streamUrl = streamUrl.replace(/\?usp=.*$/, '') + '/preview';
    }
  }

  const directImgUrl = getDirectImageUrl(currentItem, currentIndex);
  const rawTitle = currentItem.title || '';
  const cleanTitle =
    rawTitle.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() ||
    (currentItem.type === 'video' ? 'Cinema Stream' : 'Photograph');
  const isDirectVideo =
    streamUrl.toLowerCase().match(/\.(mp4|webm|mov|mkv)/) !== null ||
    streamUrl.includes('huggingface.co');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={cleanTitle}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-2xl animate-fade-in select-none overflow-hidden"
    >
      {/* ===== OLED TOP CONTROL BAR ===== */}
      <div className="w-full px-4 sm:px-6 py-3 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl flex items-center justify-between text-xs font-mono z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-white/10 text-zinc-300 font-semibold tracking-widest text-[9px] uppercase flex-shrink-0">
            {album?.name || 'ALBUM'}
          </span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-zinc-400 font-medium tracking-wider hidden sm:inline text-[10px]">
            {String(currentIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
          <span className="text-zinc-200 font-medium truncate max-w-[180px] sm:max-w-xs md:max-w-md hidden md:inline text-[11px]">
            {cleanTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {currentItem.type === 'image' && (
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors duration-200 cursor-pointer border border-white/[0.06]"
              title={isZoomed ? 'Zoom out (100%)' : 'Zoom in (160%)'}
            >
              {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer border ${
              downloadSuccess
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border-white/[0.08]'
            } disabled:opacity-40`}
            title="Download original media file"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] hidden sm:inline">SAVED</span>
              </>
            ) : (
              <>
                <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span className="text-[10px] hidden sm:inline">
                  {isDownloading ? 'DOWNLOADING...' : 'DOWNLOAD'}
                </span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors duration-200 cursor-pointer border border-white/[0.06]"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ===== MAIN THEATER BODY ===== */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2.5 sm:p-4 lg:p-5 gap-3.5">
        {/* ===== LEFT MAIN VIEWPORT (~72% DESKTOP) ===== */}
        <div className="w-full lg:w-[72%] flex flex-col bg-[#09090b] rounded-2xl border border-white/[0.06] overflow-hidden flex-shrink-0 h-[48vh] sm:h-[58vh] lg:h-full shadow-2xl relative">
          {/* Cinema Stage Container */}
          <div
            ref={videoContainerRef}
            className={`relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden transition-opacity duration-200 ${
              isCrossfading ? 'opacity-30' : 'opacity-100'
            }`}
          >
            {/* Subtle Ambient Video Glow Backdrop reflecting real-time luminance */}
            {currentItem.type === 'video' && isDirectVideo && (
              <video
                src={streamUrl}
                aria-hidden="true"
                muted
                loop
                playsInline
                autoPlay
                className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-25 scale-110 pointer-events-none z-0"
              />
            )}

            {currentItem.type === 'video' ? (
              isDirectVideo ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center z-10 group/player">
                  <video
                    ref={videoRef}
                    key={streamUrl}
                    src={streamUrl}
                    autoPlay
                    playsInline
                    muted={isMuted}
                    onClick={togglePlay}
                    onTimeUpdate={() => {
                      if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) setDuration(videoRef.current.duration);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full h-full object-contain cursor-pointer"
                  />

                  {/* Center Play/Pause indicator on click */}
                  {!isPlaying && (
                    <button
                      onClick={togglePlay}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] transition-all cursor-pointer z-20"
                    >
                      <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-2xl">
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </div>
                    </button>
                  )}

                  {/* Minimalist 16:9 Playback Control Bar */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 sm:p-4 z-30 opacity-90 group-hover/player:opacity-100 transition-opacity flex flex-col gap-2">
                    {/* Progress Scrubber */}
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        step="0.1"
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-zinc-200 hover:h-1.5 transition-all"
                      />
                    </div>

                    {/* Lower Controls Row */}
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-300">
                      <div className="flex items-center gap-3">
                        {/* Play/Pause */}
                        <button
                          onClick={togglePlay}
                          className="hover:text-white transition-colors cursor-pointer"
                          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>

                        {/* Mute + Volume Slider */}
                        <div className="flex items-center gap-1.5 group/vol">
                          <button
                            onClick={handleMuteToggle}
                            className="hover:text-white transition-colors cursor-pointer"
                            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                          >
                            {isMuted || volume === 0 ? (
                              <VolumeX className="w-4 h-4 text-zinc-500" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-14 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-zinc-200 hidden sm:inline"
                          />
                        </div>

                        {/* Time Counter */}
                        <span className="text-[10px] text-zinc-400 tracking-wider">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      {/* Right: Download & Fullscreen */}
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={handleDownload}
                          disabled={isDownloading}
                          className="p-1 rounded hover:text-white text-zinc-400 transition-colors cursor-pointer"
                          title="Download Video File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={toggleFullscreen}
                          className="p-1 rounded hover:text-white text-zinc-400 transition-colors cursor-pointer"
                          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <iframe
                  src={`${streamUrl}?autoplay=1`}
                  className="w-full h-full border-0 relative z-10"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  title={cleanTitle}
                />
              )
            ) : (
              /* Image Lightbox View */
              <div
                onClick={() => setIsZoomed(!isZoomed)}
                className="w-full h-full flex items-center justify-center p-3 cursor-pointer overflow-hidden z-10"
              >
                <img
                  src={directImgUrl}
                  alt={cleanTitle}
                  loading="lazy"
                  className={`max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-300 ease-out ${
                    isZoomed ? 'scale-[1.65] cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Under-player Editorial Status Bar */}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#09090b] flex items-center justify-between text-xs font-mono">
            <div className="truncate max-w-[70%]">
              <span className="font-medium text-zinc-100 text-[11px] tracking-wide block truncate">
                {cleanTitle}
              </span>
              <span className="text-zinc-500 text-[9px] tracking-wider uppercase block mt-0.5">
                {currentItem.type === 'video'
                  ? 'STREAMING 1080P • OLED ENCODED'
                  : isZoomed
                  ? 'ZOOMED 165% • LOSSLESS CANVAS'
                  : 'HIGH DEFINITION PHOTOGRAPH'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => goToIndex(currentIndex - 1)}
                className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer border border-white/[0.05]"
                title="Previous (←)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => goToIndex(currentIndex + 1)}
                className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer border border-white/[0.05]"
                title="Next (→)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ===== RIGHT PLAYLIST QUEUE (~28% DESKTOP) ===== */}
        <div
          ref={playlistContainerRef}
          className="w-full lg:w-[28%] flex-1 lg:h-full flex flex-col bg-[#09090b] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl"
        >
          {/* Queue Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] bg-[#09090b] flex items-center justify-between text-[10px] font-mono flex-shrink-0">
            <span className="font-semibold text-zinc-300 tracking-wider uppercase">
              QUEUE ({items.length})
            </span>
            <span className="text-zinc-500 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" /> READY
            </span>
          </div>

          {/* Scrollable Playlist Cards */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 no-scrollbar">
            {items.map((item, idx) => {
              const isActive = idx === currentIndex;
              const thumbUrl = getDirectImageUrl(item, idx);
              const itemTitle = (item.title || `Media ${idx + 1}`)
                .replace(/\.[^/.]+$/, '')
                .replace(/[-_]+/g, ' ')
                .trim();

              return (
                <div
                  key={item.id || `queue-${idx}`}
                  onClick={() => goToIndex(idx)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all duration-200 group ${
                    isActive
                      ? 'bg-zinc-800/80 border border-white/[0.12] shadow-md'
                      : 'hover:bg-zinc-900/80 border border-transparent'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-20 sm:w-24 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0">
                    {item.type === 'video' && item.url.includes('huggingface.co') ? (
                      <video
                        src={encodeURI(ensureHttps(item.url))}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    ) : (
                      <img
                        src={thumbUrl}
                        alt={itemTitle}
                        loading="lazy"
                        className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    {isActive ? (
                      <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-black font-mono font-bold text-[8px] tracking-widest uppercase">
                          PLAYING
                        </span>
                      </div>
                    ) : item.type === 'video' ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-3 h-3 text-white fill-current" />
                      </div>
                    ) : null}
                  </div>

                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-[11px] font-medium truncate block leading-tight ${
                        isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'
                      } transition-colors duration-200`}
                    >
                      {itemTitle}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase block mt-0.5">
                      {String(idx + 1).padStart(2, '0')} • {item.type === 'video' ? 'VIDEO' : 'PHOTO'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-white/[0.04] bg-black text-center text-[9px] font-mono tracking-widest text-zinc-600 uppercase flex-shrink-0">
            SCROLL PAST QUEUE TO ELEVATE
          </div>
        </div>
      </div>
    </div>
  );
};
