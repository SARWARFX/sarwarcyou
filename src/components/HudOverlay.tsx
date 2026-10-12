import React, { useRef, useState, useEffect } from 'react';
import { Play, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StageMediaItem } from '../types';

interface HudOverlayProps {
  activeItem: StageMediaItem | undefined;
  activeIndex: number;
  totalBatchItems: number;
  currentPage: number;
  totalPages: number;
  totalFolderItems: number;
  onPrevItem: () => void;
  onNextItem: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenModal: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  activeItem,
  activeIndex,
  totalBatchItems,
  currentPage,
  totalPages,
  totalFolderItems,
  onPrevItem,
  onNextItem,
  onPrevPage,
  onNextPage,
  onOpenModal,
}) => {
  const [isAudioActive, setIsAudioActive] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  // Subtle ambient audio synthesizer
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
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = audioCtxRef.current || new AudioCtx();
        audioCtxRef.current = ctx;

        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, ctx.currentTime);
        gain.gain.setValueAtTime(0.035, ctx.currentTime);
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

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 sm:p-7 select-none overflow-hidden">
      {/* ================= 1. MINIMAL TOP BAR ================= */}
      <header className="relative w-full flex items-center justify-between px-2 sm:px-4">
        {/* Left: Minimal Ambient Sound Toggle */}
        <button
          onClick={toggleAudio}
          className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 hover:border-[#00D2FF]/50 hover:bg-black/60 transition-all text-white/70 hover:text-white backdrop-blur-md cursor-pointer group"
          title="Toggle Ambient Sound"
        >
          <span className="text-[10px] font-mono tracking-widest uppercase">
            {isAudioActive ? 'SOUND ON' : 'SOUND OFF'}
          </span>
          <div className="flex items-end gap-[2px] h-3 w-3.5">
            <span
              className={`w-[2px] bg-[#00D2FF] rounded-full transition-all ${
                isAudioActive ? 'animate-equalizer-1' : 'h-1 opacity-30'
              }`}
            />
            <span
              className={`w-[2px] bg-[#00D2FF] rounded-full transition-all ${
                isAudioActive ? 'animate-equalizer-2' : 'h-1.5 opacity-30'
              }`}
            />
            <span
              className={`w-[2px] bg-[#00D2FF] rounded-full transition-all ${
                isAudioActive ? 'animate-equalizer-3' : 'h-1 opacity-30'
              }`}
            />
          </div>
        </button>

        {/* Right: Sleek Open / View Pill Button */}
        <button
          onClick={onOpenModal}
          className="pointer-events-auto flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-space font-bold uppercase text-xs tracking-wider hover:bg-neutral-200 transition-all shadow-[0_0_25px_rgba(255,255,255,0.35)] hover:shadow-[0_0_35px_rgba(0,210,255,0.6)] hover:scale-105 active:scale-95 cursor-pointer"
        >
          {activeItem?.type === 'video' ? (
            <Play className="w-3.5 h-3.5 fill-black" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-black stroke-[2.5]" />
          )}
          <span>{activeItem?.type === 'video' ? 'PLAY' : 'EXPAND'}</span>
        </button>
      </header>

      {/* ================= 2. MINIMAL BOTTOM STAGE CONTROLS ================= */}
      <footer className="relative w-full flex flex-col items-center justify-end pb-2 sm:pb-3 px-4">
        {/* Arc Item Navigation & Batch Pagination */}
        <div className="flex flex-col items-center gap-3">
          {/* Item Navigation Chevrons + Center Dots */}
          <div className="flex items-center gap-4">
            {/* Prev Item */}
            <button
              onClick={onPrevItem}
              disabled={totalBatchItems <= 1}
              className="pointer-events-auto p-2 rounded-full bg-black/40 border border-white/10 hover:border-[#00D2FF]/50 text-white/60 hover:text-white transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none backdrop-blur-md cursor-pointer"
              title="Previous Photo"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Micro Indicator Dots for the 5-6 Items in current arc */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/45 border border-white/10 backdrop-blur-md">
              {Array.from({ length: totalBatchItems }).map((_, idx) => (
                <span
                  key={idx}
                  className={`transition-all duration-300 rounded-full ${
                    idx === activeIndex
                      ? 'w-4 h-1.5 bg-[#00D2FF] shadow-[0_0_8px_#00D2FF]'
                      : 'w-1.5 h-1.5 bg-white/30'
                  }`}
                />
              ))}
            </div>

            {/* Next Item */}
            <button
              onClick={onNextItem}
              disabled={totalBatchItems <= 1}
              className="pointer-events-auto p-2 rounded-full bg-black/40 border border-white/10 hover:border-[#00D2FF]/50 text-white/60 hover:text-white transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none backdrop-blur-md cursor-pointer"
              title="Next Photo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* If Folder Has More Than 6 Items: Clean Batch Pagination Controls */}
          {totalPages > 1 && (
            <div className="pointer-events-auto flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-lg text-[10px] font-mono tracking-widest text-white/60">
              <button
                onClick={onPrevPage}
                disabled={currentPage === 0}
                className="hover:text-[#00D2FF] transition-colors disabled:opacity-20 cursor-pointer"
                title="Previous Batch (6 items)"
              >
                ◀ BATCH
              </button>

              <span className="text-white/30">•</span>

              <span className="text-white/90 font-bold">
                BATCH {(currentPage + 1).toString().padStart(2, '0')} / {totalPages.toString().padStart(2, '0')}
              </span>

              <span className="text-white/30">
                ({totalFolderItems} ITEMS)
              </span>

              <span className="text-white/30">•</span>

              <button
                onClick={onNextPage}
                disabled={currentPage >= totalPages - 1}
                className="hover:text-[#00D2FF] transition-colors disabled:opacity-20 cursor-pointer"
                title="Next Batch (6 items)"
              >
                BATCH ▶
              </button>
            </div>
          )}

          {/* Minimalist Hint */}
          <div className="text-[9px] font-mono tracking-[0.25em] text-white/30 uppercase mt-0.5">
            DRAG TO EXPLORE • CLICK ACTIVE FRAME TO EXPAND
          </div>
        </div>
      </footer>
    </div>
  );
};
