import React from 'react';

export interface HoverScrubberProps {
  currentIndex: number;
  totalSegments?: number;
}

export const HoverScrubber: React.FC<HoverScrubberProps> = ({
  currentIndex,
  totalSegments = 5,
}) => {
  return (
    <div className="absolute top-0 inset-x-0 z-30 p-1.5 flex items-center gap-1 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none transition-opacity duration-200">
      {Array.from({ length: totalSegments }).map((_, idx) => (
        <div
          key={idx}
          className={`flex-1 h-0.5 sm:h-1 rounded-full transition-all duration-150 ${
            idx === currentIndex
              ? 'bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]'
              : 'bg-white/25'
          }`}
        />
      ))}
    </div>
  );
};
