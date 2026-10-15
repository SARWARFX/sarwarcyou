import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMediaData } from './useMediaData';
import { organizeVaultFeed } from './utils/vaultFeedOrganizer';
import { CyberHeader, type CyberFilterType } from './components/CyberHeader';
import { CyberCarouselRow } from './components/CyberCarouselRow';
import { CyberVideoPlayer } from './components/CyberVideoPlayer';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { MediaModal } from './components/MediaModal';
import { SiteFooter } from './components/SiteFooter';
import type { StageMediaItem } from './types';
import { isVideoExtension } from './utils/mediaTypeDetector';
import { Film, Sparkles, Image as ImageIcon, Flame, ChevronUp } from 'lucide-react';

function App() {
  const { data, isLoading } = useMediaData();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CyberFilterType>('all');

  // Modal / Player States
  const [theaterState, setTheaterState] = useState<{
    isOpen: boolean;
    item: StageMediaItem | null;
    playlist: StageMediaItem[];
  }>({
    isOpen: false,
    item: null,
    playlist: [],
  });

  const [shortsState, setShortsState] = useState<{
    isOpen: boolean;
    shorts: StageMediaItem[];
    initialIndex: number;
  }>({
    isOpen: false,
    shorts: [],
    initialIndex: 0,
  });

  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    item: StageMediaItem | null;
    items: StageMediaItem[];
    initialIndex: number;
  }>({
    isOpen: false,
    item: null,
    items: [],
    initialIndex: 0,
  });

  // Global Back-To-Top Button state (> 300px scroll)
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Organize raw catalog data into structured multi-row discovery feed
  const rawFeed = useMemo(() => organizeVaultFeed(data), [data]);

  // Live Real-Time Filtering based on Omnisearch input and category chips
  const feed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matchesQuery = (it: StageMediaItem) => {
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        (it.category && it.category.toLowerCase().includes(q)) ||
        (it.name && it.name.toLowerCase().includes(q))
      );
    };

    // Filter Latest Releases
    let latest = rawFeed.latestReleases.filter(matchesQuery);
    if (activeFilter === 'clips') {
      latest = latest.filter((it) => it.type === 'video' && it.mediaType !== 'short' && !it.category?.toLowerCase().includes('short'));
    } else if (activeFilter === 'images') {
      latest = latest.filter((it) => it.type === 'image' || it.mediaType === 'photo');
    } else if (activeFilter === 'shorts') {
      latest = latest.filter((it) => it.mediaType === 'short' || it.category?.toLowerCase().includes('short') || it.url?.toLowerCase().includes('/shorts/'));
    }

    // Filter Shorts
    const shorts = (activeFilter === 'all' || activeFilter === 'shorts')
      ? rawFeed.shorts.filter(matchesQuery)
      : [];

    // Filter Video Vault Folders
    const videoFolders = (activeFilter === 'all' || activeFilter === 'clips')
      ? rawFeed.videoVaultFolders
          .map((f) => ({
            ...f,
            items: f.items.filter(matchesQuery),
          }))
          .filter((f) => f.items.length > 0)
      : [];

    // Filter Photo Vault Folders
    const photoFolders = (activeFilter === 'all' || activeFilter === 'images')
      ? rawFeed.photoVaultFolders
          .map((f) => {
            let items = f.items.filter(matchesQuery);
            if (activeFilter === 'images') {
              items = items.filter((it) => it.type === 'image' || it.mediaType === 'photo');
            }
            return {
              ...f,
              items,
              count: items.length,
            };
          })
          .filter((f) => f.items.length > 0)
      : [];

    return {
      latestReleases: latest,
      shorts,
      videoVaultFolders: videoFolders,
      photoVaultFolders: photoFolders,
    };
  }, [rawFeed, searchQuery, activeFilter]);

  // Universal Media Click Dispatcher
  const handleSelectItem = useCallback(
    (item: StageMediaItem, playlistContext?: StageMediaItem[]) => {
      const isShort = Boolean(
        item.mediaType === 'short' ||
        item.category?.toLowerCase().includes('short') ||
        item.category?.toLowerCase().includes('reel') ||
        item.url?.toLowerCase().includes('/shorts/') ||
        item.id?.toLowerCase().includes('shorts')
      );

      const isVid = isShort || item.type === 'video' || item.mediaType === 'clip' || isVideoExtension(item.url || item.id);
      const isPhoto = !isShort && (!isVid || item.type === 'image' || item.mediaType === 'photo');

      if (isShort) {
        const fullShorts = rawFeed.shorts.length > 0 ? rawFeed.shorts : [item];
        const idx = fullShorts.findIndex((s) => s.id === item.id || s.url === item.url);
        setShortsState({
          isOpen: true,
          shorts: fullShorts,
          initialIndex: Math.max(0, idx),
        });
      } else if (isPhoto) {
        const fullPhotos = playlistContext && playlistContext.length > 0
          ? playlistContext.filter((p) => p.type === 'image' || p.mediaType === 'photo')
          : [item];
        const idx = fullPhotos.findIndex((p) => p.id === item.id || p.url === item.url);
        setLightboxState({
          isOpen: true,
          item,
          items: fullPhotos.length > 0 ? fullPhotos : [item],
          initialIndex: Math.max(0, idx),
        });
      } else {
        // Clips / Cinema Video
        const fullVideos = playlistContext && playlistContext.length > 0
          ? playlistContext.filter(
              (v) =>
                (v.type === 'video' || v.mediaType === 'clip') &&
                v.mediaType !== 'short' &&
                !v.category?.toLowerCase().includes('short') &&
                !v.url?.toLowerCase().includes('/shorts/')
            )
          : [item];
        setTheaterState({
          isOpen: true,
          item,
          playlist: fullVideos.length > 0 ? fullVideos : [item],
        });
      }
    },
    [rawFeed]
  );

  const handleResetHome = () => {
    setSearchQuery('');
    setActiveFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasAnyResults =
    feed.latestReleases.length > 0 ||
    feed.shorts.length > 0 ||
    feed.videoVaultFolders.length > 0 ||
    feed.photoVaultFolders.length > 0;

  return (
    <div className="bg-[#030305] text-white min-h-screen selection:bg-[#00E5FF] selection:text-black">
      {/* 1. Floating Glass Pill Header */}
      <CyberHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onReset={handleResetHome}
      />

      {/* 2. Structured Multi-Row Discovery Feed */}
      <main className="w-full max-w-7xl mx-auto pt-24 sm:pt-28 pb-16 px-4 sm:px-8 flex flex-col gap-10 sm:gap-14">
        {/* Loading State Skeleton */}
        {isLoading && !data && (
          <div className="w-full py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#00E5FF] border-t-transparent animate-spin" />
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
              Ingesting stream vault...
            </span>
          </div>
        )}

        {/* Empty Search State */}
        {!hasAnyResults && !isLoading && (
          <div className="w-full py-24 flex flex-col items-center justify-center gap-4 text-center">
            <Sparkles className="w-10 h-10 text-zinc-600" />
            <h3 className="text-lg font-bold font-sans text-zinc-300 uppercase tracking-wider">
              No matching files found
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              We couldn't find any media matching "{searchQuery}". Try searching for another term or click below to reset.
            </p>
            <button
              type="button"
              onClick={handleResetHome}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold font-sans text-white transition-colors cursor-pointer border border-white/10"
            >
              RESET SEARCH
            </button>
          </div>
        )}

        {/* SECTION 1: LATEST RELEASES */}
        {feed.latestReleases.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-[11px] font-mono tracking-widest text-[#00E5FF] font-bold uppercase">
                FEATURED SPOTLIGHT
              </span>
            </div>
            <CyberCarouselRow
              title="Latest Releases"
              subtitle="30 newest items aggregated from all folders"
              badge={feed.latestReleases.length}
              items={feed.latestReleases}
              variant="standard"
              onSelectItem={(item, currentList) => handleSelectItem(item, currentList || feed.latestReleases)}
            />
          </div>
        )}

        {/* SECTION 2: SHORTS */}
        {feed.shorts.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <Film className="w-4 h-4 text-fuchsia-400" />
              <span className="text-[11px] font-mono tracking-widest text-fuchsia-400 font-bold uppercase">
                VERTICAL STREAM
              </span>
            </div>
            <CyberCarouselRow
              title="Shorts"
              subtitle="Dedicated 9:16 vertical reels"
              badge={feed.shorts.length}
              items={feed.shorts}
              variant="shorts"
              onSelectItem={(item, currentList) => handleSelectItem(item, currentList || feed.shorts)}
            />
          </div>
        )}

        {/* SECTION 3: VIDEO VAULT */}
        {feed.videoVaultFolders.length > 0 && (
          <section className="flex flex-col gap-7 pt-4 border-t border-white/[0.05]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-amber-400" />
                <h2 className="text-base sm:text-lg font-black font-sans tracking-wider text-white uppercase">
                  Video Vault
                </h2>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">
                  ({feed.videoVaultFolders.length} Archive Folders)
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              {feed.videoVaultFolders.map((folder) => (
                <CyberCarouselRow
                  key={folder.id}
                  title={folder.name}
                  badge={folder.count}
                  items={folder.items}
                  variant="standard"
                  hasMultipleTypes={folder.hasMultipleTypes}
                  typeCounts={folder.typeCounts}
                  onSelectItem={(item, currentList) => handleSelectItem(item, currentList || folder.items)}
                />
              ))}
            </div>
          </section>
        )}

        {/* SECTION 4: PHOTO VAULT */}
        {feed.photoVaultFolders.length > 0 && (
          <section className="flex flex-col gap-7 pt-4 border-t border-white/[0.05]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <h2 className="text-base sm:text-lg font-black font-sans tracking-wider text-white uppercase">
                  Photo Vault
                </h2>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">
                  ({feed.photoVaultFolders.length} Gallery Folders)
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              {feed.photoVaultFolders.map((folder) => (
                <CyberCarouselRow
                  key={folder.id}
                  title={folder.name}
                  badge={folder.count}
                  items={folder.items}
                  variant={folder.hasMultipleTypes ? 'standard' : 'photo'}
                  hasMultipleTypes={folder.hasMultipleTypes}
                  typeCounts={folder.typeCounts}
                  onSelectItem={(item, currentList) => handleSelectItem(item, currentList || folder.items)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 3. Minimalist Footer */}
      <SiteFooter onBackToTop={handleResetHome} />

      {/* Floating Global Back-To-Top Button */}
      <button
        type="button"
        onClick={handleScrollToTop}
        aria-label="Scroll back to top"
        title="Back to top"
        className={`fixed bottom-6 right-6 z-40 p-3 rounded-full bg-black/65 hover:bg-black/95 text-zinc-400 hover:text-[#00E5FF] backdrop-blur-xl border border-white/10 hover:border-[#00E5FF]/40 shadow-[0_8px_30px_rgba(0,0,0,0.85)] hover:shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all duration-300 cursor-pointer ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
            : 'opacity-0 translate-y-4 pointer-events-none scale-90'
        }`}
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      {/* 4. Frameless Theater Mode Video Player (Clips) */}
      <CyberVideoPlayer
        isOpen={theaterState.isOpen}
        onClose={() => setTheaterState({ isOpen: false, item: null, playlist: [] })}
        item={theaterState.item}
        playlist={theaterState.playlist}
        onSelectItem={(item) => setTheaterState((prev) => ({ ...prev, item }))}
      />

      {/* 5. Adaptive Shorts Feed Modal */}
      <ShortsFeedModal
        isOpen={shortsState.isOpen}
        onClose={() => setShortsState({ isOpen: false, shorts: [], initialIndex: 0 })}
        shorts={shortsState.shorts}
        initialIndex={shortsState.initialIndex}
      />

      {/* 6. High-Definition Image Lightbox */}
      <MediaModal
        isOpen={lightboxState.isOpen}
        onClose={() => setLightboxState({ isOpen: false, item: null, items: [], initialIndex: 0 })}
        url={lightboxState.item?.url || null}
        type="image"
        title={lightboxState.item?.title}
        items={lightboxState.items}
        currentIndex={lightboxState.initialIndex}
        onIndexChange={(idx) => {
          setLightboxState((prev) => ({
            ...prev,
            initialIndex: idx,
            item: prev.items[idx] || prev.item,
          }));
        }}
      />
    </div>
  );
}

export default App;
