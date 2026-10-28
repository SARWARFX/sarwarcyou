import React, { useRef, useState, useEffect } from 'react';
import { Camera, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import type { MediaFolderEntry, StageMediaItem } from '../types';
import { getMediaUrl } from '../utils/imageUrlResolver';

export interface PhotoShowcaseRowProps {
  photoAlbums: MediaFolderEntry[];
  onSelectAlbum: (album: MediaFolderEntry) => void;
  onSelectPhoto?: (item: StageMediaItem, playlist: StageMediaItem[], albumName: string) => void;
  className?: string;
}

const PhotoAlbumCard: React.FC<{
  album: MediaFolderEntry;
  onSelect: (album: MediaFolderEntry) => void;
}> = ({ album, onSelect }) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  const coverItem = album.items?.[0];
  const coverUrlRaw =
    album.coverUrl ||
    coverItem?.thumbnails?.[0] ||
    coverItem?.thumbnail ||
    coverItem?.url ||
    coverItem?.path;

  const coverUrl = coverUrlRaw ? getMediaUrl(coverUrlRaw) : null;
  const count = album.items?.length || album.count || 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(album)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(album);
        }
      }}
      aria-label={`Open photo collection: ${album.name}`}
      className="group relative flex-shrink-0 w-[200px] sm:w-[240px] md:w-[270px] aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer select-none bg-zinc-950 border border-white/10 hover:border-emerald-400/60 shadow-lg hover:shadow-[0_0_25px_rgba(52,211,153,0.25)] transition-all duration-300 transform hover:-translate-y-1.5 snap-start text-left"
    >
      {/* Cover Image */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={album.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover object-center transition-all duration-500 group-hover:scale-108 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-neutral-900 to-black flex items-center justify-center">
          <Camera className="w-10 h-10 text-white/20" />
        </div>
      )}

      {/* Top Image Count Badge */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-emerald-300 text-[11px] font-mono font-medium border border-emerald-400/30 shadow">
          <Images className="w-3 h-3 text-emerald-400" />
          <span>{count} Photos</span>
        </span>
      </div>

      {/* Bottom Translucent Title Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/60 to-transparent z-10 flex flex-col justify-end p-3 sm:p-4 pointer-events-none">
        <h3 className="text-white font-bold text-sm sm:text-base line-clamp-1 group-hover:text-emerald-300 transition-colors drop-shadow">
          {album.name}
        </h3>
        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
          Curated Photo Gallery
        </p>
      </div>
    </div>
  );
};

export const PhotoShowcaseRow: React.FC<PhotoShowcaseRowProps> = ({
  photoAlbums,
  onSelectAlbum,
  className = '',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [photoAlbums]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!photoAlbums || photoAlbums.length === 0) return null;

  return (
    <section className={`w-full flex flex-col gap-3 select-none ${className}`}>
      {/* Header with Title and Scroll Controls */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Photo Vault</span>
              <span className="text-xs font-mono text-zinc-500 font-normal">({photoAlbums.length} Collections)</span>
            </h2>
          </div>
        </div>

        {/* Desktop Left / Right Scroll Chevrons */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className={`p-2 rounded-full border border-white/10 transition-all ${
              canScrollLeft
                ? 'bg-white/5 hover:bg-white/15 text-white cursor-pointer active:scale-95'
                : 'bg-white/[0.02] text-zinc-600 border-white/5 cursor-not-allowed opacity-40'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className={`p-2 rounded-full border border-white/10 transition-all ${
              canScrollRight
                ? 'bg-white/5 hover:bg-white/15 text-white cursor-pointer active:scale-95'
                : 'bg-white/[0.02] text-zinc-600 border-white/5 cursor-not-allowed opacity-40'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Scroll Shelf */}
      <div
        ref={trackRef}
        onScroll={checkScroll}
        className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar scrollbar-none py-2 px-1 snap-x snap-mandatory"
      >
        {photoAlbums.map((album) => (
          <PhotoAlbumCard
            key={album.id || album.name}
            album={album}
            onSelect={onSelectAlbum}
          />
        ))}
      </div>
    </section>
  );
};

export default PhotoShowcaseRow;
