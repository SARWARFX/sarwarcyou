import React, { useRef, useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import type { StageMediaItem } from './ThreeStage';

interface HudOverlayProps {
  activeItem: StageMediaItem | undefined;
  activeIndex: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
  onScrub: (index: number) => void;
  onPlay: () => void;
  onToggleMenu: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  activeItem,
  activeIndex,
  totalItems,
  onPrev,
  onNext,
  onScrub,
  onPlay,
  onToggleMenu,
}) => {
  const [isAudioActive, setIsAudioActive] = useState(true);
  const scrubberTrackRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Audio tone synthesizer toggle (Web Audio API subtle futuristic drone)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  const toggleAudio = () => {
    if (isAudioActive) {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      setIsAudioActive(false);
    } else {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = audioCtxRef.current || new AudioCtx();
        audioCtxRef.current = ctx;

        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, ctx.currentTime); // Deep 55Hz sub-bass ambient hum
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        oscRef.current = osc;
        setIsAudioActive(true);
      } catch {
        setIsAudioActive(true);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
      }
    };
  }, []);

  // Handle Scrubber scrubbing
  const handleScrubPointer = (clientX: number) => {
    if (!scrubberTrackRef.current || totalItems <= 1) return;
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetIndex = Math.round(ratio * (totalItems - 1));
    onScrub(targetIndex);
  };

  const onScrubberDown = (e: React.PointerEvent) => {
    setIsScrubbing(true);
    handleScrubPointer(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onScrubberMove = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    handleScrubPointer(e.clientX);
  };

  const onScrubberUp = (e: React.PointerEvent) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
  };

  const scrubberProgress = totalItems > 1 ? (activeIndex / (totalItems - 1)) * 100 : 0;

  // Format clean title without extension
  const displayTitle = activeItem?.title ? activeItem.title.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ') : 'NO MEDIA ACTIVE';

  return (
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 sm:p-7 select-none overflow-hidden">
      {/* ================= 1. FOUR VIEWFINDER CORNER FRAMING BRACKETS ================= */}
      {/* Top-Left Bracket */}
      <div className="absolute top-5 left-5 flex items-start gap-2.5 text-white/50 font-mono text-xs">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/60">
          <path d="M1 23V1H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="leading-tight">
          <div className="text-[10px] text-cyan-400 font-bold tracking-wider">SYS: 3D_STAGE // LAT: 0.00</div>
          <div className="text-[9px] text-white/40 tracking-widest">WEBGL_ORBITAL_RING</div>
        </div>
      </div>

      {/* Top-Right Bracket */}
      <div className="absolute top-5 right-5 flex items-start gap-2.5 text-white/50 font-mono text-xs flex-row-reverse">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/60">
          <path d="M23 23V1H1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="leading-tight text-right">
          <div className="text-[10px] text-pink-500 font-bold tracking-wider flex items-center justify-end gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
            REC // LIVE 4K
          </div>
          <div className="text-[9px] text-white/40 tracking-widest">STAGE_PBR_CAN</div>
        </div>
      </div>

      {/* Bottom-Left Bracket */}
      <div className="absolute bottom-5 left-5 flex items-end gap-2.5 text-white/50 font-mono text-xs">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/60">
          <path d="M1 1V23H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="leading-tight">
          <div className="text-[10px] text-cyan-400 font-bold tracking-wider">
            ITEM {(activeIndex + 1).toString().padStart(2, '0')} / {totalItems.toString().padStart(2, '0')}
          </div>
          <div className="text-[9px] text-white/40 tracking-widest">
            {activeItem?.category ? activeItem.category.toUpperCase() : 'VAULT'}
          </div>
        </div>
      </div>

      {/* Bottom-Right Bracket */}
      <div className="absolute bottom-5 right-5 flex items-end gap-2.5 text-white/50 font-mono text-xs flex-row-reverse">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/60">
          <path d="M23 1V23H1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="leading-tight text-right">
          <div className="text-[10px] text-white/70 font-bold tracking-wider">SARWAR.CYOU</div>
          <div className="text-[9px] text-white/40 tracking-widest">3D MEDIA ENGINE</div>
        </div>
      </div>

      {/* ================= 2. TOP HUD ================= */}
      <header className="relative w-full flex items-center justify-between pt-2 px-6 sm:px-10 z-20">
        {/* Left: Audio Wave Animation ("ON ||| LIVE DRIVER") */}
        <div
          onClick={toggleAudio}
          className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group"
          title="Toggle Ambient Audio"
        >
          <span className="text-[11px] font-bold tracking-widest text-white/80 group-hover:text-white">
            {isAudioActive ? 'ON' : 'OFF'}
          </span>
          {/* Animated 4 Equalizer Bars */}
          <div className="flex items-end gap-[3px] h-3.5 w-4">
            <span
              className={`w-[2.5px] bg-cyan-400 rounded-full transition-all ${
                isAudioActive ? 'animate-equalizer-1' : 'h-1 opacity-40'
              }`}
            />
            <span
              className={`w-[2.5px] bg-cyan-400 rounded-full transition-all ${
                isAudioActive ? 'animate-equalizer-2' : 'h-1 opacity-40'
              }`}
            />
            <span
              className={`w-[2.5px] bg-cyan-400 rounded-full transition-all ${
                isAudioActive ? 'animate-equalizer-3' : 'h-1 opacity-40'
              }`}
            />
            <span
              className={`w-[2.5px] bg-cyan-400 rounded-full transition-all ${
                isAudioActive ? 'animate-equalizer-4' : 'h-1 opacity-40'
              }`}
            />
          </div>
          <span className="text-[10px] font-mono tracking-widest text-white/40 hidden sm:inline">
            LIVE DRIVER
          </span>
        </div>

        {/* Center: Brand Title */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="text-xs sm:text-sm font-black tracking-[0.25em] uppercase text-white/90 drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
              SARWARCYOU 3D MEDIA STAGE
            </span>
          </div>
        </div>

        {/* Right: Menu + PLAY Pill Button */}
        <div className="pointer-events-auto flex items-center gap-3">
          {/* ":: MENU" Button */}
          <button
            onClick={onToggleMenu}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 hover:border-white/20 transition-all text-white text-xs font-bold tracking-widest uppercase cursor-pointer"
          >
            {/* 4-dot menu icon */}
            <svg width="10" height="10" viewBox="0 0 8 8" className="text-white fill-current">
              <circle cx="1.5" cy="1.5" r="1.2" />
              <circle cx="6.5" cy="1.5" r="1.2" />
              <circle cx="1.5" cy="6.5" r="1.2" />
              <circle cx="6.5" cy="6.5" r="1.2" />
            </svg>
            <span>MENU</span>
          </button>

          {/* White Rounded "PLAY" Pill Button */}
          <button
            onClick={onPlay}
            className="flex items-center gap-2 bg-white text-black font-black uppercase text-xs tracking-wider px-5 sm:px-6 py-2 sm:py-2.5 rounded-full hover:bg-neutral-200 transition-all shadow-[0_0_25px_rgba(255,255,255,0.45)] hover:shadow-[0_0_35px_rgba(255,255,255,0.65)] hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>PLAY</span>
          </button>
        </div>
      </header>

      {/* ================= 3. BOTTOM STAGE HUD ================= */}
      <footer className="relative w-full flex flex-col items-center justify-end pb-4 sm:pb-8 px-4 z-20">
        {/* Category Pill Tag */}
        <div className="mb-2">
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase bg-cyan-950/40 border border-cyan-500/30 px-3.5 py-1 rounded-full backdrop-blur-md shadow-[0_0_15px_rgba(0,210,255,0.2)]">
            [ {activeItem?.category ? activeItem.category.toUpperCase() : 'COLLECTION'} // {(activeIndex + 1).toString().padStart(2, '0')} ]
          </span>
        </div>

        {/* Dynamic Bold Italicized Title with Left/Right Dotted Chevrons */}
        <div className="w-full max-w-4xl flex items-center justify-between gap-3 sm:gap-6 my-2">
          {/* Left Dotted Chevron (❮) */}
          <button
            onClick={onPrev}
            className="pointer-events-auto p-2 sm:p-3 rounded-full hover:bg-white/10 transition-transform active:scale-90 text-white/60 hover:text-white cursor-pointer group"
            title="Previous Item"
          >
            <svg width="24" height="32" viewBox="0 0 17 32" fill="none" className="w-5 h-7 sm:w-6 sm:h-8">
              <circle cx="2.5" cy="16" r="2.2" fill="currentColor" />
              <circle cx="8.5" cy="9.5" r="2.2" fill="currentColor" fillOpacity="0.6" />
              <circle cx="8.5" cy="22.5" r="2.2" fill="currentColor" fillOpacity="0.6" />
              <circle cx="14.5" cy="3" r="2.2" fill="currentColor" fillOpacity="0.3" />
              <circle cx="14.5" cy="29" r="2.2" fill="currentColor" fillOpacity="0.3" />
            </svg>
          </button>

          {/* Active Item Title in Dynamic Typography */}
          <div className="flex-1 text-center overflow-hidden">
            <h1 className="text-2xl sm:text-4xl md:text-6xl font-black italic tracking-tighter uppercase text-white truncate drop-shadow-[0_0_25px_rgba(255,255,255,0.35)] transition-all">
              {displayTitle}
            </h1>
          </div>

          {/* Right Dotted Chevron (❯) */}
          <button
            onClick={onNext}
            className="pointer-events-auto p-2 sm:p-3 rounded-full hover:bg-white/10 transition-transform active:scale-90 text-white/60 hover:text-white cursor-pointer group"
            title="Next Item"
          >
            <svg width="24" height="32" viewBox="0 0 17 32" fill="none" className="w-5 h-7 sm:w-6 sm:h-8">
              <circle cx="14.5" cy="16" r="2.2" fill="currentColor" />
              <circle cx="8.5" cy="9.5" r="2.2" fill="currentColor" fillOpacity="0.6" />
              <circle cx="8.5" cy="22.5" r="2.2" fill="currentColor" fillOpacity="0.6" />
              <circle cx="2.5" cy="3" r="2.2" fill="currentColor" fillOpacity="0.3" />
              <circle cx="2.5" cy="29" r="2.2" fill="currentColor" fillOpacity="0.3" />
            </svg>
          </button>
        </div>

        {/* Signature Multi-Color Gradient Drag Scrubber Track */}
        <div className="pointer-events-auto w-full max-w-sm sm:max-w-md md:max-w-lg mt-3 px-4">
          <div
            ref={scrubberTrackRef}
            onPointerDown={onScrubberDown}
            onPointerMove={onScrubberMove}
            onPointerUp={onScrubberUp}
            className="relative h-2 w-full rounded-full cursor-pointer py-3 group"
          >
            {/* Background Multi-Color Gradient Track */}
            <div
              className="w-full h-1.5 rounded-full overflow-hidden shadow-[0_0_15px_rgba(255,100,200,0.3)]"
              style={{
                background: 'linear-gradient(90deg, #00A6E2 0%, #71BD96 25%, #EEB169 50%, #E59DE6 75%, #FF659D 100%)',
              }}
            />

            {/* Glowing Interactive Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff,0_0_24px_#00A6E2] pointer-events-none transition-transform group-hover:scale-125"
              style={{
                left: `calc(${scrubberProgress}% - 8px)`,
              }}
            />
          </div>
        </div>

        {/* Interactive Helper Text */}
        <div className="mt-2 text-[10px] font-mono tracking-widest text-white/35 uppercase">
          DRAG TO ROTATE • SCROLL TO CYCLE • CLICK ACTIVE OR PLAY TO STREAM
        </div>
      </footer>
    </div>
  );
};
