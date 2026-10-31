import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMediaData } from './useMediaData';
import { organizeVaultFeed } from './utils/vaultFeedOrganizer';
import { CyberVideoPlayer } from './components/CyberVideoPlayer';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { MediaModal } from './components/MediaModal';
import { FullAlbumViewModal } from './components/FullAlbumViewModal';
import { DeepSpaceTreeExplorer } from './components/DeepSpaceTreeExplorer';
import { CyberCommandPalette } from './components/CyberCommandPalette';
import { AmbientNoticesHUD } from './components/AmbientNoticesHUD';
import { PlayerErrorBoundary } from './components/PlayerErrorBoundary';
import galaxyBg from './assets/galaxy.jpg';
import type { StageMediaItem, SortOrder, MediaFolderEntry } from './types';
import { isVideoExtension } from './utils/mediaTypeDetector';
import {
  parseUrlState,
  syncUrlState,
  findMatchingMediaItem,
  findMatchingFolder,
  getAlbumSlug,
  getMediaSlug,
} from './utils/urlRouter';

function buildHomeUrl(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

function buildMediaUrl(item: StageMediaItem, albumContext?: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const albumTarget = albumContext || item.category || item.parentAlbum;
  if (albumTarget) {
    searchParams.set('album', getAlbumSlug(albumTarget));
  }
  searchParams.set('media', getMediaSlug(item));
  searchParams.delete('tab');
  searchParams.delete('filter');
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
  searchParams.delete('tab');
  searchParams.delete('filter');
  const queryPart = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return `${url.pathname}${queryPart}${url.hash}`;
}

function App() {
  const { data, isLoading, isDynamicReady } = useMediaData();

  const [sortOrder] = useState<SortOrder>(() => {
    const { sortQuery } = parseUrlState();
    return (sortQuery === 'oldest' || sortQuery === 'name-asc') ? sortQuery : 'newest';
  });

  // Modal / Player States - STRICTLY PRESERVED
  const [theaterState, setTheaterState] = useState<{
    isOpen: boolean;
    item: StageMediaItem | null;
    playlist: StageMediaItem[];
    albumContext?: string;
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
    albumContext?: string;
  }>({
    isOpen: false,
    item: null,
    items: [],
    initialIndex: 0,
  });

  // Dedicated "View All" Album View State for deep linking compatibility
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

  // Active modal history depth tracker for smart browser back navigation
  const historyDepthRef = useRef<number>(0);
  const isPopStateRef = useRef<boolean>(false);

  const pushModalState = useCallback((viewName: string, targetUrl?: string) => {
    historyDepthRef.current++;
    const stateObj = { modalOpen: true, view: viewName };
    if (targetUrl) {
      window.history.pushState(stateObj, '', targetUrl);
    } else {
      window.history.pushState(stateObj, '');
    }
  }, []);

  const handleCloseModal = useCallback((_type?: 'theater' | 'lightbox' | 'shorts' | 'viewAll') => {
    // 1. Immediately reset all modal states to completely unmount players
    setTheaterState({ isOpen: false, item: null, playlist: [] });
    setShortsState({ isOpen: false, shorts: [], initialIndex: 0 });
    setLightboxState({ isOpen: false, item: null, items: [], initialIndex: 0 });
    setViewAllState({ isOpen: false, title: '', items: [] });
    historyDepthRef.current = 0;

    // 2. Cleanly clear all player query parameters (media=..., album=...) from URL
    // using replaceState so closing NEVER triggers nested back-stack loops
    const targetUrl = buildHomeUrl();
    window.history.replaceState({ tab: 'all' }, '', targetUrl);
  }, []);

  // Cyberpunk Command Palette State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Subtle Mouse Parallax Canvas on desktop (pointer: fine)
  const galaxyBgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (!isFinePointer) return;

    let rafId: number | null = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      const normX = (e.clientX - halfW) / halfW;
      const normY = (e.clientY - halfH) / halfH;

      // Subtle hardware-accelerated shift clamped to max 14px
      targetX = -normX * 14;
      targetY = -normY * 14;

      if (!rafId) {
        rafId = requestAnimationFrame(updateParallax);
      }
    };

    const updateParallax = () => {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;

      if (galaxyBgRef.current) {
        galaxyBgRef.current.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0) scale(1.05)`;
      }

      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        rafId = requestAnimationFrame(updateParallax);
      } else {
        rafId = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Global Command Palette Shortcut (Ctrl+K / Cmd+K, or "/" when no input is focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === '/') {
        const targetTag = (document.activeElement?.tagName || '').toLowerCase();
        const isEditable = document.activeElement?.getAttribute('contenteditable') === 'true';
        if (targetTag !== 'input' && targetTag !== 'textarea' && !isEditable) {
          e.preventDefault();
          setIsCommandPaletteOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Organize raw catalog data into structured discovery feed
  const rawFeed = useMemo(() => organizeVaultFeed(data, sortOrder), [data, sortOrder]);

  // Universal Media Player / Lightbox Dispatcher with strict mutual exclusivity
  const openMediaItem = useCallback(
    (item: StageMediaItem, playlistContext?: StageMediaItem[], preferredAlbum?: string, pushHistory = true) => {
      const isShort = Boolean(
        item.mediaType === 'short' ||
        item.category?.toLowerCase().includes('short') ||
        item.category?.toLowerCase().includes('reel') ||
        item.url?.toLowerCase().includes('/shorts/') ||
        item.id?.toLowerCase().includes('shorts')
      );

      const isVid =
        !isShort &&
        (item.type === 'video' ||
         item.mediaType === 'clip' ||
         isVideoExtension(item.url || item.id || item.path));

      if (isShort) {
        const fullShortsList =
          playlistContext && playlistContext.length > 0
            ? playlistContext
            : rawFeed.shorts.length > 0
            ? rawFeed.shorts
            : [item];

        let targetIdx = fullShortsList.findIndex(
          (s) => (s.id && item.id && s.id === item.id) || (s.url && item.url && s.url === item.url)
        );

        if (targetIdx === -1) {
          const itemQuery = item.title || item.name || item.id || '';
          const matchResult = findMatchingMediaItem(fullShortsList, itemQuery);
          if (matchResult) {
            targetIdx = matchResult.index;
          }
        }

        const targetIndex = targetIdx !== -1 ? targetIdx : 0;
        const targetItem = fullShortsList[targetIndex] || item;
        const targetUrl = buildMediaUrl(targetItem, preferredAlbum || 'shorts');
        if (pushHistory) {
          pushModalState('shorts', targetUrl);
        }

        // STRICT MUTUAL EXCLUSIVITY: Opening short -> set activeVideo = null, isVideoOpen = false, clear lightbox & viewAll
        setTheaterState({ isOpen: false, item: null, playlist: [] });
        setLightboxState({ isOpen: false, item: null, items: [], initialIndex: 0 });
        setViewAllState({ isOpen: false, title: '', items: [] });
        setShortsState({
          isOpen: true,
          shorts: fullShortsList,
          initialIndex: targetIndex,
        });
        return;
      }

      if (isVid) {
        const albumTarget = preferredAlbum || item.category || item.parentAlbum || playlistContext?.[0]?.category;
        const targetUrl = buildMediaUrl(item, albumTarget);
        if (pushHistory) {
          pushModalState('theater', targetUrl);
        }

        // STRICT MUTUAL EXCLUSIVITY: Opening video -> set activeShort = null, isShortsOpen = false, clear lightbox & viewAll
        setShortsState({ isOpen: false, shorts: [], initialIndex: 0 });
        setLightboxState({ isOpen: false, item: null, items: [], initialIndex: 0 });
        setViewAllState({ isOpen: false, title: '', items: [] });
        setTheaterState({
          isOpen: true,
          item,
          playlist: playlistContext || [item],
          albumContext: albumTarget,
        });
        return;
      }

      // Photographic / Image asset: Opening photo -> clear both active video and short states
      const photoPlaylist =
        playlistContext && playlistContext.length > 0
          ? playlistContext
          : [item];

      const photoIdx = photoPlaylist.findIndex(
        (p) => p.id === item.id || p.url === item.url
      );

      const targetIndex = photoIdx !== -1 ? photoIdx : 0;
      const targetItem = photoPlaylist[targetIndex] || item;
      const albumTarget = preferredAlbum || targetItem.category || targetItem.parentAlbum;
      const targetUrl = buildMediaUrl(targetItem, albumTarget);

      if (pushHistory) {
        pushModalState('lightbox', targetUrl);
      }

      // STRICT MUTUAL EXCLUSIVITY: Opening photo -> clear both active video and short states
      setTheaterState({ isOpen: false, item: null, playlist: [] });
      setShortsState({ isOpen: false, shorts: [], initialIndex: 0 });
      setViewAllState({ isOpen: false, title: '', items: [] });
      setLightboxState({
        isOpen: true,
        item: targetItem,
        items: photoPlaylist,
        initialIndex: targetIndex,
        albumContext: albumTarget,
      });
    },
    [rawFeed.shorts, pushModalState]
  );

  const handleSelectItem = useCallback(
    (item: StageMediaItem, playlistContext?: StageMediaItem[], preferredAlbum?: string) => {
      openMediaItem(item, playlistContext, preferredAlbum, true);
    },
    [openMediaItem]
  );

  const handleOpenPhoto = useCallback(
    (photo: StageMediaItem, playlist: StageMediaItem[], _index: number) => {
      openMediaItem(photo, playlist, photo.category || photo.parentAlbum, true);
    },
    [openMediaItem]
  );

  const handleOpenVideo = useCallback(
    (video: StageMediaItem, playlist: StageMediaItem[]) => {
      openMediaItem(video, playlist, video.category || video.parentAlbum, true);
    },
    [openMediaItem]
  );

  const handleOpenShort = useCallback(
    (short: StageMediaItem, shorts: StageMediaItem[], _index: number) => {
      openMediaItem(short, shorts, 'shorts', true);
    },
    [openMediaItem]
  );

  // Dedicated "View All" Album Navigator (for deep link routing)
  const handleOpenViewAll = useCallback(
    (
      albumTitle: string,
      albumItems: StageMediaItem[],
      variant: 'standard' | 'shorts' | 'photo' = 'standard',
      subtitle?: string,
      hasMultipleTypes?: boolean,
      typeCounts?: { photos: number; clips: number; shorts: number },
      pushHistory = true
    ) => {
      const targetUrl = buildAlbumUrl(albumTitle);
      if (pushHistory) {
        pushModalState('viewAll', targetUrl);
      }
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

  // Intercept hardware/browser Back & Forward buttons across the entire website
  useEffect(() => {
    const handlePopState = () => {
      isPopStateRef.current = true;
      if (historyDepthRef.current > 0) {
        historyDepthRef.current--;
      }

      const { albumQuery, mediaQuery } = parseUrlState();

      // 1. If mediaQuery is present, open or switch to that media item directly
      if (mediaQuery) {
        const isShortsAlbum = albumQuery
          ? albumQuery.toLowerCase() === 'shorts' || getAlbumSlug(albumQuery) === 'shorts'
          : false;

        let scopedPool: StageMediaItem[] | undefined;
        if (albumQuery) {
          if (isShortsAlbum) {
            scopedPool = rawFeed.shorts;
          } else {
            const folderMatch = findMatchingFolder(rawFeed.albums, albumQuery);
            if (folderMatch) {
              scopedPool = folderMatch.folder.items;
            }
          }
        }

        const pool = scopedPool || rawFeed.allMediaPool;
        const matched = findMatchingMediaItem(pool, mediaQuery);
        if (matched) {
          openMediaItem(matched.item, pool, albumQuery || undefined, false);
          return;
        }
      }

      // 2. If the URL contains no media param, guarantee that ALL modal overlays are unmounted
      setTheaterState({ isOpen: false, item: null, playlist: [] });
      setShortsState({ isOpen: false, shorts: [], initialIndex: 0 });
      setLightboxState({ isOpen: false, item: null, items: [], initialIndex: 0 });
      setViewAllState({ isOpen: false, title: '', items: [] });
      historyDepthRef.current = 0;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [rawFeed, openMediaItem]);

  // Deep Link Synchronizer: Parse Initial URL on load
  const hasInitializedUrlRef = useRef(false);

  useEffect(() => {
    if (isLoading || !data || !rawFeed || rawFeed.allMediaPool.length === 0 || !isDynamicReady) return;
    if (hasInitializedUrlRef.current) return;

    const { albumQuery, mediaQuery } = parseUrlState();
    if (!albumQuery && !mediaQuery) {
      hasInitializedUrlRef.current = true;
      return;
    }

    // 1. Resolve album context if albumQuery is provided
    let scopedPool: StageMediaItem[] | undefined;
    let resolvedFolder: { folder: MediaFolderEntry; index: number } | null = null;
    const isShortsAlbum = albumQuery
      ? albumQuery.toLowerCase() === 'shorts' || getAlbumSlug(albumQuery) === 'shorts'
      : false;

    if (albumQuery) {
      if (isShortsAlbum) {
        scopedPool = rawFeed.shorts;
      } else {
        resolvedFolder = findMatchingFolder(rawFeed.albums, albumQuery);
        if (resolvedFolder) {
          scopedPool = resolvedFolder.folder.items;
        }
      }
    }

    if (mediaQuery) {
      let matchedItem: StageMediaItem | null = null;
      let matchedContext: StageMediaItem[] | undefined;

      if (albumQuery) {
        if (scopedPool && scopedPool.length > 0) {
          const scopedMatch = findMatchingMediaItem(scopedPool, mediaQuery);
          if (scopedMatch) {
            matchedItem = scopedMatch.item;
            matchedContext = scopedPool;
          }
        }
      } else {
        const allItems: StageMediaItem[] = [
          ...(rawFeed.shorts || []),
          ...(rawFeed.latestReleases || []),
          ...rawFeed.albums.flatMap((f) => f.items),
          ...(rawFeed.allMediaPool || []),
        ];
        const seen = new Set<string>();
        const uniquePool = allItems.filter((item) => {
          const key = item.id || item.url;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const fallbackMatch = findMatchingMediaItem(uniquePool, mediaQuery);
        if (fallbackMatch) {
          matchedItem = fallbackMatch.item;
          if (matchedItem.mediaType === 'short') {
            matchedContext = rawFeed.shorts;
          } else if (matchedItem.category) {
            const folderMatch = findMatchingFolder(rawFeed.albums, matchedItem.category);
            if (folderMatch) {
              matchedContext = folderMatch.folder.items;
            }
          }
        }
      }

      if (matchedItem) {
        hasInitializedUrlRef.current = true;
        const preferredAlbum = albumQuery || (matchedItem.category ? getAlbumSlug(matchedItem.category) : undefined);
        const mediaUrl = buildMediaUrl(matchedItem, preferredAlbum);

        window.history.replaceState({ tab: 'all' }, '', buildHomeUrl());

        if (preferredAlbum && preferredAlbum.toLowerCase() !== 'shorts') {
          const albumUrl = buildAlbumUrl(preferredAlbum);
          window.history.pushState({ album: preferredAlbum }, '', albumUrl);
          historyDepthRef.current++;

          const folder = resolvedFolder || findMatchingFolder(rawFeed.albums, preferredAlbum);
          if (folder) {
            setViewAllState({
              isOpen: true,
              title: folder.folder.name,
              items: folder.folder.items,
              variant: folder.folder.variant,
              hasMultipleTypes: folder.folder.hasMultipleTypes,
              typeCounts: folder.folder.typeCounts,
            });
          }
        }

        window.history.pushState({ media: matchedItem.id, album: preferredAlbum }, '', mediaUrl);
        historyDepthRef.current++;

        openMediaItem(matchedItem, matchedContext, preferredAlbum, false);
        return;
      }
    }

    if (albumQuery) {
      hasInitializedUrlRef.current = true;
      const albumUrl = buildAlbumUrl(albumQuery);
      window.history.replaceState({ tab: 'all' }, '', buildHomeUrl());
      window.history.pushState({ album: albumQuery }, '', albumUrl);
      historyDepthRef.current++;

      if (isShortsAlbum) {
        handleOpenViewAll('Shorts', rawFeed.shorts, 'shorts', undefined, undefined, undefined, false);
      } else {
        const folderToOpen = resolvedFolder || findMatchingFolder(rawFeed.albums, albumQuery);
        if (folderToOpen) {
          handleOpenViewAll(
            folderToOpen.folder.name,
            folderToOpen.folder.items,
            folderToOpen.folder.variant,
            undefined,
            folderToOpen.folder.hasMultipleTypes,
            folderToOpen.folder.typeCounts,
            false
          );
        }
      }
      return;
    }

    hasInitializedUrlRef.current = true;
  }, [isLoading, isDynamicReady, data, rawFeed, openMediaItem, handleOpenViewAll]);

  // URL state synchronizer: Keeps browser URL bar aligned with open modals
  useEffect(() => {
    if (!hasInitializedUrlRef.current) return;
    if (isPopStateRef.current) {
      isPopStateRef.current = false;
      return;
    }

    if (theaterState.isOpen && theaterState.item) {
      syncUrlState({
        album: theaterState.albumContext || theaterState.item.category || theaterState.item.parentAlbum,
        mediaItem: theaterState.item,
        sort: sortOrder,
        replace: true,
      });
    } else if (lightboxState.isOpen && lightboxState.item) {
      syncUrlState({
        album: lightboxState.albumContext || lightboxState.item.category || lightboxState.item.parentAlbum,
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
    theaterState.albumContext,
    lightboxState.isOpen,
    lightboxState.item,
    lightboxState.albumContext,
    shortsState.isOpen,
    shortsState.initialIndex,
    shortsState.shorts,
    viewAllState.isOpen,
    viewAllState.title,
    sortOrder,
  ]);

  const initialAlbumTarget = useMemo(() => {
    const { albumQuery } = parseUrlState();
    return albumQuery || undefined;
  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden select-none text-white bg-transparent">
      {/* 1. High-resolution cosmic galaxy background fixed full viewport with cursor parallax */}
      <img
        ref={galaxyBgRef}
        src={galaxyBg}
        alt="Deep Space Cosmic Background"
        className="fixed inset-0 w-[100vw] h-[100dvh] object-cover pointer-events-none select-none transition-transform duration-300 ease-out"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100dvh',
          objectFit: 'cover',
          zIndex: -1,
          transform: 'translate3d(0, 0, 0) scale(1.05)',
          willChange: 'transform',
        }}
      />

      {/* 2. Deep Space Tree Explorer (Pure Underlined Text Horizontal Directory) */}
      {isLoading && !data ? (
        <div className="flex items-center justify-center w-full h-full text-white/50 font-mono text-sm tracking-widest uppercase">
          Loading...
        </div>
      ) : (
        <DeepSpaceTreeExplorer
          items={rawFeed.allMediaPool}
          initialAlbum={initialAlbumTarget}
          isNavDisabled={isCommandPaletteOpen || theaterState.isOpen || shortsState.isOpen || lightboxState.isOpen || viewAllState.isOpen}
          onOpenPhoto={handleOpenPhoto}
          onOpenVideo={handleOpenVideo}
          onOpenShort={handleOpenShort}
        />
      )}

      {/* CASE A: Ambient Notices HUD on Homepage Explorer (Fixed bottom-left, hidden when any viewer is open or on mobile) */}
      {!theaterState.isOpen && !shortsState.isOpen && !lightboxState.isOpen && !viewAllState.isOpen && !isCommandPaletteOpen && (
        <div className="fixed bottom-6 left-6 z-20 hidden md:block">
          <AmbientNoticesHUD />
        </div>
      )}

      {/* 3. Single Global Video Player (Clips) - Completely unmounted when closed */}
      {theaterState.isOpen && theaterState.item && (
        <PlayerErrorBoundary onClose={() => handleCloseModal('theater')} fallbackTitle="Video Player Error">
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
                openMediaItem(firstItem, folder.items, folder.name, true);
              }
            }}
          />
        </PlayerErrorBoundary>
      )}

      {/* 4. Single Global Shorts Feed Player (Reels) - Completely unmounted when closed */}
      {shortsState.isOpen && shortsState.shorts.length > 0 && (
        <PlayerErrorBoundary onClose={() => handleCloseModal('shorts')} fallbackTitle="Shorts Player Error">
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
        </PlayerErrorBoundary>
      )}

      {/* 5. Single High-Definition Image Lightbox - Completely unmounted when closed */}
      {lightboxState.isOpen && lightboxState.item && (
        <PlayerErrorBoundary onClose={() => handleCloseModal('lightbox')} fallbackTitle="Image Viewer Error">
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
                openMediaItem(firstItem, folder.items, folder.name, true);
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
        </PlayerErrorBoundary>
      )}

      {/* 6. FullAlbumViewModal (for backward compatibility / deep links) */}
      {viewAllState.isOpen && (
        <FullAlbumViewModal
          isOpen={viewAllState.isOpen}
          title={viewAllState.title}
          subtitle={viewAllState.subtitle}
          items={viewAllState.items}
          variant={viewAllState.variant}
          hasMultipleTypes={viewAllState.hasMultipleTypes}
          typeCounts={viewAllState.typeCounts}
          onClose={() => handleCloseModal('viewAll')}
          onSelectItem={(item, currentList) => handleSelectItem(item, currentList, viewAllState.title)}
        />
      )}

      {/* 7. Cyberpunk Command Palette (Ctrl+K / Cmd+K / "/") */}
      <CyberCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={rawFeed.allMediaPool}
        allShorts={rawFeed.shorts}
        onOpenPhoto={handleOpenPhoto}
        onOpenVideo={handleOpenVideo}
        onOpenShort={handleOpenShort}
      />
    </div>
  );
}

export default App;
