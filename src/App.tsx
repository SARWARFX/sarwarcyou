import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMediaData } from './useMediaData';
import { organizeVaultFeed } from './utils/vaultFeedOrganizer';
import { type CyberFilterType } from './components/CyberHeader';
import { RightDockedNav } from './components/RightDockedNav';
import { CyberCarouselRow } from './components/CyberCarouselRow';
import { CyberVideoPlayer } from './components/CyberVideoPlayer';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { MediaModal } from './components/MediaModal';
import { FullAlbumViewModal } from './components/FullAlbumViewModal';
import { SiteFooter } from './components/SiteFooter';
import type { StageMediaItem, SortOrder } from './types';
import { isVideoExtension } from './utils/mediaTypeDetector';
import { parseUrlState, syncUrlState, findMatchingMediaItem, findMatchingFolder } from './utils/urlRouter';
import { ChevronUp } from 'lucide-react';

function App() {
  const { data, isLoading } = useMediaData();

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CyberFilterType>('all');
  const [sortOrder] = useState<SortOrder>(() => {
    const { sortQuery } = parseUrlState();
    return (sortQuery === 'oldest' || sortQuery === 'name-asc') ? sortQuery : 'newest';
  });

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

  // Dedicated "View All" Album View State
  const [viewAllState, setViewAllState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    items: StageMediaItem[];
    variant?: 'standard' | 'shorts' | 'photo';
    hasMultipleTypes?: boolean;
    typeCounts?: {
      photos: number;
      clips: number;
      shorts: number;
    };
  }>({
    isOpen: false,
    title: '',
    items: [],
  });

  // Active modal history stack tracker for smart browser back navigation
  const modalStackRef = useRef<string[]>([]);

  const pushModalState = useCallback((viewName: string) => {
    modalStackRef.current.push(viewName);
    window.history.pushState({ modalOpen: true, view: viewName }, '');
  }, []);

  const handleCloseModal = useCallback((type: 'theater' | 'lightbox' | 'shorts' | 'viewAll') => {
    const idx = modalStackRef.current.lastIndexOf(type);
    if (idx !== -1) {
      if (idx === modalStackRef.current.length - 1) {
        window.history.back();
        return;
      }
      modalStackRef.current.splice(idx, 1);
    }
    if (type === 'lightbox') setLightboxState((prev) => ({ ...prev, isOpen: false }));
    else if (type === 'theater') setTheaterState((prev) => ({ ...prev, isOpen: false }));
    else if (type === 'shorts') setShortsState((prev) => ({ ...prev, isOpen: false }));
    else if (type === 'viewAll') setViewAllState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Intercept hardware/browser Back button to close modals instead of exiting site
  useEffect(() => {
    const handlePopState = () => {
      if (modalStackRef.current.length > 0) {
        const topModal = modalStackRef.current.pop();
        if (topModal === 'lightbox') {
          setLightboxState((prev) => ({ ...prev, isOpen: false }));
        } else if (topModal === 'theater') {
          setTheaterState((prev) => ({ ...prev, isOpen: false }));
        } else if (topModal === 'shorts') {
          setShortsState((prev) => ({ ...prev, isOpen: false }));
        } else if (topModal === 'viewAll') {
          setViewAllState((prev) => ({ ...prev, isOpen: false }));
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
  const rawFeed = useMemo(() => organizeVaultFeed(data, sortOrder), [data, sortOrder]);

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

      const isVid =
        isShort ||
        item.type === 'video' ||
        item.mediaType === 'clip' ||
        isVideoExtension(item.url || item.id || item.path);

      if (isShort) {
        const fullShortsList =
          playlistContext && playlistContext.length > 0
            ? playlistContext
            : rawFeed.shorts.length > 0
            ? rawFeed.shorts
            : [item];

        const targetIdx = fullShortsList.findIndex(
          (s) => s.id === item.id || s.url === item.url
        );

        pushModalState('shorts');
        setShortsState({
          isOpen: true,
          shorts: fullShortsList,
          initialIndex: targetIdx !== -1 ? targetIdx : 0,
        });
        return;
      }

      if (isVid) {
        pushModalState('theater');
        setTheaterState({
          isOpen: true,
          item,
          playlist: playlistContext || [item],
        });
        return;
      }

      // Photographic / Image asset
      const photoPlaylist =
        playlistContext && playlistContext.length > 0
          ? playlistContext
          : [item];

      const photoIdx = photoPlaylist.findIndex(
        (p) => p.id === item.id || p.url === item.url
      );

      pushModalState('lightbox');
      setLightboxState({
        isOpen: true,
        item,
        items: photoPlaylist,
        initialIndex: photoIdx !== -1 ? photoIdx : 0,
      });
    },
    [rawFeed.shorts, pushModalState]
  );

  // Dedicated "View All" Album Navigator
  const handleOpenViewAll = useCallback(
    (
      albumTitle: string,
      albumItems: StageMediaItem[],
      variant: 'standard' | 'shorts' | 'photo' = 'standard',
      subtitle?: string,
      hasMultipleTypes?: boolean,
      typeCounts?: { photos: number; clips: number; shorts: number }
    ) => {
      pushModalState('viewAll');
      setViewAllState({
        isOpen: true,
        title: albumTitle,
        subtitle,
        items: albumItems,
        variant,
        hasMultipleTypes,
        typeCounts,
      });
    },
    [pushModalState]
  );

  // Deep Link Synchronizer: Parse Initial URL on load
  const hasInitializedUrlRef = useRef(false);

  useEffect(() => {
    if (isLoading || !data || hasInitializedUrlRef.current) return;
    hasInitializedUrlRef.current = true;

    const { albumQuery, mediaQuery } = parseUrlState();
    if (!albumQuery && !mediaQuery) return;

    if (mediaQuery) {
      const allItems: StageMediaItem[] = [
        ...(rawFeed.allMediaPool || []),
        ...(rawFeed.shorts || []),
        ...(rawFeed.latestReleases || []),
        ...rawFeed.albums.flatMap((f) => f.items),
      ];
      const seen = new Set<string>();
      const uniquePool = allItems.filter((item) => {
        const key = item.id || item.url;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const match = findMatchingMediaItem(uniquePool, mediaQuery);
      if (match) {
        let contextList: StageMediaItem[] | undefined;
        if (albumQuery) {
          if (albumQuery.toLowerCase() === 'shorts') {
            contextList = rawFeed.shorts;
          } else {
            const folderMatch = findMatchingFolder(rawFeed.albums, albumQuery);
            if (folderMatch) contextList = folderMatch.folder.items;
          }
        }
        if (!contextList && match.item.category) {
          const folderMatch = findMatchingFolder(rawFeed.albums, match.item.category);
          if (folderMatch) contextList = folderMatch.folder.items;
        }
        handleSelectItem(match.item, contextList);
        return;
      }
    }

    if (albumQuery) {
      if (albumQuery.toLowerCase() === 'shorts') {
        handleOpenViewAll('Shorts', rawFeed.shorts, 'shorts');
      } else {
        const folderMatch = findMatchingFolder(rawFeed.albums, albumQuery);
        if (folderMatch) {
          handleOpenViewAll(
            folderMatch.folder.name,
            folderMatch.folder.items,
            folderMatch.folder.variant,
            undefined,
            folderMatch.folder.hasMultipleTypes,
            folderMatch.folder.typeCounts
          );
        }
      }
    }
  }, [isLoading, data, rawFeed, handleSelectItem, handleOpenViewAll]);

  // URL state synchronizer: Keeps browser URL bar aligned with open modals
  useEffect(() => {
    if (!hasInitializedUrlRef.current) return;

    if (theaterState.isOpen && theaterState.item) {
      syncUrlState({
        album: theaterState.item.category || theaterState.item.parentAlbum,
        mediaItem: theaterState.item,
        sort: sortOrder,
        replace: true,
      });
    } else if (lightboxState.isOpen && lightboxState.item) {
      syncUrlState({
        album: lightboxState.item.category || lightboxState.item.parentAlbum,
        mediaItem: lightboxState.item,
        sort: sortOrder,
        replace: true,
      });
    } else if (shortsState.isOpen && shortsState.shorts[shortsState.initialIndex]) {
      syncUrlState({
        album: 'shorts',
        mediaItem: shortsState.shorts[shortsState.initialIndex],
        sort: sortOrder,
        replace: true,
      });
    } else if (viewAllState.isOpen && viewAllState.title) {
      syncUrlState({
        album: viewAllState.title,
        mediaItem: null,
        sort: sortOrder,
        replace: true,
      });
    } else {
      syncUrlState({
        album: null,
        mediaItem: null,
        sort: sortOrder,
        replace: true,
      });
    }
  }, [
    theaterState.isOpen,
    theaterState.item,
    lightboxState.isOpen,
    lightboxState.item,
    shortsState.isOpen,
    shortsState.initialIndex,
    shortsState.shorts,
    viewAllState.isOpen,
    viewAllState.title,
    sortOrder,
  ]);

  const handleResetHome = useCallback(() => {
    setActiveFilter('all');
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Prepare full dynamic album list with precise data-type tags for in-place filtering
  const albumList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rawFeed.albums.map((album) => {
      const items = q
        ? album.items.filter(
            (it) =>
              it.title.toLowerCase().includes(q) ||
              (it.category && it.category.toLowerCase().includes(q)) ||
              (it.name && it.name.toLowerCase().includes(q))
          )
        : album.items;

      const counts = album.typeCounts || { photos: 0, clips: 0, shorts: 0 };
      const folderPath = album.folderPath || '';

      const isImage =
        album.type === 'image' ||
        album.variant === 'photo' ||
        (counts.photos > 0 && counts.clips === 0 && counts.shorts === 0);

      const isShort =
        album.variant === 'shorts' ||
        album.name.toLowerCase() === 'shorts' ||
        folderPath.toLowerCase().includes('short') ||
        (counts.shorts > 0 && counts.clips === 0 && counts.photos === 0);

      const isVideo = !isShort && (album.type === 'video' || counts.clips > 0);

      const dataType: 'image' | 'video' | 'short' = isShort ? 'short' : isImage ? 'image' : 'video';

      return {
        ...album,
        items,
        dataType,
        isImage,
        isShort,
        isVideo,
      };
    });
  }, [rawFeed.albums, searchQuery]);

  return (
    <div className="w-full max-w-full overflow-x-hidden relative bg-[#030305] text-white min-h-screen selection:bg-[#00E5FF] selection:text-black">
      {/* 1. Compact Right-Docked Vertical Navigation Bar (Fixed at right: 0, top: 50%) */}
      <RightDockedNav
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Main Content Stage with padding on right to avoid navigation occlusion */}
      <div className="w-full pr-14 sm:pr-18 pb-12 flex flex-col min-h-screen">
        {/* Clean Website Brand Header (Plain wordmark without play button or fluff) */}
        <header className="w-full max-w-7xl mx-auto px-4 sm:px-8 pt-5 pb-2 flex items-center justify-between select-none">
          <span
            onClick={handleResetHome}
            className="text-base sm:text-lg font-black font-sans tracking-widest text-zinc-200 hover:text-white uppercase cursor-pointer"
          >
            SARWARCYOU
          </span>
        </header>

        {/* 2. Structured Discovery Feed: Tagged Album Sections with Instant In-Place Filtering */}
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-8 pt-2 flex flex-col gap-7 sm:gap-9">
          {/* Loading State Skeleton */}
          {isLoading && !data && (
            <div className="w-full py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#00E5FF] border-t-transparent animate-spin" />
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                Ingesting stream vault...
              </span>
            </div>
          )}

          {/* Dynamic Album Sections Tagged with data-type and filtered in-place */}
          {albumList.map((album) => {
            if (album.items.length === 0) return null;

            let isVisible = true;
            if (activeFilter === 'images') {
              isVisible = album.isImage;
            } else if (activeFilter === 'clips') {
              isVisible = album.isVideo;
            } else if (activeFilter === 'shorts') {
              isVisible = album.isShort;
            }

            return (
              <div
                key={album.id}
                id={album.id}
                data-type={album.dataType}
                style={{ display: isVisible ? undefined : 'none' }}
                className="scroll-mt-20 transition-all duration-150"
              >
                <CyberCarouselRow
                  title={album.name}
                  items={album.items}
                  variant={album.variant}
                  onSelectItem={(item, currentList) => handleSelectItem(item, currentList || album.items)}
                  onViewAll={() =>
                    handleOpenViewAll(
                      album.name,
                      album.items,
                      album.variant,
                      undefined,
                      album.hasMultipleTypes,
                      album.typeCounts
                    )
                  }
                />
              </div>
            );
          })}
        </main>

        {/* 3. Minimalist Footer */}
        <SiteFooter onBackToTop={handleResetHome} className="mt-14" />
      </div>

      {/* Floating Global Back-To-Top Button */}
      <button
        type="button"
        onClick={handleScrollToTop}
        aria-label="Scroll back to top"
        title="Back to top"
        className={`fixed bottom-6 right-4 sm:right-6 z-40 p-2.5 rounded-full bg-black/80 hover:bg-black text-zinc-400 hover:text-white border border-white/10 shadow-lg transition-all duration-200 cursor-pointer ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
            : 'opacity-0 translate-y-4 pointer-events-none scale-90'
        }`}
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      {/* 4. Single Global Video Player (Clips) */}
      <CyberVideoPlayer
        isOpen={theaterState.isOpen}
        onClose={() => handleCloseModal('theater')}
        item={theaterState.item}
        playlist={theaterState.playlist}
        allFolders={rawFeed.videoVaultFolders}
        onSelectItem={(item) => setTheaterState((prev) => ({ ...prev, item }))}
        onSelectFolder={(folder) => {
          if (folder.items.length > 0) {
            pushModalState('theater');
            setTheaterState({
              isOpen: true,
              item: folder.items[0],
              playlist: folder.items,
            });
          }
        }}
      />

      {/* 5. Single Global Shorts Feed Player */}
      <ShortsFeedModal
        isOpen={shortsState.isOpen}
        onClose={() => handleCloseModal('shorts')}
        shorts={shortsState.shorts}
        initialIndex={shortsState.initialIndex}
        onIndexChange={(idx) => {
          setShortsState((prev) => ({
            ...prev,
            initialIndex: idx,
          }));
        }}
      />

      {/* 6. Single High-Definition Image Lightbox */}
      <MediaModal
        isOpen={lightboxState.isOpen}
        onClose={() => handleCloseModal('lightbox')}
        url={lightboxState.item?.url || null}
        type="image"
        title={lightboxState.item?.title}
        items={lightboxState.items}
        currentIndex={lightboxState.initialIndex}
        allFolders={rawFeed.photoVaultFolders}
        onSelectFolder={(folder) => {
          if (folder.items.length > 0) {
            pushModalState('lightbox');
            setLightboxState({
              isOpen: true,
              item: folder.items[0],
              items: folder.items,
              initialIndex: 0,
            });
          }
        }}
        onIndexChange={(idx) => {
          setLightboxState((prev) => ({
            ...prev,
            initialIndex: idx,
            item: prev.items[idx] || prev.item,
          }));
        }}
      />

      {/* 7. Dedicated Full Album View Modal */}
      <FullAlbumViewModal
        isOpen={viewAllState.isOpen}
        title={viewAllState.title}
        subtitle={viewAllState.subtitle}
        items={viewAllState.items}
        variant={viewAllState.variant}
        hasMultipleTypes={viewAllState.hasMultipleTypes}
        typeCounts={viewAllState.typeCounts}
        onClose={() => handleCloseModal('viewAll')}
        onSelectItem={(item, currentList) => handleSelectItem(item, currentList)}
      />
    </div>
  );
}

export default App;
