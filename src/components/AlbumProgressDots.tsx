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
  isLightMode = false,
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
          }, 250);
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
        className="fixed right-0 top-0 bottom-0 w-16 z-34 pointer-events-auto"
        onMouseEnter={() => setIsOpen(true)}
        aria-hidden="true"
      />

      {/* Auto-Hiding Right-Side Navigation Dock */}
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
          }, 300);
        }}
        className={`fixed right-5 sm:right-7 top-1/2 -translate-y-1/2 z-35 flex flex-col items-center gap-2.5 p-2 rounded-full border backdrop-blur-xl select-none pointer-events-auto transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+40px)]'
        } ${
          isLightMode
            ? 'bg-white/85 border-black/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)]'
            : 'bg-black/50 border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.6)]'
        }`}
      >
        {albums.map((album, idx) => {
          const isActive = idx === activeAlbumIndex;
          const isComingSoon =
            album.itemCount === 0 || album.layoutType.startsWith('coming-soon');

          return (
            <button
              key={album.id}
              onClick={() => onSelectAlbum(idx)}
              className="group relative flex items-center justify-center p-1 cursor-pointer focus:outline-none"
              aria-label={`Go to Album ${idx + 1}: ${album.name}`}
            >
              {/* Tooltip on Hover (appears on the left side of dot) */}
              <div className="absolute right-7 px-2.5 py-1 rounded-lg bg-black/95 border border-white/15 text-[10px] font-mono tracking-wider text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-xl z-50">
                <span className="text-[#00D2FF] font-bold mr-1.5">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <span>{album.name}</span>
                {isComingSoon && <span className="text-white/40 ml-1.5">(SOON)</span>}
              </div>

              {/* Indicator Dot / Pill */}
              <div
                className={`rounded-full transition-all duration-300 ${
                  isActive
                    ? isLightMode
                      ? 'h-5 w-1.5 bg-[#0090C8] shadow-[0_0_10px_#0090C8]'
                      : 'h-5 w-1.5 bg-[#00D2FF] shadow-[0_0_10px_#00D2FF]'
                    : isLightMode
                    ? 'h-1.5 w-1.5 bg-black/25 group-hover:bg-black/70 group-hover:scale-125'
                    : 'h-1.5 w-1.5 bg-white/25 group-hover:bg-white/70 group-hover:scale-125'
                }`}
              />
            </button>
          );
        })}
      </nav>
    </>
  );
};
