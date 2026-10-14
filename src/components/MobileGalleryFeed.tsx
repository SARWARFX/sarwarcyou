import React, { useState } from 'react';
import { Play, Camera, Film, Sparkles, ChevronLeft, ArrowRight } from 'lucide-react';
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
      className="group flex flex-col cursor-pointer active:scale-[0.98] transition-transform select-none w-full"
    >
      {/* 16:9 Aspect Video Thumbnail Container with rounded-lg */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.06]">
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
      <span className="text-[11px] text-zinc-300 font-medium leading-tight mt-1 line-clamp-1 truncate">
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
  const [selectedCollectionAlbum, setSelectedCollectionAlbum] = useState<AlbumData | null>(null);

  const hasRecent = recentItems.length > 0;
  const latestAlbum = albums.find((a) => a.id === 'album-latest-releases') || albums[0];
  const regularAlbums = albums.filter((a) => a.id !== 'album-latest-releases');

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="block md:hidden h-screen w-full overflow-y-auto overflow-x-hidden pt-16 pb-24 bg-black select-none overscroll-contain [-webkit-overflow-scrolling:touch]"
    >
      {/* 1. RECENTLY OPENED SECTION (Conditional Horizontal Carousel) */}
      {hasRecent && (
        <section id="mobile-album-recent" className="mb-5">
          <div className="px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-white/[0.04]">
            <h2 className="text-base xs:text-lg font-extrabold font-space uppercase text-white tracking-tight flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              Recently Opened
              <span className="text-sm font-medium text-zinc-400 font-mono ml-1.5">({recentItems.length})</span>
            </h2>
            {onClearHistory && (
              <button
                type="button"
                onClick={onClearHistory}
                className="text-[10px] font-mono text-zinc-400 hover:text-white uppercase cursor-pointer px-2 py-0.5 rounded bg-zinc-900 border border-white/5"
              >
                Clear
              </button>
            )}
          </div>
          <div
            className="grid grid-rows-2 sm:grid-rows-3 grid-flow-col gap-2.5 overflow-x-auto pb-3 pt-2 px-3 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              gridTemplateRows: 'repeat(2, auto)',
            }}
          >
            {recentItems.map((item, idx) => (
              <div
                key={`recent-${item.id || idx}`}
                className="w-[160px] xs:w-[175px] snap-start shrink-0"
              >
                <MobileCard
                  item={item}
                  album={latestAlbum || albums[0]}
                  idx={idx}
                  onSelectItem={(it, aIdx) => onSelectItem(it, aIdx)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. LATEST RELEASES SECTION (Horizontal 4-Row Multi-Row Carousel) */}
      {latestAlbum && latestAlbum.items.length > 0 && (
        <section id="mobile-album-0" className="mb-5">
          <div className="px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-white/[0.04]">
            <h2 className="text-lg xs:text-xl font-extrabold font-space uppercase text-white tracking-tight flex items-center gap-1.5">
              <Film className="w-4 h-4 text-amber-400 flex-shrink-0" />
              Latest Releases
              <span className="text-sm font-medium text-zinc-400 font-mono ml-1.5">({latestAlbum.items.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => setSelectedCollectionAlbum(latestAlbum)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3 text-zinc-500" />
            </button>
          </div>
          <div
            className="grid grid-rows-4 sm:grid-rows-5 grid-flow-col gap-2.5 overflow-x-auto pb-3 pt-2 px-3 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              gridTemplateRows: 'repeat(4, auto)',
            }}
          >
            {latestAlbum.items.map((item, idx) => (
              <div
                key={item.id || `latest-${idx}`}
                className="w-[160px] xs:w-[175px] snap-start shrink-0"
              >
                <MobileCard
                  item={item}
                  album={latestAlbum}
                  idx={idx}
                  onSelectItem={(it, aIdx) => onSelectItem(it, aIdx)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. REGULAR ALBUMS (Capped 4-5 Row Horizontal Sliding Carousels) */}
      {regularAlbums.map((album) => {
        if (!album.items || album.items.length === 0) return null;

        return (
          <section key={album.id} id={`mobile-album-${album.index}`} className="mb-5">
            <div className="px-3 pt-2 pb-1 flex items-center justify-between border-b border-white/[0.04]">
              <h2 className="text-lg xs:text-xl font-extrabold font-space uppercase text-white tracking-tight flex items-center">
                {album.name}
                <span className="text-sm font-medium text-zinc-400 font-mono ml-1.5">
                  ({album.items.length})
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setSelectedCollectionAlbum(album)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3 text-zinc-500" />
              </button>
            </div>

            {/* Mobile-only horizontal multi-row carousel */}
            <div
              className="grid grid-rows-4 sm:grid-rows-5 grid-flow-col gap-2.5 overflow-x-auto pb-3 pt-2 px-3 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
              style={{
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                gridTemplateRows: 'repeat(4, auto)',
              }}
            >
              {album.items.map((item, idx) => (
                <div
                  key={item.id || `${album.id}-${idx}`}
                  className="w-[160px] xs:w-[175px] snap-start shrink-0"
                >
                  <MobileCard
                    item={item}
                    album={album}
                    idx={idx}
                    onSelectItem={(it, aIdx) => onSelectItem(it, aIdx)}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* ================= DEDICATED FULL COLLECTION MODAL ("VIEW ALL") ================= */}
      {selectedCollectionAlbum && (
        <div className="fixed inset-0 z-50 bg-black/96 backdrop-blur-2xl flex flex-col animate-fade-in md:hidden">
          {/* Top Control Bar */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-zinc-950/90 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setSelectedCollectionAlbum(null)}
              className="flex items-center gap-1.5 text-xs font-mono text-zinc-300 hover:text-white p-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="text-center truncate px-2">
              <h2 className="text-base xs:text-lg font-extrabold font-space uppercase text-white tracking-tight truncate">
                {selectedCollectionAlbum.name}
              </h2>
              <span className="text-xs font-mono text-zinc-400">
                {selectedCollectionAlbum.items.length} items
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedCollectionAlbum.items.length > 0) {
                  const firstItem = selectedCollectionAlbum.items[0];
                  setSelectedCollectionAlbum(null);
                  onSelectItem(firstItem, selectedCollectionAlbum.index);
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-black font-mono text-[10px] font-bold uppercase hover:bg-zinc-200 transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Play</span>
            </button>
          </div>

          {/* Full Scrollable 2-Column Vertical Grid */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5 overscroll-contain pb-20">
            {selectedCollectionAlbum.items.map((item, idx) => (
              <div key={item.id || `full-view-${idx}`} className="w-full">
                <MobileCard
                  item={item}
                  album={selectedCollectionAlbum}
                  idx={idx}
                  onSelectItem={(it, aIdx) => {
                    setSelectedCollectionAlbum(null);
                    onSelectItem(it, aIdx);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
