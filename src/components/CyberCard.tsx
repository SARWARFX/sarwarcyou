import React, { useState } from 'react';
import { Play, Camera, Film } from 'lucide-react';
import type { StageMediaItem } from '../types';

export interface CyberCardProps {
  item: StageMediaItem;
  variant?: 'standard' | 'shorts' | 'photo';
  onClick: (item: StageMediaItem) => void;
}

export const CyberCard: React.FC<CyberCardProps> = ({
  item,
  variant = 'standard',
  onClick,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isShort =
    variant === 'shorts' ||
    Boolean(
      item.category?.toLowerCase().includes('short') ||
      item.category?.toLowerCase().includes('reel') ||
      item.url?.toLowerCase().includes('/shorts/') ||
      item.id?.toLowerCase().includes('shorts')
    );

  const isVideo = isShort || item.type === 'video' || /\.(mp4|mov|webm|mkv)$/i.test(item.url);

  // Aspect Ratio & Sizing
  const sizeClass = {
    standard: 'w-[260px] sm:w-[290px] md:w-[320px] aspect-[16/10]',
    shorts: 'w-[160px] sm:w-[190px] md:w-[215px] aspect-[9/16]',
    photo: 'w-[240px] sm:w-[270px] md:w-[300px] aspect-[4/3]',
  }[variant];

  const thumbUrl = item.thumbnail || item.poster || item.url;

  return (
    <div
      onClick={() => onClick(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(item);
        }
      }}
      className={`group relative flex-shrink-0 cursor-pointer select-none rounded-[14px] overflow-hidden bg-[#08080c] transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-[0_10px_30px_rgba(0,229,255,0.12)] hover:z-10 ${sizeClass}`}
    >
      {/* Background Poster / Fallback */}
      <div className="absolute inset-0 bg-[#08080c] flex flex-col justify-between p-3.5 z-0">
        <div className="flex items-center justify-between">
          <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
            {isShort ? (
              <Film className="w-3 h-3 text-fuchsia-400" />
            ) : isVideo ? (
              <Play className="w-3 h-3 text-amber-400 ml-0.5 fill-current" />
            ) : (
              <Camera className="w-3 h-3 text-cyan-400" />
            )}
          </div>
          <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase">
            SARWARCYOU
          </span>
        </div>
        <span className="text-xs font-medium text-zinc-400 truncate">{item.title}</span>
      </div>

      {/* Image Layer */}
      {!imageError && thumbUrl && (
        <img
          src={thumbUrl}
          alt={item.title}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-105 z-10 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Category Corner Badge */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
        {isShort ? (
          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-fuchsia-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-fuchsia-500/30 flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
            SHORTS
          </span>
        ) : isVideo ? (
          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-amber-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-amber-500/30 flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            CLIPS
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-cyan-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-cyan-500/30 flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            PHOTO
          </span>
        )}
      </div>

      {/* Play Icon Centered on Hover for Videos */}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 backdrop-blur-[1px] pointer-events-none z-20">
          <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,229,255,0.3)]">
            <Play className="w-4 h-4 fill-current ml-0.5 text-cyan-300" />
          </div>
        </div>
      )}

      {/* Bottom Gradient Metadata Bar */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/45 to-transparent z-20 pointer-events-none flex flex-col justify-end">
        <span className="text-xs sm:text-sm font-semibold text-zinc-100 truncate block leading-tight">
          {item.title}
        </span>
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mt-0.5 truncate">
          {item.category || (isShort ? 'Short Reel' : isVideo ? 'Cinema' : 'Photography')}
        </span>
      </div>

      {/* Ambient Gloss Highlight on Hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/[0.03] to-white/[0.08] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-25" />
    </div>
  );
};

export default CyberCard;
