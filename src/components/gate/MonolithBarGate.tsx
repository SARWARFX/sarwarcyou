import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { hapticMedium } from '../../utils/hapticsManager';
import { trackActivityEvent } from '../../utils/usageTelemetry';
import {
  parseAppPathname,
  updateBrowserUrl,
  findMediaByShortId,
} from '../../utils/urlRouter';
import { MediaNotFoundDialog } from '../common/MediaNotFoundDialog';
import { LivingMediaCard } from './LivingMediaCard';
import { LaserSparkLogo } from '../brand/LaserSparkLogo';
import { TopMiddleNetworkStatus } from '../navigation/TopMiddleNetworkStatus';
import { TacticalTelemetryGraph } from '../navigation/TacticalTelemetryGraph';
import { HomepageSlidingShorts } from './HomepageSlidingShorts';

export interface MonolithBarGateProps {
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  onOpenSearch?: () => void;
  initialAlbum?: string;
  isModalOpen?: boolean;
}

function getFolderSegments(item: StageMediaItem): { root: string; subfolders: string[] } {
  const raw = item.path || item.parentAlbum || item.category || '';
  let clean = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (clean.includes('://')) {
    clean = clean.split('://')[1].split('/').slice(1).join('/');
  }
  const parts = clean.split('/').map((s) => s.trim()).filter(Boolean);
  const hasExt = parts.length > 0 && /\.[a-z0-9]{2,5}$/i.test(parts[parts.length - 1]);
  const dirParts = hasExt ? parts.slice(0, -1) : parts;

  let root = dirParts.length > 0 ? dirParts[0] : '';
  let sub = dirParts.slice(1);

  if (/^(?:bandhobi|realtube)$/i.test(root) || clean.toLowerCase().startsWith('bandhobi/') || clean.toLowerCase().startsWith('realtube/')) {
    root = 'Bandhobi';
    let subName = sub.length > 0 ? sub[0] : '';
    if (!subName && clean.toLowerCase().includes('/photographs/')) subName = 'Photographs';
    if (!subName && clean.toLowerCase().includes('/shorts/')) subName = 'Shorts';
    if (!subName && clean.toLowerCase().includes('/video clips/')) subName = 'Video Clips';

    if (/image|photo/i.test(subName) || isPhotoExtension(clean)) {
      sub = ['Photographs'];
    } else if (/short/i.test(subName) || item.mediaType === 'short') {
      sub = ['Shorts'];
    } else {
      sub = ['Video Clips'];
    }
    return { root, subfolders: sub };
  }

  if (/^(?:photographs|images|photography)$/i.test(root) || isPhotoExtension(clean)) {
    root = 'Photographs';
    let subName = sub.length > 0 ? sub[0] : '';
    if (/fav/i.test(subName)) subName = 'Favorite';
    else if (/2027/i.test(subName)) subName = '2027';
    else if (/2026/i.test(subName)) subName = '2026';
    else if (/2025/i.test(subName)) subName = '2025';
    else subName = 'Older';
    return { root, subfolders: [subName] };
  }

  if (/^(?:reels\/shorts|shorts|reels)$/i.test(root) || item.mediaType === 'short' || clean.toLowerCase().includes('/shorts/')) {
    root = 'Shorts';
    let subName = sub.length > 0 ? sub[0] : '';
    if (/2027/i.test(subName)) subName = '2027';
    else subName = 'Older';
    return { root, subfolders: [subName] };
  }

  root = 'Video Clips';
  let subName = sub.length > 0 ? sub[0] : '';
  if (/fav/i.test(subName)) subName = 'Favorite';
  else if (/2027/i.test(subName)) subName = '2027';
  else if (/2026/i.test(subName)) subName = '2026';
  else if (/2025/i.test(subName)) subName = '2025';
  else subName = 'Older';

  return { root, subfolders: [subName] };
}

const PHOTO_SUBFOLDERS = ['ALL', 'Favorite', '2027', '2026', '2025', 'Older'];
const SHORTS_SUBFOLDERS = ['ALL', '2027', 'Older'];
const CLIPS_SUBFOLDERS = ['ALL', '4K Cinema', '2027', '2026', 'Older', 'Favorite'];
const BANDHOBI_SUBFOLDERS = ['ALL', 'Photographs', 'Video Clips', 'Shorts'];

export const MonolithBarGate: React.FC<MonolithBarGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum: _initialAlbum,
  isModalOpen = false,
}) => {
  const initialRoute = useMemo(() => parseAppPathname(), []);

  // 0: Homepage (Right-to-Left Sliding Shorts), 1: Photographs, 2: Shorts, 3: Video Clips, 4: Bandhobi
  const [tabIndex, setTabIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const parsed = parseAppPathname();
    if (parsed.tab === 'PHOTOGRAPHY') return 1;
    if (parsed.tab === 'SHORTS') return 2;
    if (parsed.tab === 'CLIPS') return 3;
    if (parsed.tab === 'BANDHOBI') return 4;
    return 0;
  });

  const [photosSubfolder, setPhotosSubfolder] = useState<string>('ALL');
  const [shortsSubfolder, setShortsSubfolder] = useState<string>('ALL');
  const [clipsSubfolder, setClipsSubfolder] = useState<string>('ALL');
  const [bandhobiSubfolder, setBandhobiSubfolder] = useState<string>('ALL');

  const [notFoundInfo, setNotFoundInfo] = useState<{
    isOpen: boolean;
    path: string;
    tab?: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'BANDHOBI' | 'TRAILER';
  }>({ isOpen: false, path: '' });

  const switchTab = useCallback((index: number) => {
    setTabIndex(index);
    if (typeof window !== 'undefined') {
      let route = '/';
      if (index === 1) route = '/photographs';
      else if (index === 2) route = '/shorts';
      else if (index === 3) route = '/clips';
      else if (index === 4) route = '/bandhobi';
      updateBrowserUrl(route);
    }
  }, []);

  // Synchronize state when browser Back / Forward (popstate) is clicked
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseAppPathname();
      if (parsed.isNotFound) {
        setNotFoundInfo({ isOpen: true, path: window.location.pathname });
        return;
      }
      if (parsed.tab === 'PHOTOGRAPHY') setTabIndex(1);
      else if (parsed.tab === 'SHORTS') setTabIndex(2);
      else if (parsed.tab === 'CLIPS') setTabIndex(3);
      else if (parsed.tab === 'BANDHOBI') setTabIndex(4);
      else setTabIndex(0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Deep Link Synchronizer on load
  const hasAutoLaunchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoLaunchedRef.current || !items || items.length === 0) return;

    if (initialRoute.shortId) {
      hasAutoLaunchedRef.current = true;
      const matched = findMediaByShortId(items, initialRoute.shortId);
      if (matched) {
        const item = matched.item;
        const isPhoto =
          item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
        const isShort =
          item.mediaType === 'short' ||
          item.path?.toLowerCase().includes('short') ||
          item.url?.toLowerCase().includes('short');

        if (isPhoto) {
          switchTab(1);
          onOpenPhoto(item, [item], 0);
        } else if (isShort) {
          switchTab(2);
          onOpenShort(item, [item], 0);
        } else {
          switchTab(3);
          onOpenVideo(item, [item]);
        }
      } else {
        setNotFoundInfo({ isOpen: true, path: window.location.pathname });
      }
      return;
    }

    const parsed = parseAppPathname();
    if (parsed.isNotFound) {
      setNotFoundInfo({ isOpen: true, path: '/' + parsed.rawPath });
    }
  }, [items, initialRoute, onOpenPhoto, onOpenShort, onOpenVideo, switchTab]);

  // Catalog indexation by directory
  const rootMap = useMemo(() => {
    const map = new Map<string, any>();
    const getOrCreate = (name: string) => {
      if (!map.has(name)) {
        map.set(name, {
          name,
          fullPath: name,
          subfolders: new Map(),
          files: [],
        });
      }
      return map.get(name)!;
    };

    for (const item of items) {
      const { root, subfolders } = getFolderSegments(item);
      const rootNode = getOrCreate(root);
      if (subfolders.length === 0) {
        rootNode.files.push(item);
      } else {
        const subName = subfolders[0];
        if (!rootNode.subfolders.has(subName)) {
          rootNode.subfolders.set(subName, {
            name: subName,
            fullPath: `${root}/${subName}`,
            subfolders: new Map(),
            files: [],
          });
        }
        rootNode.subfolders.get(subName)!.files.push(item);
      }
    }

    return map;
  }, [items]);

  const allPhotosFiles = useMemo(() => {
    const node = rootMap.get('Photographs');
    if (!node) return [];
    const seen = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const k = f.id || f.url || f.path || f.name;
      if (k && !seen.has(k)) { seen.add(k); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const k = f.id || f.url || f.path || f.name;
        if (k && !seen.has(k)) { seen.add(k); list.push(f); }
      }
    }
    return sortMediaItemsDescending(list);
  }, [rootMap]);

  const allShortsFiles = useMemo(() => {
    const node = rootMap.get('Shorts');
    if (!node) return [];
    const seen = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const k = f.id || f.url || f.path || f.name;
      if (k && !seen.has(k)) { seen.add(k); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const k = f.id || f.url || f.path || f.name;
        if (k && !seen.has(k)) { seen.add(k); list.push(f); }
      }
    }
    return sortMediaItemsDescending(list);
  }, [rootMap]);

  const allClipsFiles = useMemo(() => {
    const node = rootMap.get('Video Clips');
    if (!node) return [];
    const seen = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const k = f.id || f.url || f.path || f.name;
      if (k && !seen.has(k)) { seen.add(k); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const k = f.id || f.url || f.path || f.name;
        if (k && !seen.has(k)) { seen.add(k); list.push(f); }
      }
    }
    return sortMediaItemsDescending(list);
  }, [rootMap]);

  const allBandhobiFiles = useMemo(() => {
    const node = rootMap.get('Bandhobi');
    if (!node) return [];
    const seen = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const k = f.id || f.url || f.path || f.name;
      if (k && !seen.has(k)) { seen.add(k); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const k = f.id || f.url || f.path || f.name;
        if (k && !seen.has(k)) { seen.add(k); list.push(f); }
      }
    }
    return sortMediaItemsDescending(list);
  }, [rootMap]);

  // Active subfolder-filtered lists
  const activePhotosList = useMemo(() => {
    if (photosSubfolder === 'ALL') return allPhotosFiles;
    const node = rootMap.get('Photographs')?.subfolders.get(photosSubfolder);
    return node && node.files.length > 0 ? node.files : allPhotosFiles;
  }, [allPhotosFiles, rootMap, photosSubfolder]);

  const activeShortsList = useMemo(() => {
    if (shortsSubfolder === 'ALL') return allShortsFiles;
    const node = rootMap.get('Shorts')?.subfolders.get(shortsSubfolder);
    return node && node.files.length > 0 ? node.files : allShortsFiles;
  }, [allShortsFiles, rootMap, shortsSubfolder]);

  const activeClipsList = useMemo(() => {
    if (clipsSubfolder === 'ALL') return allClipsFiles;
    const node = rootMap.get('Video Clips')?.subfolders.get(clipsSubfolder);
    return node && node.files.length > 0 ? node.files : allClipsFiles;
  }, [allClipsFiles, rootMap, clipsSubfolder]);

  const activeBandhobiList = useMemo(() => {
    if (bandhobiSubfolder === 'ALL') return allBandhobiFiles;
    const node = rootMap.get('Bandhobi')?.subfolders.get(bandhobiSubfolder);
    return node && node.files.length > 0 ? node.files : allBandhobiFiles;
  }, [allBandhobiFiles, rootMap, bandhobiSubfolder]);

  const handleOpenItem = useCallback(
    (item: StageMediaItem, index: number = 0) => {
      hapticMedium();
      trackActivityEvent(1);

      const isPhoto = item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
      const isShort =
        item.mediaType === 'short' ||
        item.path?.toLowerCase().includes('short') ||
        item.url?.toLowerCase().includes('short');

      if (tabIndex === 4) {
        if (isPhoto) {
          onOpenPhoto(item, activeBandhobiList, index);
        } else if (isShort) {
          onOpenShort(item, activeBandhobiList, index, 'Bandhobi');
        } else {
          onOpenVideo(item, activeBandhobiList);
        }
        return;
      }

      if (isPhoto) {
        onOpenPhoto(item, activePhotosList, index);
      } else if (isShort) {
        onOpenShort(item, activeShortsList, index, 'Shorts');
      } else {
        onOpenVideo(item, activeClipsList);
      }
    },
    [tabIndex, activeBandhobiList, activePhotosList, activeShortsList, activeClipsList, onOpenPhoto, onOpenShort, onOpenVideo]
  );

  // Active list & subfolder list resolution
  const currentActiveList =
    tabIndex === 1
      ? activePhotosList
      : tabIndex === 2
      ? activeShortsList
      : tabIndex === 3
      ? activeClipsList
      : activeBandhobiList;

  const currentSubfolderList =
    tabIndex === 1
      ? PHOTO_SUBFOLDERS
      : tabIndex === 2
      ? SHORTS_SUBFOLDERS
      : tabIndex === 3
      ? CLIPS_SUBFOLDERS
      : BANDHOBI_SUBFOLDERS;

  const currentSubfolder =
    tabIndex === 1
      ? photosSubfolder
      : tabIndex === 2
      ? shortsSubfolder
      : tabIndex === 3
      ? clipsSubfolder
      : bandhobiSubfolder;

  const handleSelectSubfolder = (sub: string) => {
    if (tabIndex === 1) setPhotosSubfolder(sub);
    else if (tabIndex === 2) setShortsSubfolder(sub);
    else if (tabIndex === 3) setClipsSubfolder(sub);
    else if (tabIndex === 4) setBandhobiSubfolder(sub);
  };

  return (
    <div
      className="w-screen h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-transparent relative select-none font-sans text-white"
      style={{
        isolation: 'isolate',
        borderRadius: 0,
        outline: 'none',
        border: 'none',
      }}
    >
      {/* Permanent Midnight Obsidian Backdrop Canvas */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* 404 Route Not Found Dialog (Centered with 20px blur) */}
      <MediaNotFoundDialog
        isOpen={notFoundInfo.isOpen}
        attemptedPath={notFoundInfo.path}
        suggestedTab={notFoundInfo.tab}
        onClose={() => setNotFoundInfo((prev) => ({ ...prev, isOpen: false }))}
        onNavigateTab={(tab) => {
          setNotFoundInfo((prev) => ({ ...prev, isOpen: false }));
          if (tab === 'PHOTOGRAPHY') switchTab(1);
          else if (tab === 'SHORTS') switchTab(2);
          else if (tab === 'CLIPS') switchTab(3);
          else if (tab === 'BANDHOBI') switchTab(4);
          else switchTab(0);
        }}
      />

      {/* TOP HEADER: LOGO (LEFT) + NOTIF (CENTER) + GRAPH (RIGHT) */}
      <header
        className="w-full flex justify-between items-start pt-6 sm:pt-7 pb-3 px-6 sm:px-10 shrink-0 z-30 bg-black/85 backdrop-blur-md border-b border-white/[0.05] shadow-[0_10px_40px_rgba(0,0,0,0.95)] gap-4"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {/* Left: Logo (clicking acts as Home) + Major Folders Bar directly underneath */}
        <div className="flex flex-col gap-3 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => switchTab(0)}
            className="inline-flex items-center cursor-pointer transition-opacity hover:opacity-85 bg-transparent p-0"
            title="SARWAR.CYOU"
            style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          >
            <LaserSparkLogo width={240} height={32} interactive={false} />
          </button>

          {/* Major Folders (Pure text, zero lines, zero outlines, zero borders) */}
          <nav className="flex items-center gap-5 sm:gap-6">
            <button
              type="button"
              onClick={() => switchTab(1)}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent ${
                tabIndex === 1 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Photographs
            </button>
            <button
              type="button"
              onClick={() => switchTab(3)}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent ${
                tabIndex === 3 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Video Clips
            </button>
            <button
              type="button"
              onClick={() => switchTab(2)}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent ${
                tabIndex === 2 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Shorts
            </button>
            <button
              type="button"
              onClick={() => switchTab(4)}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent ${
                tabIndex === 4 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Bandhobi
            </button>
          </nav>
        </div>

        {/* Center: Top-Middle Network Status (Silent on Wi-Fi) */}
        <div className="flex-1 flex justify-center pt-1">
          <TopMiddleNetworkStatus />
        </div>

        {/* Right: Clean Tactical Telemetry Graph (Zero Text Noise) */}
        <div className="shrink-0">
          <TacticalTelemetryGraph />
        </div>
      </header>

      {/* MIDDLE PAGE SPACE: HOMEPAGE SLIDING SHORTS OR RECTANGULAR MEDIA GRID */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden px-6 sm:px-10 py-4 relative z-10 scrollbar-none flex flex-col"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {tabIndex === 0 ? (
          /* Homepage: Latest Shorts Auto-Playing and Sliding Right-to-Left */
          <div className="w-full h-full flex items-center justify-start overflow-hidden">
            <HomepageSlidingShorts
              shorts={allShortsFiles}
              onOpenShort={(item: StageMediaItem, playlist: StageMediaItem[], idx: number) => onOpenShort(item, playlist, idx, 'Shorts')}
            />
          </div>
        ) : (
          /* Media Pages: Monolith Rectangular Grid (Zero Text, Enlarges on Hover) */
          <div
            className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pb-6"
            style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          >
            {currentActiveList.map((item: StageMediaItem, idx: number) => (
              <LivingMediaCard
                key={`${item.id || item.url || item.name}-${idx}`}
                item={item}
                aspectRatio={
                  tabIndex === 1
                    ? '3/4'
                    : tabIndex === 2
                    ? '9/16'
                    : tabIndex === 3
                    ? '16/9'
                    : item.mediaType === 'short'
                    ? '9/16'
                    : isPhotoExtension(item.path || item.url || item.name || '')
                    ? '3/4'
                    : '16/9'
                }
                delayIdx={idx}
                onClick={() => handleOpenItem(item, idx)}
              />
            ))}
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION BAR: DYNAMIC SUBFOLDERS (Pure text, zero borders, zero outlines) */}
      <footer
        className="w-full px-6 sm:px-10 py-3 sm:py-4 shrink-0 z-20 flex items-center bg-transparent min-h-[44px]"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {tabIndex !== 0 && (
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none">
            {currentSubfolderList.map((sub) => {
              const isActive = currentSubfolder === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => handleSelectSubfolder(sub)}
                  className={`text-[11.5px] sm:text-[12px] tracking-wide transition-colors cursor-pointer whitespace-nowrap p-0 bg-transparent ${
                    isActive ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
                  }`}
                  style={{ borderRadius: 0, outline: 'none', border: 'none' }}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        )}
      </footer>
    </div>
  );
};

export default MonolithBarGate;
