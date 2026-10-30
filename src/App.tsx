import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMediaData } from './useMediaData';
import { organizeVaultFeed } from './utils/vaultFeedOrganizer';
import { CyberVideoPlayer } from './components/CyberVideoPlayer';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { MediaModal } from './components/MediaModal';
import { FullAlbumViewModal } from './components/FullAlbumViewModal';
import { DeepSpaceTreeExplorer } from './components/DeepSpaceTreeExplorer';
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

  const handleCloseModal = useCallback((type: 'theater' | 'lightbox' | 'shorts' | 'viewAll') => {
    if (historyDepthRef.current > 0) {
      window.history.back();
    } else {
      if (type === 'lightbox') setLightboxState((prev) => ({ ...prev, isOpen: false }));
      else if (type === 'theater') setTheaterState((prev) => ({ ...prev, isOpen: false }));
      else if (type === 'shorts') setShortsState((prev) => ({ ...prev, isOpen: false }));
      else if (type === 'viewAll') setViewAllState((prev) => ({ ...prev, isOpen: false }));

      const { albumQuery } = parseUrlState();
      if ((type === 'lightbox' || type === 'theater' || type === 'shorts') && albumQuery && albumQuery.toLowerCase() !== 'shorts') {
        const targetUrl = buildAlbumUrl(albumQuery);
        window.history.replaceState({ album: albumQuery }, '', targetUrl);
      } else {
        const targetUrl = buildHomeUrl();
        window.history.replaceState({ tab: 'all' }, '', targetUrl);
      }
    }
  }, []);

  // Organize raw catalog data into structured discovery feed
  const rawFeed = useMemo(() => organizeVaultFeed(data, sortOrder), [data, sortOrder]);

  // Universal Media Player / Lightbox Dispatcher
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
        const targetUrl = buildMediaUrl(targetItem, preferredAlbum || 'shorts');
        if (pushHistory) {
          pushModalState('shorts', targetUrl);
        }
        setShortsState({
          isOpen: true,
          shorts: fullShortsList,
          initialIndex: targetIdx !== -1 ? targetIdx : 0,
        });
        return;
      }

      if (isVid) {
        const albumTarget = preferredAlbum || item.category || item.parentAlbum || playlistContext?.[0]?.category;
        const targetUrl = buildMediaUrl(item, albumTarget);
        if (pushHistory) {
          pushModalState('theater', targetUrl);
        }
        setTheaterState({
          isOpen: true,
          item,
          playlist: playlistContext || [item],
          albumContext: albumTarget,
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
      const albumTarget = preferredAlbum || targetItem.category || targetItem.parentAlbum;
      const targetUrl = buildMediaUrl(targetItem, albumTarget);

      if (pushHistory) {
        pushModalState('lightbox', targetUrl);
      }
      setLightboxState({
        isOpen: true,
        item,
        items: photoPlaylist,
        initialIndex: photoIdx !== -1 ? photoIdx : 0,
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

      // 2. No mediaQuery: ensure all media viewer modals are CLOSED
      setTheaterState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      setLightboxState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      setShortsState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));

      // 3. If albumQuery is present (and no mediaQuery), ensure the album modal is OPEN
      if (albumQuery) {
        const isShortsAlbum = albumQuery.toLowerCase() === 'shorts' || getAlbumSlug(albumQuery) === 'shorts';
        if (isShortsAlbum) {
          setViewAllState({
            isOpen: true,
            title: 'Shorts',
            items: rawFeed.shorts,
            variant: 'shorts',
          });
        } else {
          const folderToOpen = findMatchingFolder(rawFeed.albums, albumQuery);
          if (folderToOpen) {
            setViewAllState({
              isOpen: true,
              title: folderToOpen.folder.name,
              subtitle: undefined,
              items: folderToOpen.folder.items,
              variant: folderToOpen.folder.variant,
              hasMultipleTypes: folderToOpen.folder.hasMultipleTypes,
              typeCounts: folderToOpen.folder.typeCounts,
            });
          }
        }
        return;
      }

      // 4. No albumQuery: ensure album modal is CLOSED
      setViewAllState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
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
    <div className="relative w-full h-[100dvh] overflow-hidden select-none bg-black text-white">
      {/* 1. High-resolution cosmic galaxy background fixed full viewport */}
      <img
        src="/assets/galaxy.jpg"
        alt="Deep Space Cosmic Background"
        className="fixed inset-0 w-[100vw] h-[100dvh] object-cover pointer-events-none select-none"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100dvh',
          objectFit: 'cover',
          zIndex: -1,
        }}
      />
      <div
        className="fixed inset-0 bg-black/40 pointer-events-none"
        style={{ position: 'fixed', inset: 0, zIndex: -1 }}
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
          onOpenPhoto={(photo, playlist, index) => {
            const albumTarget = photo.category || photo.parentAlbum;
            const targetUrl = buildMediaUrl(photo, albumTarget);
            pushModalState('lightbox', targetUrl);
            setLightboxState({
              isOpen: true,
              item: photo,
              items: playlist,
              initialIndex: index,
              albumContext: albumTarget,
            });
          }}
          onOpenVideo={(video, playlist) => {
            const albumTarget = video.category || video.parentAlbum;
            const targetUrl = buildMediaUrl(video, albumTarget);
            pushModalState('theater', targetUrl);
            setTheaterState({
              isOpen: true,
              item: video,
              playlist,
              albumContext: albumTarget,
            });
          }}
          onOpenShort={(short, shorts, index) => {
            const targetUrl = buildMediaUrl(short, 'shorts');
            pushModalState('shorts', targetUrl);
            setShortsState({
              isOpen: true,
              shorts,
              initialIndex: index,
            });
          }}
        />
      )}

      {/* 3. Single Global Video Player (Clips) - STRICTLY UNTOUCHED */}
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

      {/* 4. Single Global Shorts Feed Player (Reels) - STRICTLY UNTOUCHED */}
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

      {/* 5. Single High-Definition Image Lightbox - STRICTLY UNTOUCHED */}
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

      {/* 6. FullAlbumViewModal (for backward compatibility / deep links) */}
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
    </div>
  );
}

export default App;
