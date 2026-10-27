import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Tv,
  Settings,
} from 'lucide-react';

export interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number; // 0 to 1 percentage
  volume: number; // 0 to 1
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  isPiPAvailable: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onTogglePiP: () => void;
  onToggleFullscreen: () => void;
  onSkip: (seconds: number) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  buffered,
  volume,
  isMuted,
  playbackRate,
  isFullscreen,
  isPiPAvailable,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onTogglePiP,
  onToggleFullscreen,
  onSkip,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = Math.min(100, Math.max(0, buffered * 100));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pos * duration);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPos(pos * 100);
    setHoverSeekTime(pos * duration);
  };

  const handlePointerLeave = () => {
    setHoverSeekTime(null);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 sm:p-6 transition-opacity duration-300">
      {/* Scrubber Progress Bar */}
      <div
        ref={progressBarRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="group relative h-2 hover:h-3 w-full bg-white/20 rounded-full cursor-pointer transition-all mb-4 select-none"
      >
        {/* Buffered Range */}
        <div
          className="absolute inset-y-0 left-0 bg-white/30 rounded-full transition-all duration-150"
          style={{ width: `${bufferedPercent}%` }}
        />

        {/* Played Progress */}
        <div
          className="absolute inset-y-0 left-0 bg-[#00E5FF] rounded-full shadow-[0_0_12px_rgba(0,229,255,0.7)]"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Hover Thumb Tooltip */}
        {hoverSeekTime !== null && (
          <div
            className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-white/20 text-[11px] font-mono text-white pointer-events-none"
            style={{ left: `${hoverPos}%` }}
          >
            {formatTime(hoverSeekTime)}
          </div>
        )}

        {/* Scrub Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2 border-[#00E5FF] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* Control Buttons Row */}
      <div className="flex items-center justify-between text-white gap-2 sm:gap-4 select-none">
        {/* Left Side: Playback, Skips, Volume, Timestamps */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={onPlayPause}
            className="p-2 sm:p-2.5 rounded-full hover:bg-white/15 text-white active:scale-95 transition cursor-pointer"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current text-[#00E5FF]" />
            ) : (
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current text-[#00E5FF]" />
            )}
          </button>

          {/* Skip Back 5s */}
          <button
            type="button"
            onClick={() => onSkip(-5)}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer hidden xs:flex items-center"
            title="Rewind 5s (Left Arrow)"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Skip Forward 5s */}
          <button
            type="button"
            onClick={() => onSkip(5)}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer hidden xs:flex items-center"
            title="Fast Forward 5s (Right Arrow)"
          >
            <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-1.5 group/vol">
            <button
              type="button"
              onClick={onToggleMute}
              className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5 text-red-400" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-16 sm:w-20 accent-[#00E5FF] h-1.5 bg-white/20 rounded-full cursor-pointer transition-all"
            />
          </div>

          {/* Time Counter */}
          <div className="text-xs sm:text-sm font-mono text-zinc-300 ml-1">
            <span className="text-white font-medium">{formatTime(currentTime)}</span>
            <span className="mx-1 text-zinc-600">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Side: Speed, PiP, Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Speed Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-mono font-semibold flex items-center gap-1 cursor-pointer transition"
              title="Playback Speed"
            >
              <Settings className="w-4 h-4" />
              <span>{playbackRate}x</span>
            </button>

            {showSettings && (
              <div className="absolute right-0 bottom-full mb-2 w-32 bg-[#0d0e14] border border-white/20 rounded-xl p-1.5 shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-1">
                <div className="text-[10px] uppercase font-mono text-zinc-400 px-2 py-1 font-bold">
                  Speed
                </div>
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      onPlaybackRateChange(rate);
                      setShowSettings(false);
                    }}
                    className={`px-2 py-1 text-xs font-mono text-left rounded-lg transition cursor-pointer flex items-center justify-between ${
                      playbackRate === rate
                        ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-bold'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{rate}x</span>
                    {playbackRate === rate && <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Picture in Picture */}
          {isPiPAvailable && (
            <button
              type="button"
              onClick={onTogglePiP}
              className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer hidden sm:block"
              title="Picture-in-Picture"
            >
              <Tv className="w-5 h-5" />
            </button>
          )}

          {/* Fullscreen */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-[#00E5FF]" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
