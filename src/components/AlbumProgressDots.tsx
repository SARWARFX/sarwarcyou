import React, { useState, useEffect, useRef } from 'react';
import type { AlbumData } from '../types';

interface AlbumProgressDotsProps {
  albums: AlbumData[];
  activeAlbumIndex: number;
  onSelectAlbum: (index: number) => void;
  isLightMode?: boolean;
}

export const AlbumProgressDots: React.FC<AlbumProgressDotsProps> = ({
  albums,
  activeAlbumIndex,
  onSelectAlbum,
  isLightMode: _isLightMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dockRef = useRef<HTMLElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  // Monitor cursor position near right viewport edge (within ~75px)
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const triggerThreshold = window.innerWidth - 75;
      if (e.clientX >= triggerThreshold) {
        if (hideTimeoutRef.current) {
          window.clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        setIsOpen(true);
      } else {
        // If dock itself is not hovered, close smoothly after a tiny delay
        const dockRect = dockRef.current?.getBoundingClientRect();
        const isOverDock =
          dockRect &&
          e.clientX >= dockRect.left - 20 &&
          e.clientX <= dockRect.right + 20 &&
          e.clientY >= dockRect.top - 20 &&
          e.clientY <= dockRect.bottom + 20;

        if (!isOverDock && !hideTimeoutRef.current) {
          hideTimeoutRef.current = window.setTimeout(() => {
            setIsOpen(false);
            hideTimeoutRef.current = null;
          }, 350);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Invisible edge trigger strip for instant mouse responsiveness */}
      <div
        className="fixed right-0 top-0 bottom-0 w-16 z-30 pointer-events-auto"
        onMouseEnter={() => setIsOpen(true)}
        aria-hidden="true"
      />

      {/* Right-Side Navigation Dock */}
      <nav
        ref={dockRef}
        aria-label="12 Album Progress"
        onMouseEnter={() => {
          if (hideTimeoutRef.current) {
            window.clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
          }
          setIsOpen(true);
        }}
        onMouseLeave={() => {
          hideTimeoutRef.current = window.setTimeout(() => {
            setIsOpen(false);
            hideTimeoutRef.current = null;
          }, 350);
        }}
        className={`fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-35 flex flex-col items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-full border backdrop-blur-2xl select-none pointer-events-auto transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+25px)] sm:translate-x-[calc(100%+35px)] opacity-60'
        } bg-black/60 border-white/[0.08] shadow-2xl`}
      >
        {albums.map((album, idx) => {
          const isActive = idx === activeAlbumIndex;
          const count = album.itemCount || album.items.length;

          return (
            <button
              key={album.id}
              onClick={() => onSelectAlbum(idx)}
              className="group relative flex items-center justify-center p-1 cursor-pointer focus:outline-none"
              aria-label={`Go to Album ${idx + 1}: ${album.name}`}
            >
              {/* Frosted Tooltip: Album Title • Count items */}
              <div className="absolute right-7 px-3 py-1.5 rounded-lg bg-black/90 backdrop-blur-xl border border-white/10 text-[10px] font-mono tracking-wider text-zinc-200 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-2xl z-50 flex items-center gap-1.5">
                <span className="text-zinc-500 font-semibold">{(idx + 1).toString().padStart(2, '0')}</span>
                <span className="font-semibold text-zinc-100">{album.name}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 font-medium">{count} items</span>
              </div>

              {/* Dynamic Dot */}
              <div
                className={`rounded-full transition-all duration-300 ${
                  isActive
                    ? 'h-4 w-1.5 bg-zinc-200 shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                    : 'h-1.5 w-1.5 bg-zinc-700 group-hover:bg-zinc-400'
                }`}
              />
            </button>
          );
        })}
      </nav>
    </>
  );
};
