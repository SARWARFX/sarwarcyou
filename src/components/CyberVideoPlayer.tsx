import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  RotateCcw,
  RotateCw,
  Repeat,
  Gauge,
  ListVideo,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import type { StageMediaItem } from '../types';
import { downloadBrandedVideo } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';

export interface CyberVideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  item: StageMediaItem | null;
  playlist?: StageMediaItem[];
  onSelectItem?: (item: StageMediaItem) => void;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const CyberVideoPlayer: React.FC<CyberVideoPlayerProps> = ({
  isOpen,
  onClose,
  item,
  playlist = [],
  onSelectItem,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // A-B Loop State
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  // HUD Auto-hide state
  const [showHud, setShowHud] = useState(true);
  const hudTimerRef = useRef<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingProgress = useRef(false);

  // Auto-hide HUD on inactivity
  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    hudTimerRef.current = window.setTimeout(() => {
      setShowHud(false);
      setShowSpeedMenu(false);
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    };
  }, []);

  // Sync state on media change
  const [prevItemKey, setPrevItemKey] = useState({ itemId: item?.id, isOpen });
  if (prevItemKey.itemId !== item?.id || prevItemKey.isOpen !== isOpen) {
    setPrevItemKey({ itemId: item?.id, isOpen });
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setLoopA(null);
    setLoopB(null);
  }

  // A-B Looping Enforcement
  useEffect(() => {
    if (loopA !== null && loopB !== null && loopB > loopA) {
      if (currentTime >= loopB || currentTime < loopA) {
        if (videoRef.current) {
          videoRef.current.currentTime = loopA;
        }
      }
    }
  }, [currentTime, loopA, loopB]);

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetHudTimer();
  }, [resetHudTimer]);

  // Relative Seek
  const seekBy = useCallback((delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta));
    resetHudTimer();
  }, [resetHudTimer]);

  // Progress Bar Seek
  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pct * (videoRef.current.duration || 0);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    resetHudTimer();
  };

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    resetHudTimer();
  }, [resetHudTimer]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        seekBy(10);
      } else if (e.key === 'ArrowLeft') {
        seekBy(-10);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((m) => {
          if (videoRef.current) videoRef.current.muted = !m;
          return !m;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, togglePlay, seekBy, toggleFullscreen]);

  // Handle Download
  const handleDownload = async () => {
    if (!item || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      const dlUrl = getMediaUrl(item.url);
      await downloadBrandedVideo(dlUrl, item.title, 'clip');
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } catch (err) {
      console.error('Video download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle A-B Loop Toggle
  const handleToggleLoop = () => {
    if (loopA === null) {
      setLoopA(currentTime);
    } else if (loopB === null && currentTime > loopA) {
      setLoopB(currentTime);
    } else {
      setLoopA(null);
      setLoopB(null);
    }
    resetHudTimer();
  };

  if (!isOpen || !item) return null;

  const streamUrl = getMediaUrl(item.url);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={resetHudTimer}
      onClick={resetHudTimer}
      className="fixed inset-0 z-[120] bg-[#030305] flex items-center justify-center select-none overflow-hidden font-sans"
    >
      {/* 1. Ambient Blurred Glow reflecting active video colors */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
        <video
          src={streamUrl}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          className="w-full h-full object-cover filter blur-[90px] opacity-35 scale-125"
        />
      </div>

      {/* 2. Top Bar (Title & Dismiss) */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-4 sm:p-6 flex items-center justify-between transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white backdrop-blur-xl border border-white/10 transition-colors cursor-pointer"
            title="Close Theater (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide truncate max-w-sm sm:max-w-md">
              {item.title}
            </h1>
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              {item.category || 'Cinema Vault'}
            </span>
          </div>
        </div>

        {/* Right Action: Queue Toggle */}
        {playlist.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setShowQueue(!showQueue);
              resetHudTimer();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold font-sans tracking-wider backdrop-blur-xl border transition-all cursor-pointer ${
              showQueue
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40'
                : 'bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border-white/10'
            }`}
          >
            <ListVideo className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QUEUE</span>
            <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.2 rounded-full">
              {playlist.length}
            </span>
          </button>
        )}
      </div>

      {/* 3. Frameless Center Video Stage */}
      <div
        className="relative z-10 w-full h-full flex items-center justify-center p-2 sm:p-6"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          key={item.id}
          src={streamUrl}
          autoPlay
          playsInline
          muted={isMuted}
          className="max-w-full max-h-[88vh] object-contain rounded-lg shadow-2xl cursor-pointer"
          onTimeUpdate={() => {
            if (videoRef.current && !isDraggingProgress.current) {
              setCurrentTime(videoRef.current.currentTime);
              if (videoRef.current.buffered.length > 0) {
                setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
              }
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      </div>

      {/* 4. Floating HUD Controls (Bottom) */}
      <div
        className={`absolute bottom-4 sm:bottom-6 inset-x-4 sm:inset-x-8 z-30 flex flex-col gap-2 max-w-5xl mx-auto transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber Bar */}
        <div
          ref={progressBarRef}
          onClick={handleProgressSeek}
          className="group/seek relative w-full h-2 hover:h-3 bg-white/10 rounded-full cursor-pointer transition-all flex items-center overflow-hidden"
        >
          {/* Buffered Progress */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/20 rounded-full transition-all"
            style={{ width: `${bufferPct}%` }}
          />
          {/* Active Progress with Neon Cyan Glow */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#00E5FF] shadow-[0_0_12px_#00E5FF] rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* HUD Button Row: Smoked Frosted Glass Pill */}
        <div className="cyber-pill px-4 py-2.5 flex items-center justify-between gap-3 shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
          {/* Bottom-Left: Play, Rewind/Forward, Volume, Timestamps */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="10s Back"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="10s Forward"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                type="button"
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (videoRef.current) videoRef.current.muted = !isMuted;
                }}
                className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Mute / Unmute (M)"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(false);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = false;
                  }
                }}
                className="w-14 sm:w-18 h-1 accent-[#00E5FF] cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              />
            </div>

            {/* Timestamp */}
            <span className="text-[11px] sm:text-xs font-mono font-medium text-zinc-300 tracking-wider">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Bottom-Right: A-B loop, Speed, Download, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* A-B Loop */}
            <button
              type="button"
              onClick={handleToggleLoop}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer ${
                loopA !== null && loopB !== null
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40'
                  : loopA !== null
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'hover:bg-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
              title="A-B Loop"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {loopA !== null && loopB !== null ? 'A-B ON' : loopA !== null ? 'SET B' : 'LOOP'}
              </span>
            </button>

            {/* Speed Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer"
                title="Playback Speed"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{playbackRate}x</span>
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-10 right-0 cyber-glass rounded-xl p-1.5 flex flex-col gap-1 min-w-[75px] shadow-2xl z-50">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        setPlaybackRate(rate);
                        if (videoRef.current) videoRef.current.playbackRate = rate;
                        setShowSpeedMenu(false);
                      }}
                      className={`px-2 py-1 rounded-md text-xs font-mono font-bold text-left transition-colors cursor-pointer ${
                        playbackRate === rate
                          ? 'bg-[#00E5FF]/20 text-[#00E5FF]'
                          : 'text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 1-Click Download */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-sans tracking-wider transition-all cursor-pointer ${
                downloadSuccess
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'hover:bg-white/10 text-zinc-300 hover:text-white'
              } disabled:opacity-40`}
              title="Download Clip"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">SAVED</span>
                </>
              ) : (
                <>
                  {isDownloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00E5FF]" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">DOWNLOAD</span>
                </>
              )}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Fullscreen (F)"
            >
              {document.fullscreenElement ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Right-Hand Queue: Smoked Frosted-Glass Panel */}
      {showQueue && playlist.length > 0 && (
        <aside className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 z-40 cyber-glass border-l border-white/[0.08] flex flex-col p-4 shadow-2xl animate-slide-left">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ListVideo className="w-4 h-4 text-[#00E5FF]" />
              <h2 className="text-sm font-bold font-sans text-white uppercase tracking-wider">
                Video Queue
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowQueue(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto no-scrollbar py-3 flex flex-col gap-2">
            {playlist.map((queueItem, qIdx) => {
              const isActive = queueItem.id === item.id || queueItem.url === item.url;
              return (
                <div
                  key={queueItem.id || qIdx}
                  onClick={() => onSelectItem?.(queueItem)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'bg-white/15 border border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0">
                    <img
                      src={queueItem.thumbnail || queueItem.poster || queueItem.url}
                      alt={queueItem.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isActive && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-3 h-3 text-[#00E5FF] fill-current" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-xs font-semibold block truncate ${
                        isActive ? 'text-[#00E5FF]' : 'text-zinc-200'
                      }`}
                    >
                      {queueItem.title}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 block truncate mt-0.5">
                      #{qIdx + 1} • {queueItem.category || 'Clips'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
};

export default CyberVideoPlayer;
