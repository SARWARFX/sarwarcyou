import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMediaData } from './useMediaData';
import { organizeVaultFeed } from './utils/vaultFeedOrganizer';
import { CyberVideoPlayer } from './components/CyberVideoPlayer';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { MediaModal } from './components/MediaModal';
import { FullAlbumViewModal } from './components/FullAlbumViewModal';
import { DeepSpaceTreeExplorer } from './components/DeepSpaceTreeExplorer';
import { CyberCommandPalette } from './components/CyberCommandPalette';
import { NetworkStatusHUD } from './components/NetworkStatusHUD';
import { PlayerErrorBoundary } from './components/PlayerErrorBoundary';
import { ComplianceSplashScreen } from './components/ComplianceSplashScreen';
import { AmbientWallpaper } from './components/AmbientWallpaper';
import { WinXPDesktop } from './components/winxp/WinXPDesktop';
import { SilentHillShell } from './components/silenthill/SilentHillShell';
import { ModernCascadeExplorer } from './components/ModernCascadeExplorer';
import { AmbientFogCanvas } from './components/AmbientFogCanvas';
import { FrostedSnowCanvas } from './components/FrostedSnowCanvas';
import { AuraCanvas } from './components/aura/AuraCanvas';
import { AuraCascadeExplorer } from './components/aura/AuraCascadeExplorer';
import { MonolithBarGate } from './components/gate/MonolithBarGate';
import {
  ACTIVE_INTERFACE,
  ENABLE_MONOLITH_GATE,
  ENABLE_AURA_FLOW,
  ENABLE_CASCADE_SHELL,
  ENABLE_SILENT_HILL_SHELL,
  ENABLE_WINXP_SHELL,
  ENABLE_FROSTED_SNOW,
} from './config/themeConfig';
import type { StageMediaItem, SortOrder } from './types';
import { isVideoExtension } from './utils/mediaTypeDetector';
import {
  parseUrlState,
  syncUrlState,
  findMatchingMediaItem,
  findMatchingFolder,
  getAlbumSlug,
  getMediaSlug,
  searchCatalogRecursively,
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
    activeIndex?: number;
  }>({
    isOpen: false,
    shorts: [],
    initialIndex: 0,
    activeIndex: 0,
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

  // Global Command Palette Shortcut (Ctrl+K / Cmd+K, or "/" when no input is focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (e.cancelable) e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === '/') {
        const targetTag = (document.activeElement?.tagName || '').toLowerCase();
        const isEditable = document.activeElement?.getAttribute('contenteditable') === 'true';
        if (targetTag !== 'input' && targetTag !== 'textarea' && !isEditable) {
          if (e.cancelable) e.preventDefault();
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
    (
      item: StageMediaItem,
      playlistContext?: StageMediaItem[],
      preferredAlbum?: string,
      pushHistory = true,
      indexHint?: number
    ) => {
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
          (playlistContext && playlistContext.length > 0
            ? playlistContext
            : rawFeed.shorts.length > 0
            ? rawFeed.shorts
            : [item]).filter(Boolean);

        // Find exact index within the folder's shorts array:
        let clickedIndex = -1;
        if (indexHint !== undefined && indexHint >= 0 && indexHint < fullShortsList.length) {
          const candidate = fullShortsList[indexHint];
          if (
            candidate &&
            (candidate.id === item.id ||
              candidate.name === item.name ||
              candidate.url === item.url ||
              candidate.path === item.path)
          ) {
            clickedIndex = indexHint;
          }
        }

        if (clickedIndex === -1) {
          clickedIndex = fullShortsList.findIndex(
            (s) =>
              s &&
              ((item.id && (s.id || s.name) === item.id) ||
                (item.id && s.id === item.id) ||
                (item.name && (s.name || s.id) === item.name) ||
                (item.url && s.url === item.url) ||
                (item.path && s.path === item.path))
          );
        }

        if (clickedIndex === -1) {
          const itemQuery = item.title || item.name || item.id || '';
          const matchResult = findMatchingMediaItem(fullShortsList, itemQuery);
          if (matchResult) {
            clickedIndex = matchResult.index;
          }
        }

        const targetIndex = clickedIndex >= 0 && clickedIndex < fullShortsList.length ? clickedIndex : 0;
        const targetItem = fullShortsList[targetIndex] || item;
        const albumTarget = preferredAlbum || targetItem.category || targetItem.parentAlbum || 'Shorts';
        const targetUrl = buildMediaUrl(targetItem, albumTarget);
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
          activeIndex: targetIndex,
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
    (short: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => {
      const albumTarget = folderName || short.category || short.parentAlbum || 'Shorts';
      openMediaItem(short, shorts, albumTarget, true, index);
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
      // STRICT MUTUAL EXCLUSIVITY: Explicitly reset all player states when opening album view
      setTheaterState({ isOpen: false, item: null, playlist: [] });
      setShortsState({ isOpen: false, shorts: [], initialIndex: 0 });
      setLightboxState({ isOpen: false, item: null, items: [], initialIndex: 0 });
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
        const resolved = searchCatalogRecursively(
          rawFeed.albums,
          rawFeed.allMediaPool,
          rawFeed.shorts,
          albumQuery,
          mediaQuery
        );
        if (resolved && resolved.matchedItem) {
          openMediaItem(resolved.matchedItem, resolved.playlist, resolved.preferredAlbum, false, resolved.targetIndex);
          return;
        }
      }

      // 2. Unmount media players
      setTheaterState({ isOpen: false, item: null, playlist: [] });
      setShortsState({ isOpen: false, shorts: [], initialIndex: 0 });
      setLightboxState({ isOpen: false, item: null, items: [], initialIndex: 0 });

      // 3. If albumQuery is present in URL, restore the previous album viewAllState
      if (albumQuery) {
        const isShortsAlbum = albumQuery.toLowerCase() === 'shorts' || getAlbumSlug(albumQuery) === 'shorts';
        if (isShortsAlbum) {
          handleOpenViewAll('Shorts', rawFeed.shorts, 'shorts', undefined, undefined, undefined, false);
          return;
        }
        const folder = findMatchingFolder(rawFeed.albums, albumQuery);
        if (folder) {
          handleOpenViewAll(
            folder.folder.name,
            folder.folder.items,
            folder.folder.variant,
            undefined,
            folder.folder.hasMultipleTypes,
            folder.folder.typeCounts,
            false
          );
          return;
        }
      }

      // 4. If neither media nor album param is present, close album view as well
      setViewAllState({ isOpen: false, title: '', items: [] });
      historyDepthRef.current = 0;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [rawFeed, openMediaItem, handleOpenViewAll]);

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

    const isShortsAlbum = albumQuery
      ? albumQuery.toLowerCase() === 'shorts' || getAlbumSlug(albumQuery) === 'shorts'
      : false;

    if (mediaQuery) {
      const resolved = searchCatalogRecursively(
        rawFeed.albums,
        rawFeed.allMediaPool,
        rawFeed.shorts,
        albumQuery,
        mediaQuery
      );

      if (resolved && resolved.matchedItem) {
        hasInitializedUrlRef.current = true;
        const matchedItem = resolved.matchedItem;
        const matchedContext = resolved.playlist;
        const preferredAlbum = resolved.preferredAlbum;
        const mediaUrl = buildMediaUrl(matchedItem, preferredAlbum);

        window.history.replaceState({ tab: 'all' }, '', buildHomeUrl());

        if (preferredAlbum && preferredAlbum.toLowerCase() !== 'shorts') {
          const albumUrl = buildAlbumUrl(preferredAlbum);
          window.history.pushState({ album: preferredAlbum }, '', albumUrl);
          historyDepthRef.current++;

          const folder = findMatchingFolder(rawFeed.albums, preferredAlbum);
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

        openMediaItem(matchedItem, matchedContext, preferredAlbum, false, resolved.targetIndex);
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
        const folderToOpen = findMatchingFolder(rawFeed.albums, albumQuery);
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
    <div
      className="relative w-full h-[100dvh] overflow-hidden select-none text-white bg-transparent"
      style={{ isolation: 'isolate' }}
    >
      {ENABLE_MONOLITH_GATE || ACTIVE_INTERFACE === 'MONOLITH_GATE' ? (
        <>
          {/* 0. Opening Public Domain Compliance Splash Screen */}
          <ComplianceSplashScreen />

          {/* 1. Direct Data Monolith Bars Vault Gate with SARWAR.CYOU Signature */}
          <MonolithBarGate
            items={rawFeed.allMediaPool}
            initialAlbum={initialAlbumTarget}
            isModalOpen={
              theaterState.isOpen ||
              shortsState.isOpen ||
              lightboxState.isOpen ||
              viewAllState.isOpen ||
              isCommandPaletteOpen
            }
            onOpenPhoto={handleOpenPhoto}
            onOpenVideo={handleOpenVideo}
            onOpenShort={handleOpenShort}
          />

          {/* Global Network Connectivity Indicator */}
          <NetworkStatusHUD />
        </>
      ) : ENABLE_AURA_FLOW || ACTIVE_INTERFACE === 'AURA_FLOW' ? (
        <>
          {/* Atmospheric Obsidian Canvas with Living Ambient Depth */}
          <AuraCanvas />

          {/* Proprietary Aura Flow 3-Tier Progressive Cascade Explorer */}
          <AuraCascadeExplorer
            items={rawFeed.allMediaPool}
            isNavDisabled={
              isCommandPaletteOpen ||
              theaterState.isOpen ||
              shortsState.isOpen ||
              lightboxState.isOpen ||
              viewAllState.isOpen
            }
            onOpenPhoto={handleOpenPhoto}
            onOpenVideo={handleOpenVideo}
            onOpenShort={handleOpenShort}
          />
        </>
      ) : ENABLE_CASCADE_SHELL || ACTIVE_INTERFACE === 'CASCADE' ? (
        <>
          {/* Preserved Ambient Rolling Fog Background */}
          <AmbientFogCanvas />

          {/* Modern 3-Tier Cascading Progressive Catalog Explorer */}
          <ModernCascadeExplorer
            items={rawFeed.allMediaPool}
            isNavDisabled={
              isCommandPaletteOpen ||
              theaterState.isOpen ||
              shortsState.isOpen ||
              lightboxState.isOpen ||
              viewAllState.isOpen
            }
            onOpenPhoto={handleOpenPhoto}
            onOpenVideo={handleOpenVideo}
            onOpenShort={handleOpenShort}
          />
        </>
      ) : ENABLE_SILENT_HILL_SHELL || ACTIVE_INTERFACE === 'SILENT_HILL' ? (
        <SilentHillShell
          items={rawFeed.allMediaPool}
          isModalOpen={
            theaterState.isOpen ||
            shortsState.isOpen ||
            lightboxState.isOpen ||
            viewAllState.isOpen ||
            isCommandPaletteOpen
          }
          onOpenPhoto={handleOpenPhoto}
          onOpenVideo={handleOpenVideo}
          onOpenShort={handleOpenShort}
        />
      ) : ENABLE_WINXP_SHELL || ACTIVE_INTERFACE === 'WINXP' ? (
        <WinXPDesktop
          items={rawFeed.allMediaPool}
          isModalOpen={
            theaterState.isOpen ||
            shortsState.isOpen ||
            lightboxState.isOpen ||
            viewAllState.isOpen ||
            isCommandPaletteOpen
          }
          onOpenPhoto={handleOpenPhoto}
          onOpenVideo={handleOpenVideo}
          onOpenShort={handleOpenShort}
        />
      ) : (
        <>
          {/* 0. Opening Public Domain Compliance Splash Screen */}
          <ComplianceSplashScreen />

          {/* 1. Frosted Snowy Background Canvas (or Ambient Wallpaper fallback) */}
          {ENABLE_FROSTED_SNOW ? (
            <FrostedSnowCanvas />
          ) : (
            <AmbientWallpaper
              items={rawFeed.allMediaPool}
              isPaused={theaterState.isOpen || shortsState.isOpen || lightboxState.isOpen}
            />
          )}

          {/* 2. Deep Space Tree Explorer (Pure Underlined Text Horizontal Directory) */}
          {isLoading && !data ? (
            <div className="flex items-center justify-center w-full h-full text-white/50 font-mono text-sm tracking-widest uppercase">
              Loading...
            </div>
          ) : (
            <DeepSpaceTreeExplorer
              items={rawFeed.allMediaPool}
              initialAlbum={initialAlbumTarget}
              isNavDisabled={
                isCommandPaletteOpen ||
                theaterState.isOpen ||
                shortsState.isOpen ||
                lightboxState.isOpen ||
                viewAllState.isOpen
              }
              onOpenPhoto={handleOpenPhoto}
              onOpenVideo={handleOpenVideo}
              onOpenShort={handleOpenShort}
            />
          )}

          {/* Global Network Connectivity Indicator (Online/Offline HUD) */}
          <NetworkStatusHUD />
        </>
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
      {shortsState.isOpen && (
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
                const albumTarget = currentShort.category || currentShort.parentAlbum || 'Shorts';
                const targetUrl = buildMediaUrl(currentShort, albumTarget);
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
        <PlayerErrorBoundary onClose={() => handleCloseModal('viewAll')} fallbackTitle="Album View Error">
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
        </PlayerErrorBoundary>
      )}

      {/* 7. Cyberpunk Command Palette (Ctrl+K / Cmd+K / "/") */}
      {isCommandPaletteOpen && (
        <PlayerErrorBoundary onClose={() => setIsCommandPaletteOpen(false)} fallbackTitle="Command Palette Error">
          <CyberCommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            items={rawFeed.allMediaPool}
            allShorts={rawFeed.shorts}
            onOpenPhoto={handleOpenPhoto}
            onOpenVideo={handleOpenVideo}
            onOpenShort={handleOpenShort}
          />
        </PlayerErrorBoundary>
      )}
    </div>
  );
}

export default App;
