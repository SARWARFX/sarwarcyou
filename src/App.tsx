import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMediaData } from './useMediaData';
import { organizeVaultFeed } from './utils/vaultFeedOrganizer';
import { type CyberFilterType } from './components/CyberHeader';
import { NetflixNav } from './components/NetflixNav';
import { NetflixBillboard } from './components/NetflixBillboard';
import { CyberCarouselRow } from './components/CyberCarouselRow';
import { CyberVideoPlayer } from './components/CyberVideoPlayer';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { MediaModal } from './components/MediaModal';
import { FullAlbumViewModal } from './components/FullAlbumViewModal';
import { SiteFooter } from './components/SiteFooter';
import type { StageMediaItem, SortOrder } from './types';
import { isVideoExtension } from './utils/mediaTypeDetector';
import { getMediaUrl } from './utils/imageUrlResolver';
import { parseUrlState, syncUrlState, findMatchingMediaItem, findMatchingFolder } from './utils/urlRouter';
import { Film, Sparkles, Flame, ChevronUp, ArrowUpDown } from 'lucide-react';
import { sortMediaItems } from './utils/albumExtractor';

function App() {
  const { data, isLoading } = useMediaData();

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CyberFilterType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
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

    // Filter Latest Releases dynamically from full media pool based on active navigation tab
    const pool = rawFeed.allMediaPool && rawFeed.allMediaPool.length > 0
      ? rawFeed.allMediaPool
      : rawFeed.latestReleases;

    let latestPool = pool.filter(matchesQuery);
    if (activeFilter === 'clips') {
      latestPool = latestPool.filter(
        (it) =>
          (it.type === 'video' || it.mediaType === 'clip') &&
          it.mediaType !== 'short' &&
          !it.category?.toLowerCase().includes('short') &&
          !it.url?.toLowerCase().includes('/shorts/')
      );
    } else if (activeFilter === 'images') {
      latestPool = latestPool.filter((it) => it.type === 'image' || it.mediaType === 'photo');
    } else if (activeFilter === 'shorts') {
      latestPool = latestPool.filter(
        (it) =>
          it.mediaType === 'short' ||
          it.category?.toLowerCase().includes('short') ||
          it.url?.toLowerCase().includes('/shorts/')
      );
    }

    const latest = sortMediaItems(latestPool, sortOrder).slice(0, 30);

    // Filter Shorts
    const shorts = (activeFilter === 'all' || activeFilter === 'shorts')
      ? sortMediaItems(rawFeed.shorts.filter(matchesQuery), sortOrder)
      : [];

    // Filter Dynamic Vault Albums based on active navigation tab & search query
    const albums = rawFeed.albums
      .map((album) => {
        let items = album.items.filter(matchesQuery);
        if (activeFilter === 'clips') {
          items = items.filter(
            (it) =>
              (it.type === 'video' || it.mediaType === 'clip') &&
              it.mediaType !== 'short' &&
              !it.category?.toLowerCase().includes('short') &&
              !it.url?.toLowerCase().includes('/shorts/')
          );
        } else if (activeFilter === 'images') {
          items = items.filter((it) => it.type === 'image' || it.mediaType === 'photo');
        } else if (activeFilter === 'shorts') {
          items = items.filter(
            (it) =>
              it.mediaType === 'short' ||
              it.category?.toLowerCase().includes('short') ||
              it.url?.toLowerCase().includes('/shorts/')
          );
        }
        return {
          ...album,
          items: sortMediaItems(items, sortOrder),
          count: items.length,
        };
      })
      .filter((album) => album.count > 0);

    return {
      latestReleases: latest,
      shorts,
      albums,
      videoVaultFolders: albums.filter((a) => a.type === 'video'),
      photoVaultFolders: albums.filter((a) => a.type === 'image' || a.type === 'composite'),
    };
  }, [rawFeed, searchQuery, activeFilter, sortOrder]);

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

      const cleanItemUrl = getMediaUrl(item.url || item.path || item.id);
      const cleanItem: StageMediaItem = {
        ...item,
        url: cleanItemUrl,
      };

      if (isShort) {
        const fullShorts = rawFeed.shorts.length > 0 ? rawFeed.shorts : [cleanItem];
        const idx = fullShorts.findIndex((s) => s.id === item.id || s.url === item.url || s.url === cleanItemUrl);
        const cleanShorts = fullShorts.map((s) => ({
          ...s,
          url: getMediaUrl(s.url || s.path || s.id),
        }));
        pushModalState('shorts');
        setShortsState({
          isOpen: true,
          shorts: cleanShorts,
          initialIndex: Math.max(0, idx),
        });
      } else if (isPhoto) {
        const fullPhotos = playlistContext && playlistContext.length > 0
          ? playlistContext.filter((p) => p.type === 'image' || p.mediaType === 'photo')
          : [cleanItem];
        const idx = fullPhotos.findIndex((p) => p.id === item.id || p.url === item.url || p.url === cleanItemUrl);
        const cleanPhotos = fullPhotos.map((p) => ({
          ...p,
          url: getMediaUrl(p.url || p.path || p.id),
        }));
        pushModalState('lightbox');
        setLightboxState({
          isOpen: true,
          item: cleanItem,
          items: cleanPhotos.length > 0 ? cleanPhotos : [cleanItem],
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
          : [cleanItem];

        const cleanVideos = fullVideos.map((v) => ({
          ...v,
          url: getMediaUrl(v.url || v.path || v.id),
        }));
        pushModalState('theater');
        setTheaterState({
          isOpen: true,
          item: cleanItem,
          playlist: cleanVideos.length > 0 ? cleanVideos : [cleanItem],
        });
      }
    },
    [rawFeed, pushModalState]
  );

  // Dedicated "View All" Album / Collection opener
  const handleOpenViewAll = useCallback(
    (
      title: string,
      items: StageMediaItem[],
      variant: 'standard' | 'shorts' | 'photo' = 'standard',
      subtitle?: string,
      hasMultipleTypes?: boolean,
      typeCounts?: { photos: number; clips: number; shorts: number }
    ) => {
      pushModalState('viewAll');
      setViewAllState({
        isOpen: true,
        title,
        subtitle,
        items,
        variant,
        hasMultipleTypes,
        typeCounts,
      });
    },
    [pushModalState]
  );

  // Flag to ensure initial deep link from URL is processed once data is loaded
  const initialRouteHandledRef = useRef(false);

  useEffect(() => {
    if (isLoading || !data || initialRouteHandledRef.current) return;
    initialRouteHandledRef.current = true;

    const { albumQuery, mediaQuery } = parseUrlState();
    if (!albumQuery && !mediaQuery) return;

    // 1. If mediaQuery is present, find and open the exact media
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
      } else {
        // Fallback: check if mediaQuery was an album/folder name (e.g. from #/view/...)
        const folderTarget = albumQuery || mediaQuery;
        if (folderTarget.toLowerCase() === 'shorts') {
          handleOpenViewAll('Shorts', rawFeed.shorts, 'shorts', 'Dedicated 9:16 vertical reels');
          return;
        } else if (folderTarget.toLowerCase() === 'all' || folderTarget.toLowerCase() === 'latest') {
          handleOpenViewAll('Latest Releases', rawFeed.allMediaPool, 'standard');
          return;
        } else {
          const folderMatch = findMatchingFolder(rawFeed.albums, folderTarget);
          if (folderMatch) {
            handleOpenViewAll(
              folderMatch.folder.name,
              folderMatch.folder.items,
              folderMatch.folder.variant,
              folderMatch.folder.subtitle || `${folderMatch.folder.count} items`,
              folderMatch.folder.hasMultipleTypes,
              folderMatch.folder.typeCounts
            );
            return;
          }
        }
      }
    }

    // 2. If only albumQuery is present (or media item not found), open album's View All screen
    if (albumQuery) {
      if (albumQuery.toLowerCase() === 'shorts') {
        handleOpenViewAll('Shorts', rawFeed.shorts, 'shorts', 'Dedicated 9:16 vertical reels');
      } else if (albumQuery.toLowerCase() === 'all' || albumQuery.toLowerCase() === 'latest') {
        handleOpenViewAll('Latest Releases', rawFeed.allMediaPool, 'standard');
      } else {
        const folderMatch = findMatchingFolder(rawFeed.albums, albumQuery);
        if (folderMatch) {
          handleOpenViewAll(
            folderMatch.folder.name,
            folderMatch.folder.items,
            folderMatch.folder.variant,
            folderMatch.folder.subtitle || `${folderMatch.folder.count} items`,
            folderMatch.folder.hasMultipleTypes,
            folderMatch.folder.typeCounts
          );
        }
      }
    }
  }, [isLoading, data, rawFeed, handleSelectItem, handleOpenViewAll]);

  // Synchronize active view with browser URL search parameters (?album=, ?media=, ?sort=)
  useEffect(() => {
    // Only synchronize once initial route has been evaluated
    if (!initialRouteHandledRef.current) return;

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
      // All modals closed - restore clean base URL
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

  const handleResetHome = () => {
    setSearchQuery('');
    setActiveFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Picks 10 random landscape videos distributed across different video folders.
   * On each page visit, visitors will see a different, newly randomized set of videos.
   */
  const spotlightVideos = useMemo(() => {
    const folders = rawFeed.albums.filter((a) => a.type === 'video' || a.hasMultipleTypes);
    if (!folders || folders.length === 0) return [];

    // 1. Gather all strictly landscape video items per folder
    const folderVideos: { folderId: string; folderName: string; videos: StageMediaItem[] }[] = [];

    for (const folder of folders) {
      const landscapeVideos = folder.items.filter((item) => {
        // Must be video/clip
        const isVid =
          item.type === 'video' ||
          item.mediaType === 'clip' ||
          isVideoExtension(item.url || item.id);
        if (!isVid) return false;

        // Must NOT be short or vertical reel
        const isShort =
          item.mediaType === 'short' ||
          item.category?.toLowerCase().includes('short') ||
          item.category?.toLowerCase().includes('reel') ||
          item.url?.toLowerCase().includes('/shorts/') ||
          item.id?.toLowerCase().includes('shorts');
        if (isShort) return false;

        return true;
      });

      if (landscapeVideos.length > 0) {
        // Shuffle videos within this folder
        const shuffled = [...landscapeVideos].sort(() => Math.random() - 0.5);
        folderVideos.push({
          folderId: folder.id,
          folderName: folder.name,
          videos: shuffled,
        });
      }
    }

    if (folderVideos.length === 0) return [];

    // 2. Shuffle folders so we sample across different folders on each visit
    const shuffledFolders = [...folderVideos].sort(() => Math.random() - 0.5);

    // 3. Round-robin pick up to 10 videos across different folders
    const selected: StageMediaItem[] = [];
    const TARGET_COUNT = 10;
    let round = 0;
    let hasMore = true;

    while (selected.length < TARGET_COUNT && hasMore) {
      let pickedInThisRound = 0;
      for (const f of shuffledFolders) {
        if (round < f.videos.length) {
          selected.push(f.videos[round]);
          pickedInThisRound++;
          if (selected.length >= TARGET_COUNT) break;
        }
      }
      if (pickedInThisRound === 0) {
        hasMore = false;
      }
      round++;
    }

    // 4. Randomize the presentation order so the 10 videos play in a random sequence
    return selected.sort(() => Math.random() - 0.5);
  }, [rawFeed.albums]);

  // Navigate/scroll directly to the album that contains the spotlight video
  const handleOpenAlbum = useCallback((item: StageMediaItem) => {
    // Ensure the video folders are visible in the current view
    if (activeFilter !== 'all' && activeFilter !== 'clips') {
      setActiveFilter('all');
    }
    if (searchQuery) {
      setSearchQuery('');
    }

    // Locate the matching folder in dynamic albums
    const targetFolder = rawFeed.albums.find((f) =>
      f.items.some((it) => it.id === item.id || it.url === item.url) ||
      f.name.toLowerCase() === item.category?.toLowerCase() ||
      (item.parentAlbum && f.folderPath && f.folderPath.toLowerCase() === item.parentAlbum.toLowerCase()) ||
      (item.parentAlbum && f.id.toLowerCase().includes(item.parentAlbum.toLowerCase())) ||
      (item.parentAlbum && f.name.toLowerCase().includes(item.parentAlbum.toLowerCase()))
    );

    const folderId = targetFolder ? targetFolder.id : null;

    setTimeout(() => {
      if (folderId) {
        const el = document.getElementById(folderId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-[#00E5FF]', 'rounded-2xl', 'p-2', 'bg-[#00E5FF]/5', 'transition-all', 'duration-500');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-[#00E5FF]', 'rounded-2xl', 'p-2', 'bg-[#00E5FF]/5');
          }, 2500);
          return;
        }
      }
      const albumsSec = document.getElementById('albums-section');
      if (albumsSec) {
        albumsSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, [activeFilter, searchQuery, rawFeed.albums]);

  // Surprise Me / Shuffle Handler
  const handleShuffle = useCallback(() => {
    if (!rawFeed.allMediaPool || rawFeed.allMediaPool.length === 0) return;
    const randomIdx = Math.floor(Math.random() * rawFeed.allMediaPool.length);
    const randomItem = rawFeed.allMediaPool[randomIdx];
    handleSelectItem(randomItem);
  }, [rawFeed, handleSelectItem]);

  const hasAnyResults =
    feed.latestReleases.length > 0 ||
    feed.shorts.length > 0 ||
    feed.albums.length > 0;

  const latestHeaderInfo = useMemo(() => {
    switch (activeFilter) {
      case 'clips':
        return {
          title: 'Latest Videos',
          subtitle: 'Recently added video clips',
          spotlight: 'VIDEO SPOTLIGHT',
        };
      case 'images':
        return {
          title: 'Latest Images',
          subtitle: 'Recently added photographs & artwork',
          spotlight: 'PHOTO SPOTLIGHT',
        };
      case 'shorts':
        return {
          title: 'Latest Shorts',
          subtitle: 'Recently added vertical reels',
          spotlight: 'SHORTS SPOTLIGHT',
        };
      case 'all':
      default:
        return {
          title: 'Latest Releases',
          subtitle: '30 newest items aggregated from all folders',
          spotlight: 'FEATURED SPOTLIGHT',
        };
    }
  }, [activeFilter]);

  return (
    <div className="w-full max-w-full overflow-x-hidden relative bg-[#030305] text-white min-h-screen selection:bg-[#00E5FF] selection:text-black">
      {/* 1. Netflix Dual Navigation (Desktop Left Rail + Mobile Top & Bottom Bars) */}
      <NetflixNav
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onShuffle={handleShuffle}
        onResetHome={handleResetHome}
      />

      {/* Main Content Stage */}
      <div className="w-full md:pl-12 lg:pl-14 pb-12 flex flex-col min-h-screen">
        {/* 2. Netflix Hero Billboard (10 Rotating Landscape Videos Across Folders) */}
        {!searchQuery && (activeFilter === 'all' || activeFilter === 'clips') && spotlightVideos.length > 0 && (
          <NetflixBillboard
            items={spotlightVideos}
            onPlay={(item, playlist) => handleSelectItem(item, playlist)}
            onOpenAlbum={(item) => handleOpenAlbum(item)}
          />
        )}

        {/* 3. Structured Discovery Feed */}
        <main className={`w-full max-w-7xl mx-auto px-4 sm:px-8 flex flex-col gap-10 sm:gap-14 ${
          !searchQuery && (activeFilter === 'all' || activeFilter === 'clips') ? 'pt-2 sm:pt-4' : 'pt-20 sm:pt-24'
        }`}>
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

        {/* Global Sort & Order Toolbar */}
        {hasAnyResults && (
          <div className="w-full flex items-center justify-between pb-2 border-b border-white/[0.08] text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                {searchQuery ? `Search Results (${feed.latestReleases.length + feed.shorts.length})` : 'Catalog Order:'}
              </span>
              <span className="text-[10px] text-[#00E5FF] px-2 py-0.5 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/20 font-bold">
                {sortOrder === 'newest' ? 'Newest First' : sortOrder === 'oldest' ? 'Oldest First' : 'Name (A–Z)'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] px-2.5 py-1 rounded-full border border-white/10 transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#00E5FF] flex-shrink-0" />
              <label htmlFor="feedSortSelect" className="text-zinc-400 text-[11px] hidden sm:inline sr-only">Sort by:</label>
              <select
                id="feedSortSelect"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="bg-transparent text-zinc-200 hover:text-white font-medium text-[11px] focus:outline-none cursor-pointer pr-1"
                aria-label="Sort catalog media items"
              >
                <option value="newest" className="bg-[#0b0c10] text-white">Newest First</option>
                <option value="oldest" className="bg-[#0b0c10] text-white">Oldest First</option>
                <option value="name-asc" className="bg-[#0b0c10] text-white">Name (A–Z)</option>
              </select>
            </div>
          </div>
        )}

        {/* SECTION 1: CONTEXTUAL LATEST RELEASES */}
        {feed.latestReleases.length > 0 && (
          <div className="flex flex-col gap-1 transition-all duration-300">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-[11px] font-mono tracking-widest text-[#00E5FF] font-bold uppercase">
                {latestHeaderInfo.spotlight}
              </span>
            </div>
            <CyberCarouselRow
              title={latestHeaderInfo.title}
              subtitle={latestHeaderInfo.subtitle}
              badge={feed.latestReleases.length}
              items={feed.latestReleases}
              variant={activeFilter === 'shorts' ? 'shorts' : activeFilter === 'images' ? 'photo' : 'standard'}
              onSelectItem={(item, currentList) => handleSelectItem(item, currentList || feed.latestReleases)}
              onViewAll={() =>
                handleOpenViewAll(
                  latestHeaderInfo.title,
                  feed.latestReleases,
                  activeFilter === 'shorts' ? 'shorts' : activeFilter === 'images' ? 'photo' : 'standard',
                  latestHeaderInfo.subtitle
                )
              }
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
              onViewAll={() =>
                handleOpenViewAll(
                  'Shorts',
                  feed.shorts,
                  'shorts',
                  'Dedicated 9:16 vertical reels'
                )
              }
            />
          </div>
        )}

        {/* SECTION 3: DYNAMIC VAULT ALBUMS */}
        {feed.albums.length > 0 && (
          <section id="albums-section" className="flex flex-col gap-8 pt-4 border-t border-white/[0.05] scroll-mt-20">
            <div id="video-vault-section" className="sr-only" />
            <div id="photo-vault-section" className="sr-only" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00E5FF]" />
                <h2 className="text-base sm:text-lg font-black font-sans tracking-wider text-white uppercase">
                  Vault Albums
                </h2>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">
                  ({feed.albums.length} Dynamic {feed.albums.length === 1 ? 'Album' : 'Albums'})
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              {feed.albums.map((album) => (
                <div id={album.id} key={album.id} className="scroll-mt-24 transition-all duration-500">
                  <CyberCarouselRow
                    title={album.name}
                    subtitle={album.subtitle}
                    badge={album.count}
                    items={album.items}
                    variant={album.variant}
                    hasMultipleTypes={album.hasMultipleTypes}
                    typeCounts={album.typeCounts}
                    onSelectItem={(item, currentList) => handleSelectItem(item, currentList || album.items)}
                    onViewAll={() =>
                      handleOpenViewAll(
                        album.name,
                        album.items,
                        album.variant,
                        album.subtitle || `${album.count} items`,
                        album.hasMultipleTypes,
                        album.typeCounts
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 3. Minimalist Footer */}
      <SiteFooter onBackToTop={handleResetHome} />
      </div>

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

      {/* 5. Adaptive Shorts Feed Modal */}
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

      {/* 6. High-Definition Image Lightbox */}
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

      {/* 7. Dedicated Full Album View Modal (Natural Aspect Ratio Masonry for Images) */}
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
