import React, { useState, useEffect } from 'react';
import { Film, Play, Layers } from 'lucide-react';
import type { MediaFolderEntry } from '../types';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { getCachedVideoThumbnail, generateVideoThumbnail } from '../utils/videoThumbnailGenerator';

export interface VideoAlbumShowcaseProps {
  videoAlbums: MediaFolderEntry[];
  onSelectAlbum: (album: MediaFolderEntry) => void;
  className?: string;
}

const VideoAlbumCard: React.FC<{
  album: MediaFolderEntry;
  onSelect: (album: MediaFolderEntry) => void;
}> = ({ album, onSelect }) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  const coverItem = album.items?.[0];
  const cleanMediaUrl = coverItem ? getMediaUrl(coverItem.url || coverItem.path || coverItem.id) : '';

  const staticPoster =
    album.coverUrl ||
    coverItem?.thumbnails?.[0] ||
    coverItem?.posterUrl ||
    coverItem?.poster ||
    coverItem?.thumbnail;

  const posterSrc = staticPoster && !isVideoExtension(staticPoster) ? getMediaUrl(staticPoster) : null;

  const [videoThumb, setVideoThumb] = useState<string | null>(() => {
    return !posterSrc && cleanMediaUrl ? getCachedVideoThumbnail(cleanMediaUrl) : null;
  });

  useEffect(() => {
    if (posterSrc || !cleanMediaUrl) return;

    const cached = getCachedVideoThumbnail(cleanMediaUrl);
    if (cached) {
      setVideoThumb(cached);
      return;
    }

    let isSubscribed = true;
    generateVideoThumbnail(cleanMediaUrl, '16/9').then((dataUrl) => {
      if (isSubscribed && dataUrl) {
        setVideoThumb(dataUrl);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [posterSrc, cleanMediaUrl]);

  const displayImage = posterSrc || videoThumb;
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
      aria-label={`Open video album: ${album.name}`}
      className="group relative w-full aspect-video rounded-2xl overflow-hidden cursor-pointer select-none bg-zinc-950 border border-white/10 hover:border-[#00E5FF]/60 shadow-lg hover:shadow-[0_0_25px_rgba(0,229,255,0.25)] transition-all duration-300 transform hover:-translate-y-1 text-left"
    >
      {/* Cover Thumbnail Image */}
      {displayImage ? (
        <img
          src={displayImage}
          alt={album.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover object-center transition-all duration-500 group-hover:scale-105 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-neutral-900 to-black flex items-center justify-center">
          <Film className="w-10 h-10 text-white/20" />
        </div>
      )}

      {/* Top Video Count Badge */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md text-[#00E5FF] text-[11px] font-mono font-semibold border border-[#00E5FF]/30 shadow">
          <Film className="w-3 h-3 text-[#00E5FF]" />
          <span>{count} Videos</span>
        </span>
      </div>

      {/* Center Play Icon on Hover */}
      <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-[#00E5FF]/90 text-black flex items-center justify-center shadow-[0_0_20px_rgba(0,229,255,0.8)] transform scale-90 group-hover:scale-100 transition-transform">
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>

      {/* Bottom Translucent Title Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/60 to-transparent z-10 flex flex-col justify-end p-3 sm:p-4 pointer-events-none">
        <h3 className="text-white font-bold text-sm sm:text-base line-clamp-1 group-hover:text-[#00E5FF] transition-colors drop-shadow">
          {album.name}
        </h3>
        <p className="text-[11px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-zinc-500" />
          <span>Video Album • Tap to Explore</span>
        </p>
      </div>
    </div>
  );
};

export const VideoAlbumShowcase: React.FC<VideoAlbumShowcaseProps> = ({
  videoAlbums,
  onSelectAlbum,
  className = '',
}) => {
  if (!videoAlbums || videoAlbums.length === 0) return null;

  return (
    <section className={`w-full flex flex-col gap-4 select-none ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF]">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Video Albums</span>
              <span className="text-xs font-mono text-zinc-500 font-normal">
                ({videoAlbums.length} Collections)
              </span>
            </h2>
          </div>
        </div>
      </div>

      {/* Responsive Grid of Video Album Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
        {videoAlbums.map((album) => (
          <VideoAlbumCard
            key={album.id || album.name}
            album={album}
            onSelect={onSelectAlbum}
          />
        ))}
      </div>
    </section>
  );
};

export default VideoAlbumShowcase;
