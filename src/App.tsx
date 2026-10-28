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
import { StartScreen } from './components/StartScreen';
import { AmbientSpotlightHero } from './components/AmbientSpotlightHero';
import { HomeFilterChips } from './components/HomeFilterChips';
import { ShortsReelsRibbon } from './components/ShortsReelsRibbon';
import { DynamicVideoGrid } from './components/DynamicVideoGrid';
import { PhotoShowcaseRow } from './components/PhotoShowcaseRow';
import { VideoAlbumShowcase } from './components/VideoAlbumShowcase';
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
import { ChevronUp } from 'lucide-react';

function buildTabUrl(tab: CyberFilterType): string {
  if (typeof window === 'undefined') return '/';
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  searchParams.delete('album');
  searchParams.delete('media');
  searchParams.delete('item');
  searchParams.delete('view');
  if (tab === 'clips') {
    searchParams.set('tab', 'videos');
  } else if (tab === 'images') {
    searchParams.set('tab', 'photos');
  } else if (tab === 'shorts') {
    searchParams.set('tab', 'shorts');
  } else {
    searchParams.delete('tab');
    searchParams.delete('filter');
  }
  const queryPart = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return `${url.pathname}${queryPart}`;
}

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

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CyberFilterType>(() => {
    const { tabQuery } = parseUrlState();
    if (tabQuery === 'clips' || tabQuery === 'images' || tabQuery === 'shorts') {
      return tabQuery;
    }
    return 'all';
  });
  const [sortOrder] = useState<SortOrder>(() => {
    const { sortQuery } = parseUrlState();
    return (sortQuery === 'oldest' || sortQuery === 'name-asc') ? sortQuery : 'newest';
  });

  // Modal / Player States
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

  const handleFilterChange = useCallback((newFilter: CyberFilterType, pushHistory = true) => {
    setActiveFilter(newFilter);
    if (pushHistory && typeof window !== 'undefined') {
      const targetUrl = buildTabUrl(newFilter);
      const currentFull = `${window.location.pathname}${window.location.search}`;
      if (targetUrl !== currentFull) {
        historyDepthRef.current++;
        window.history.pushState({ tab: newFilter }, '', targetUrl);
      }
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

  // Dedicated "View All" Album Navigator
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

      const { albumQuery, mediaQuery, tabQuery } = parseUrlState();

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

      // 2. No mediaQuery: ensure all media viewer modals are CLOSED!
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

      // 4. No albumQuery: ensure album modal is CLOSED!
      setViewAllState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));

      // 5. Restore activeFilter according to tabQuery (or default to 'all')
      if (tabQuery === 'clips' || tabQuery === 'images' || tabQuery === 'shorts') {
        setActiveFilter(tabQuery);
      } else {
        setActiveFilter('all');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [rawFeed, openMediaItem]);

  // Deep Link Synchronizer: Parse Initial URL on load
  const hasInitializedUrlRef = useRef(false);

  useEffect(() => {
    // If mediaData or rawFeed is still loading/empty, DO NOT execute a fallback lookup or update URL history
    if (isLoading || !data || !rawFeed || rawFeed.allMediaPool.length === 0 || !isDynamicReady) return;
    if (hasInitializedUrlRef.current) return;

    const { albumQuery, mediaQuery, tabQuery } = parseUrlState();
    if (!albumQuery && !mediaQuery) {
      if (tabQuery && (tabQuery === 'clips' || tabQuery === 'images' || tabQuery === 'shorts')) {
        setActiveFilter(tabQuery);
      }
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

      // Primary check: When albumQuery is explicitly specified, strictly restrict media resolution to that album
      if (albumQuery) {
        if (scopedPool && scopedPool.length > 0) {
          const scopedMatch = findMatchingMediaItem(scopedPool, mediaQuery);
          if (scopedMatch) {
            matchedItem = scopedMatch.item;
            matchedContext = scopedPool;
          }
        }
        // CRITICAL: When albumQuery is specified, NEVER fall back to global search!
        // Strictly prevent cross-album redirection.
      } else {
        // Fall back to global search ONLY when NO albumQuery was specified
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

      // Dispatch media selection if an item was found
      if (matchedItem) {
        hasInitializedUrlRef.current = true;
        const preferredAlbum = albumQuery || (matchedItem.category ? getAlbumSlug(matchedItem.category) : undefined);
        const mediaUrl = buildMediaUrl(matchedItem, preferredAlbum);

        // Synthetic history hierarchy on cold load:
        // Entry 0: Home ('/')
        window.history.replaceState({ tab: 'all' }, '', buildHomeUrl());

        // Entry 1: Album (if applicable and not generic shorts)
        if (preferredAlbum && preferredAlbum.toLowerCase() !== 'shorts') {
          const albumUrl = buildAlbumUrl(preferredAlbum);
          window.history.pushState({ album: preferredAlbum }, '', albumUrl);
          historyDepthRef.current++;

          // Preload viewAllState underneath so closing media reveals album!
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

        // Entry 2: Media item
        window.history.pushState({ media: matchedItem.id, album: preferredAlbum }, '', mediaUrl);
        historyDepthRef.current++;

        // Open media without pushing an additional duplicate history entry
        openMediaItem(matchedItem, matchedContext, preferredAlbum, false);
        return;
      }
    }

    // 4. If media was not found or only album was specified, open the album view strictly within requested album
    if (albumQuery) {
      hasInitializedUrlRef.current = true;
      const albumUrl = buildAlbumUrl(albumQuery);
      // Synthetic history hierarchy:
      // Entry 0: Home ('/')
      window.history.replaceState({ tab: 'all' }, '', buildHomeUrl());
      // Entry 1: Album
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

    // Cold-load with tab query
    if (tabQuery && tabQuery !== 'all') {
      window.history.replaceState({ tab: 'all' }, '', buildHomeUrl());
      window.history.pushState({ tab: tabQuery }, '', buildTabUrl(tabQuery));
      historyDepthRef.current++;
      setActiveFilter(tabQuery);
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

  const handleResetHome = useCallback(() => {
    if (theaterState.isOpen || lightboxState.isOpen || shortsState.isOpen || viewAllState.isOpen) {
      setTheaterState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      setLightboxState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      setShortsState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      setViewAllState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
    }
    if (activeFilter !== 'all') {
      handleFilterChange('all', true);
    } else {
      const homeUrl = buildHomeUrl();
      if (window.location.search || window.location.hash) {
        historyDepthRef.current++;
        window.history.pushState({ tab: 'all' }, '', homeUrl);
      }
    }
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [
    theaterState.isOpen,
    lightboxState.isOpen,
    shortsState.isOpen,
    viewAllState.isOpen,
    activeFilter,
    handleFilterChange,
  ]);

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
        handleFilterChange(category, true);
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
    [activeFilter, handleFilterChange]
  );

  // Helper to check if an item is a vertical short / reel
  const isShortItem = useCallback((item: StageMediaItem): boolean => {
    return Boolean(
      item.mediaType === 'short' ||
      item.category?.toLowerCase().includes('short') ||
      item.category?.toLowerCase().includes('reel') ||
      item.parentAlbum?.toLowerCase().includes('short') ||
      item.url?.toLowerCase().includes('/shorts/') ||
      item.id?.toLowerCase().includes('shorts') ||
      item.path?.toLowerCase().includes('shorts')
    );
  }, []);

  // Helper to check if an item is a video
  const isVideoItem = useCallback((item: StageMediaItem): boolean => {
    return Boolean(
      item.type === 'video' ||
      item.mediaType === 'clip' ||
      isVideoExtension(item.url || item.path || item.id || item.name || '')
    );
  }, []);

  // Full pool of landscape (non-short) video clips from across the entire directory
  const landscapeVideos = useMemo(() => {
    const pool: StageMediaItem[] = [];
    const seen = new Set<string>();

    // 1. Gather all clips from video vault folders (these are landscape video albums)
    rawFeed.videoVaultFolders.forEach((folder) => {
      folder.items.forEach((item) => {
        const key = item.id || item.url;
        if (key && seen.has(key)) return;
        if (!isShortItem(item) && isVideoItem(item)) {
          if (key) seen.add(key);
          pool.push(item);
        }
      });
    });

    // 2. Also check any other non-short videos in allMediaPool
    rawFeed.allMediaPool.forEach((item) => {
      const key = item.id || item.url;
      if (key && seen.has(key)) return;
      if (!isShortItem(item) && isVideoItem(item)) {
        if (key) seen.add(key);
        pool.push(item);
      }
    });

    return pool;
  }, [rawFeed.videoVaultFolders, rawFeed.allMediaPool, isShortItem, isVideoItem]);

  // Featured spotlight video for Layer 1 hero banner (Picks a random landscape video on each visit)
  const [spotlightVideo, setSpotlightVideo] = useState<StageMediaItem | null>(null);

  useEffect(() => {
    if (spotlightVideo) return;

    if (landscapeVideos.length > 0) {
      const randomIndex = Math.floor(Math.random() * landscapeVideos.length);
      setSpotlightVideo(landscapeVideos[randomIndex]);
    } else if (rawFeed.allMediaPool.length > 0) {
      const fallbackVideos = rawFeed.allMediaPool.filter((item) => isVideoItem(item) && !isShortItem(item));
      if (fallbackVideos.length > 0) {
        const randomIndex = Math.floor(Math.random() * fallbackVideos.length);
        setSpotlightVideo(fallbackVideos[randomIndex]);
      }
    }
  }, [landscapeVideos, rawFeed.allMediaPool, spotlightVideo, isVideoItem, isShortItem]);

  // Context playlist for the active spotlight video
  const spotlightPlaylist = useMemo(() => {
    if (!spotlightVideo) return landscapeVideos.length > 0 ? landscapeVideos : rawFeed.allMediaPool;
    if (spotlightVideo.category) {
      const folder = findMatchingFolder(rawFeed.albums, spotlightVideo.category);
      if (folder && folder.folder.items.length > 0) {
        return folder.folder.items;
      }
    }
    return landscapeVideos.length > 0 ? landscapeVideos : rawFeed.allMediaPool;
  }, [spotlightVideo, landscapeVideos, rawFeed.albums, rawFeed.allMediaPool]);

  // Featured videos collection for Layer 4 dynamic video grid
  const featuredVideos = landscapeVideos;

  // Category counts for Layer 2 glass filter navigation chips
  const filterCounts = useMemo(() => {
    return {
      all: rawFeed.allMediaPool.length,
      shorts: rawFeed.shorts.length,
      videos: rawFeed.videoVaultFolders.reduce((acc, f) => acc + f.items.length, 0),
      photos: rawFeed.photoVaultFolders.reduce((acc, f) => acc + f.items.length, 0),
    };
  }, [rawFeed]);

  // Hero "Explore Album" action dispatcher
  const handleHeroExplore = useCallback(
    (albumName: string) => {
      const folder = findMatchingFolder(rawFeed.albums, albumName);
      if (folder) {
        handleOpenViewAll(
          folder.folder.name,
          folder.folder.items,
          folder.folder.variant,
          undefined,
          folder.folder.hasMultipleTypes,
          folder.folder.typeCounts
        );
      }
    },
    [rawFeed.albums, handleOpenViewAll]
  );

  return (
    <div
      className="w-full max-w-full overflow-x-hidden relative min-h-screen transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-page)',
        color: 'var(--text-primary)',
      }}
    >
      {/* 0. Start Screen (Neon Circuit Draw - executes strictly once per browser session) */}
      <StartScreen />

      {/* 1. Responsive Navigation: Desktop Floating Nav + Mobile Fixed Bottom Dock */}
      <ResponsiveNav
        activeFilter={activeFilter}
        onFilterChange={(filter) => handleFilterChange(filter, true)}
        onHomeClick={handleResetHome}
        imageAlbums={imageAlbums}
        videoAlbums={videoAlbums}
        shortAlbums={shortAlbums}
        onJumpToAlbum={handleJumpToAlbum}
        showBackToTop={showBackToTop}
        onScrollToTop={handleScrollToTop}
      />

      {/* Main Content Stage */}
      <div className="w-full pb-28 md:pb-16 flex flex-col min-h-screen">
        {/* LAYER 1: Ambient Spotlight Hero Banner */}
        {!searchQuery && (activeFilter === 'all' || activeFilter === 'clips') && spotlightVideo && (
          <AmbientSpotlightHero
            item={spotlightVideo}
            playlistContext={spotlightPlaylist}
            onPlay={(item, playlist) => handleSelectItem(item, playlist)}
            onExploreAlbum={handleHeroExplore}
          />
        )}

        {/* 2. Structured Discovery Feed: Tagged Album Sections with Instant In-Place Filtering */}
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-8 md:px-20 xl:px-20 flex flex-col gap-6 sm:gap-8 pt-4">
          {/* Loading State Skeleton */}
          {isLoading && !data && (
            <div className="w-full py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#00E5FF] border-t-transparent animate-spin" />
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                Ingesting stream vault...
              </span>
            </div>
          )}

          {/* LAYER 2: Glass Filter Navigation Chips */}
          {!isLoading && (
            <HomeFilterChips
              activeFilter={activeFilter}
              onFilterChange={(filter) => handleFilterChange(filter, true)}
              counts={filterCounts}
            />
          )}

          {/* LAYER 3: Dedicated Shorts & Reels Ribbon */}
          {!searchQuery && (activeFilter === 'all' || activeFilter === 'shorts') && rawFeed.shorts.length > 0 && (
            <ShortsReelsRibbon
              shorts={rawFeed.shorts}
              onSelectShort={(item) => handleSelectItem(item, rawFeed.shorts)}
              onViewAll={() => handleOpenViewAll('Shorts', rawFeed.shorts, 'shorts')}
            />
          )}

          {/* When filter is 'clips': Show Video Album Collections instead of an endless list of all individual videos */}
          {!searchQuery && activeFilter === 'clips' && rawFeed.videoVaultFolders.length > 0 && (
            <VideoAlbumShowcase
              videoAlbums={rawFeed.videoVaultFolders}
              onSelectAlbum={(folder) =>
                handleOpenViewAll(
                  folder.name,
                  folder.items,
                  folder.variant || 'standard',
                  undefined,
                  folder.hasMultipleTypes,
                  folder.typeCounts
                )
              }
            />
          )}

          {/* LAYER 4: Featured Video Clips Preview (Only on 'all' view with strict limit) */}
          {!searchQuery && activeFilter === 'all' && featuredVideos.length > 0 && (
            <DynamicVideoGrid
              videos={featuredVideos}
              onPlayVideo={(item, playlist) => handleSelectItem(item, playlist)}
              title="Featured Clips"
              limit={8}
            />
          )}

          {/* LAYER 5: Dedicated Photo Showcase Row */}
          {!searchQuery && (activeFilter === 'all' || activeFilter === 'images') && rawFeed.photoVaultFolders.length > 0 && (
            <PhotoShowcaseRow
              photoAlbums={rawFeed.photoVaultFolders}
              onSelectAlbum={(folder) =>
                handleOpenViewAll(
                  folder.name,
                  folder.items,
                  'photo',
                  undefined,
                  folder.hasMultipleTypes,
                  folder.typeCounts
                )
              }
            />
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

      {/* Floating Global Back-To-Top Button (Desktop only; mobile is integrated into bottom dock) */}
      <button
        type="button"
        onClick={handleScrollToTop}
        aria-label="Scroll back to top"
        title="Back to top"
        className={`hidden md:flex fixed bottom-6 right-4 sm:right-6 z-40 p-2.5 rounded-full shadow-lg transition-all duration-200 cursor-pointer items-center justify-center ${
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
        onSelectItem={(item, currentList) => handleSelectItem(item, currentList, viewAllState.title)}
      />
    </div>
  );
}

export default App;
