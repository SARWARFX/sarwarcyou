import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMediaData } from './useMediaData';
import { organizeVaultFeed } from './utils/vaultFeedOrganizer';
import { type CyberFilterType } from './components/CyberHeader';
import { ResponsiveNav } from './components/ResponsiveNav';
import { CyberCarouselRow } from './components/CyberCarouselRow';
import { CyberVideoPlayer } from './components/CyberVideoPlayer';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { MediaModal } from './components/MediaModal';
import { FullAlbumViewModal } from './components/FullAlbumViewModal';
import { SiteFooter } from './components/SiteFooter';
import type { StageMediaItem, SortOrder } from './types';
import { isVideoExtension } from './utils/mediaTypeDetector';
import {
  parseUrlState,
  syncUrlState,
  findMatchingMediaItem,
  findMatchingFolder,
  getAlbumSlug,
  getMediaSlug,
} from './utils/urlRouter';
import { ChevronUp } from 'lucide-react';

function buildMediaUrl(item: StageMediaItem, albumContext?: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const albumTarget = albumContext || item.category || item.parentAlbum;
  if (albumTarget) {
    searchParams.set('album', getAlbumSlug(albumTarget));
  }
  searchParams.set('media', getMediaSlug(item));
  const queryPart = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return `${url.pathname}${queryPart}${url.hash}`;
}

function buildAlbumUrl(albumNameOrSlug: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  searchParams.set('album', getAlbumSlug(albumNameOrSlug));
  searchParams.delete('media');
  searchParams.delete('item');
  searchParams.delete('view');
  const queryPart = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return `${url.pathname}${queryPart}${url.hash}`;
}

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

  const pushModalState = useCallback((viewName: string, targetUrl?: string) => {
    modalStackRef.current.push(viewName);
    const stateObj = { modalOpen: true, view: viewName };
    if (targetUrl) {
      window.history.pushState(stateObj, '', targetUrl);
    } else {
      window.history.pushState(stateObj, '');
    }
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
      } else {
        // If stack was empty (e.g. entered via direct deep link), close all active modals
        setTheaterState((prev) => ({ ...prev, isOpen: false }));
        setShortsState((prev) => ({ ...prev, isOpen: false }));
        setLightboxState((prev) => ({ ...prev, isOpen: false }));
        setViewAllState((prev) => ({ ...prev, isOpen: false }));
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

        const targetItem = fullShortsList[targetIdx !== -1 ? targetIdx : 0] || item;
        const targetUrl = buildMediaUrl(targetItem, 'shorts');
        pushModalState('shorts', targetUrl);
        setShortsState({
          isOpen: true,
          shorts: fullShortsList,
          initialIndex: targetIdx !== -1 ? targetIdx : 0,
        });
        return;
      }

      if (isVid) {
        const albumTarget = item.category || item.parentAlbum || playlistContext?.[0]?.category;
        const targetUrl = buildMediaUrl(item, albumTarget);
        pushModalState('theater', targetUrl);
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

      const targetItem = photoPlaylist[photoIdx !== -1 ? photoIdx : 0] || item;
      const albumTarget = targetItem.category || targetItem.parentAlbum;
      const targetUrl = buildMediaUrl(targetItem, albumTarget);

      pushModalState('lightbox', targetUrl);
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
      const targetUrl = buildAlbumUrl(albumTitle);
      pushModalState('viewAll', targetUrl);
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

  // Category-specific album items for quick jump menus
  const imageAlbums = useMemo(
    () =>
      albumList
        .filter((a) => a.isImage && a.items.length > 0)
        .map((a) => ({ id: a.id, name: a.name, count: a.items.length })),
    [albumList]
  );

  const videoAlbums = useMemo(
    () =>
      albumList
        .filter((a) => a.isVideo && a.items.length > 0)
        .map((a) => ({ id: a.id, name: a.name, count: a.items.length })),
    [albumList]
  );

  const shortAlbums = useMemo(
    () =>
      albumList
        .filter((a) => a.isShort && a.items.length > 0)
        .map((a) => ({ id: a.id, name: a.name, count: a.items.length })),
    [albumList]
  );

  // Smooth scrolling & highlight dispatcher for quick jump menus
  const handleJumpToAlbum = useCallback(
    (albumId: string, category: CyberFilterType) => {
      if (activeFilter !== 'all' && activeFilter !== category) {
        setActiveFilter(category);
      }

      setTimeout(() => {
        const el = document.getElementById(albumId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('album-jump-highlight');
          setTimeout(() => {
            el.classList.remove('album-jump-highlight');
          }, 2000);
        }
      }, 60);
    },
    [activeFilter]
  );

  return (
    <div
      className="w-full max-w-full overflow-x-hidden relative min-h-screen transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-page)',
        color: 'var(--text-primary)',
      }}
    >
      {/* 1. Responsive Navigation: Desktop Top Header + Mobile Fixed Bottom Dock */}
      <ResponsiveNav
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        imageAlbums={imageAlbums}
        videoAlbums={videoAlbums}
        shortAlbums={shortAlbums}
        onJumpToAlbum={handleJumpToAlbum}
      />

      {/* Main Content Stage */}
      <div className="w-full pt-2 sm:pt-4 pb-28 md:pb-16 flex flex-col min-h-screen">
        {/* 2. Structured Discovery Feed: Tagged Album Sections with Instant In-Place Filtering */}
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-8 flex flex-col gap-6 sm:gap-8">
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
                className="scroll-mt-24 transition-all duration-150"
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

      {/* Floating Global Back-To-Top Button (Elevated on mobile above bottom dock) */}
      <button
        type="button"
        onClick={handleScrollToTop}
        aria-label="Scroll back to top"
        title="Back to top"
        className={`fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 p-2.5 rounded-full shadow-lg transition-all duration-200 cursor-pointer ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
            : 'opacity-0 translate-y-4 pointer-events-none scale-90'
        }`}
        style={{
          backgroundColor: 'var(--nav-bg)',
          color: 'var(--text-primary)',
          border: '1px solid var(--nav-border)',
        }}
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
        onSelectItem={(item) => {
          setTheaterState((prev) => ({ ...prev, item }));
          const targetUrl = buildMediaUrl(item, item.category || item.parentAlbum);
          window.history.replaceState({ modalOpen: true, view: 'theater', id: item.id }, '', targetUrl);
        }}
        onSelectFolder={(folder) => {
          if (folder.items.length > 0) {
            const firstItem = folder.items[0];
            const targetUrl = buildMediaUrl(firstItem, folder.name);
            pushModalState('theater', targetUrl);
            setTheaterState({
              isOpen: true,
              item: firstItem,
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
          const currentShort = shortsState.shorts[idx];
          if (currentShort) {
            const targetUrl = buildMediaUrl(currentShort, 'shorts');
            window.history.replaceState({ modalOpen: true, view: 'shorts', id: currentShort.id }, '', targetUrl);
          }
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
            const firstItem = folder.items[0];
            const targetUrl = buildMediaUrl(firstItem, folder.name);
            pushModalState('lightbox', targetUrl);
            setLightboxState({
              isOpen: true,
              item: firstItem,
              items: folder.items,
              initialIndex: 0,
            });
          }
        }}
        onIndexChange={(idx) => {
          setLightboxState((prev) => {
            const nextItem = prev.items[idx] || prev.item;
            if (nextItem) {
              const targetUrl = buildMediaUrl(nextItem, nextItem.category || nextItem.parentAlbum);
              window.history.replaceState({ modalOpen: true, view: 'lightbox', id: nextItem.id }, '', targetUrl);
            }
            return {
              ...prev,
              initialIndex: idx,
              item: nextItem,
            };
          });
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
