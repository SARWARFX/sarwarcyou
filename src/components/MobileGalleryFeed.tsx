import React from 'react';
import { Play, Camera, Film, Sparkles } from 'lucide-react';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { getDirectImageUrl } from '../utils/imageUrlResolver';
import { resolveMultiFrameThumbnails } from '../utils/thumbnailResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface MobileGalleryFeedProps {
  albums: AlbumData[];
  onSelectItem: (item: StageMediaItem, albumIdx: number, posterUrl?: string) => void;
  recentItems?: StageMediaItem[];
  onClearHistory?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

interface MobileCardProps {
  item: StageMediaItem;
  album: AlbumData;
  idx: number;
  onSelectItem: (item: StageMediaItem, albumIdx: number) => void;
}

const MobileCard: React.FC<MobileCardProps> = ({ item, album, idx, onSelectItem }) => {
  const isShort = Boolean(
    album.name.toLowerCase().includes('short') ||
    album.name.toLowerCase().includes('reel') ||
    album.layoutType === 'vertical-waterfall' ||
    item.category?.toLowerCase().includes('short') ||
    item.category?.toLowerCase().includes('reel') ||
    item.url?.toLowerCase().includes('/shorts/') ||
    item.id?.toLowerCase().includes('shorts/')
  );

  const isVideo = isShort || isVideoExtension(item.url || item.id || item.title) || item.type === 'video';

  const companionFrames = resolveMultiFrameThumbnails(item);
  const thumbnailUrl = companionFrames.length > 0 ? companionFrames[0] : getDirectImageUrl(item, idx);

  const rawTitle = item.title || '';
  const cleanTitle =
    rawTitle
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b(smartselect|videocapture|screenshot)\b/gi, '')
      .trim() || (isShort ? 'Short Reel' : isVideo ? 'Cinema Clip' : 'Photograph');

  return (
    <div
      onClick={() => onSelectItem(item, album.index)}
      className="group flex flex-col cursor-pointer active:scale-[0.98] transition-transform select-none"
    >
      {/* 16:9 Aspect Video Thumbnail Container */}
      <div className="relative w-full aspect-video rounded-md overflow-hidden bg-zinc-900 border border-white/[0.06]">
        <img
          src={thumbnailUrl}
          alt={cleanTitle}
          loading="lazy"
          className="w-full h-full object-cover block"
          onError={(e) => {
            const target = e.currentTarget;
            if (item.thumbnail && target.src !== item.thumbnail) {
              target.src = item.thumbnail;
            }
          }}
        />

        {/* Tiny Overlay Badge for Type/Duration (bottom-1 right-1) */}
        <div className="absolute bottom-1 right-1 text-[9px] px-1 py-0.5 rounded bg-black/70 font-mono text-zinc-300 flex items-center gap-0.5 border border-white/10 pointer-events-none">
          {isShort ? (
            <>
              <Film className="w-2.5 h-2.5 text-rose-400" />
              <span>REEL</span>
            </>
          ) : isVideo ? (
            <>
              <Play className="w-2.5 h-2.5 text-amber-400 fill-current" />
              <span>VIDEO</span>
            </>
          ) : (
            <>
              <Camera className="w-2.5 h-2.5 text-cyan-400" />
              <span>PHOTO</span>
            </>
          )}
        </div>
      </div>

      {/* Compact Metadata: 1-line truncated title */}
      <span className="text-[11px] text-zinc-300 leading-tight mt-1 line-clamp-1 truncate">
        {cleanTitle}
      </span>
    </div>
  );
};

export const MobileGalleryFeed: React.FC<MobileGalleryFeedProps> = ({
  albums,
  onSelectItem,
  recentItems = [],
  onClearHistory,
  scrollRef,
  onScroll,
}) => {
  const hasRecent = recentItems.length > 0;
  const latestAlbum = albums.find((a) => a.id === 'album-latest-releases') || albums[0];
  const regularAlbums = albums.filter((a) => a.id !== 'album-latest-releases');

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="block md:hidden h-screen w-full overflow-y-auto overflow-x-hidden pt-16 pb-24 bg-black select-none overscroll-contain [-webkit-overflow-scrolling:touch]"
    >
      {/* 1. RECENTLY OPENED SECTION (Conditional) */}
      {hasRecent && (
        <section id="mobile-album-recent" className="mb-4">
          <div className="px-2.5 pt-1 pb-1 flex items-center justify-between border-b border-white/[0.04]">
            <h2 className="text-xs font-bold font-space uppercase text-zinc-200 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              Recently Opened
              <span className="text-zinc-600 font-mono text-[10px]">({recentItems.length})</span>
            </h2>
            {onClearHistory && (
              <button
                type="button"
                onClick={onClearHistory}
                className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 uppercase cursor-pointer px-1 py-0.5"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3">
            {recentItems.slice(0, 8).map((item, idx) => (
              <MobileCard
                key={`recent-${item.id || idx}`}
                item={item}
                album={latestAlbum || albums[0]}
                idx={idx}
                onSelectItem={(it, aIdx) => onSelectItem(it, aIdx)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. LATEST RELEASES SECTION */}
      {latestAlbum && latestAlbum.items.length > 0 && (
        <section id="mobile-album-0" className="mb-4">
          <div className="px-2.5 pt-1 pb-1 flex items-center justify-between border-b border-white/[0.04]">
            <h2 className="text-xs font-bold font-space uppercase text-zinc-200 tracking-wider flex items-center gap-1.5">
              <Film className="w-3 h-3 text-amber-400" />
              Latest Releases
              <span className="text-zinc-600 font-mono text-[10px]">({latestAlbum.items.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3">
            {latestAlbum.items.map((item, idx) => (
              <MobileCard
                key={item.id || `latest-${idx}`}
                item={item}
                album={latestAlbum}
                idx={idx}
                onSelectItem={(it, aIdx) => onSelectItem(it, aIdx)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. REGULAR ALBUMS (Tight 2-Column Grid, Zero Header Gap) */}
      {regularAlbums.map((album) => {
        if (!album.items || album.items.length === 0) return null;

        return (
          <section key={album.id} id={`mobile-album-${album.index}`} className="mb-4">
            <div className="px-2.5 pt-2 pb-1 flex items-center justify-between border-b border-white/[0.04]">
              <h2 className="text-xs font-bold font-space uppercase text-zinc-200 tracking-wider">
                {album.name}
                <span className="text-zinc-600 font-mono text-[10px] ml-1.5">
                  ({album.items.length})
                </span>
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3">
              {album.items.map((item, idx) => (
                <MobileCard
                  key={item.id || `${album.id}-${idx}`}
                  item={item}
                  album={album}
                  idx={idx}
                  onSelectItem={(it, aIdx) => onSelectItem(it, aIdx)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
