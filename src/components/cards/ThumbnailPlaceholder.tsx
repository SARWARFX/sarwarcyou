import React from 'react';
import { Film, Camera, Play } from 'lucide-react';
import type { MediaVariant } from '../../models/media';

export interface ThumbnailPlaceholderProps {
  variant?: MediaVariant;
  title?: string;
  className?: string;
}

export const ThumbnailPlaceholder: React.FC<ThumbnailPlaceholderProps> = ({
  variant = 'standard',
  title,
  className = '',
}) => {
  const isShort = variant === 'short';
  const isPhoto = variant === 'photo';

  return (
    <div
      className={`relative w-full h-full bg-gradient-to-br from-[#0c0d14] via-[#10121a] to-[#07080c] border border-white/10 flex flex-col justify-between p-3.5 select-none ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between z-10">
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center border border-white/15">
          {isShort ? (
            <Film className="w-3.5 h-3.5 text-fuchsia-400" />
          ) : isPhoto ? (
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
          ) : (
            <Play className="w-3.5 h-3.5 text-amber-400 ml-0.5 fill-current" />
          )}
        </div>
        <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase">
          SARWARCYOU
        </span>
      </div>

      {/* Center Icon Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        {isShort ? (
          <Film className="w-20 h-20 text-fuchsia-400" />
        ) : isPhoto ? (
          <Camera className="w-20 h-20 text-cyan-400" />
        ) : (
          <Play className="w-20 h-20 text-amber-400 fill-current" />
        )}
      </div>

      {/* Bottom Title */}
      {title && (
        <div className="z-10">
          <p className="text-xs font-semibold text-zinc-300 truncate drop-shadow">
            {title}
          </p>
        </div>
      )}
    </div>
  );
};
