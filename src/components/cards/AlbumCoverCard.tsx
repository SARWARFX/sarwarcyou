import React from 'react';
import { Folder, Film, Camera, ArrowRight } from 'lucide-react';
import type { Album } from '../../models/media';
import { ThumbnailPlaceholder } from './ThumbnailPlaceholder';

export interface AlbumCoverCardProps {
  album: Album;
  onClick: (album: Album) => void;
}

export const AlbumCoverCard: React.FC<AlbumCoverCardProps> = ({ album, onClick }) => {
  return (
    <div
      onClick={() => onClick(album)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(album);
        }
      }}
      className="group relative rounded-2xl overflow-hidden bg-[#0d0e14] border border-white/10 hover:border-[#00E5FF]/60 transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(0,229,255,0.15)] cursor-pointer select-none flex flex-col aspect-[4/3] sm:aspect-video"
    >
      {/* Background Cover Image / Fallback */}
      <div className="absolute inset-0 z-0">
        <ThumbnailPlaceholder variant={album.variant} title={album.title} />
        {album.coverThumbnailUrl && (
          <img
            src={album.coverThumbnailUrl}
            alt={album.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20" />
      </div>

      {/* Top Header: Folder Badge & Count */}
      <div className="relative z-10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-mono font-bold uppercase text-[#00E5FF]">
          <Folder className="w-3.5 h-3.5" />
          <span>ALBUM</span>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-mono font-semibold text-zinc-300">
          {album.itemCount} {album.itemCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Bottom Content: Title & Action */}
      <div className="relative z-10 mt-auto p-4 flex flex-col justify-end">
        <h3 className="text-base sm:text-lg font-bold font-sans text-white uppercase tracking-wide group-hover:text-[#00E5FF] transition-colors truncate">
          {album.title}
        </h3>

        {/* Media Counts Breakdown */}
        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-zinc-400">
          {album.typeCounts.clips > 0 && (
            <span className="flex items-center gap-1 text-amber-300">
              <Film className="w-3 h-3" />
              {album.typeCounts.clips} clips
            </span>
          )}
          {album.typeCounts.shorts > 0 && (
            <span className="flex items-center gap-1 text-fuchsia-300">
              <Film className="w-3 h-3" />
              {album.typeCounts.shorts} shorts
            </span>
          )}
          {album.typeCounts.photos > 0 && (
            <span className="flex items-center gap-1 text-cyan-300">
              <Camera className="w-3 h-3" />
              {album.typeCounts.photos} photos
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs font-mono font-bold text-[#00E5FF] mt-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-1 group-hover:translate-y-0">
          <span>Explore Album</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
