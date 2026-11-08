import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { getRandomCinematicTheme, type CinematicTheme } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { useScrambleText } from './useScrambleText';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { getMediaUrl, getThumbnailUrl, getImageUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { sanitizeMediaTitle } from '../../utils/titleSanitizer';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { sortSubfolderNodesDescending, type DirectoryNode } from '../DeepSpaceTreeExplorer';

export interface MonolithBarGateProps {
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  initialAlbum?: string;
  isModalOpen?: boolean;
}

const HUBS = [
  { key: 'CLIPS', rawName: 'Clips', label: 'CLIPS' },
  { key: 'SHORTS', rawName: 'Shorts', label: 'SHORTS' },
  { key: 'PHOTOGRAPHY', rawName: 'Images', label: 'PHOTOGRAPHY' },
  { key: 'REALTUBE', rawName: 'REALTube', label: 'REALTUBE' },
];

const STORAGE_KEY = 'sarwar_daily_ledger_v1';

// Seed realistic historical session minutes if not present (between 35m and 165m)
const SEED_MINUTES = [45, 78, 115, 38, 142, 64, 98];

interface DayData {
  dateKey: string;      // "YYYY-MM-DD"
  dateLabel: string;    // "NOV 01"
  seconds: number;
  isToday: boolean;
}

// Format seconds into H.MM (e.g. 1 hr 25 min -> "1.25", 45 min -> "0.45")
export function formatHoursMinutes(totalSeconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}.${String(minutes).padStart(2, '0')}`;
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

  if (/^(?:video\s*clips|clips)$/i.test(root)) {
    root = 'Clips';
  } else if (/^(?:photographs|images|photography)$/i.test(root)) {
    root = 'Images';
  } else if (/^shorts$/i.test(root)) {
    root = 'Shorts';
  } else if (/^realtube$/i.test(root)) {
    root = 'REALTube';
  } else {
    if (item.mediaType === 'short' || item.category?.toLowerCase().includes('short') || item.url?.toLowerCase().includes('short')) {
      root = 'Shorts';
      sub = dirParts.length > 0 ? dirParts : ['Shorts Classic'];
    } else if (item.type === 'image' || isPhotoExtension(item.url || item.name)) {
      root = 'Images';
      sub = dirParts.length > 0 ? dirParts : ['Images 2027'];
    } else {
      root = 'Clips';
      sub = dirParts.length > 0 ? dirParts : ['Favorite'];
    }
  }

  if (sub.length === 0) {
    if (root === 'Shorts') sub = ['Shorts Classic'];
    else if (root === 'REALTube') sub = ['REALTube Shorts'];
    else if (root === 'Images') sub = ['Images 2027'];
    else sub = ['Favorite'];
  }

  return { root, subfolders: sub };
}

const ScrambledHubItem: React.FC<{
  label: string;
  isActive: boolean;
  isUnlocked: boolean;
  onClick: (e: React.MouseEvent) => void;
}> = ({ label, isActive, isUnlocked, onClick }) => {
  const scrambled = useScrambleText(label, isUnlocked, 350);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left font-['Roboto',sans-serif] uppercase transition-all duration-200 cursor-pointer select-none border-0 outline-none p-0 bg-transparent flex items-center gap-2.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${
        isActive
          ? 'text-white font-bold tracking-[0.25em] text-xl md:text-2xl scale-[1.02] origin-left'
          : 'text-neutral-400 font-medium tracking-[0.2em] text-lg hover:text-white'
      }`}
    >
      {isActive && (
        <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-pulse" />
      )}
      {scrambled}
    </button>
  );
};

export const MonolithBarGate: React.FC<MonolithBarGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum,
  isModalOpen = false,
}) => {
  // Atmospheric theme for canvas particles
  const [theme] = useState<CinematicTheme>(() => getRandomCinematicTheme());

  // Gate state
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);

  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Daily Ledger & Real-Time Accumulation (8 Days)
  const [ledger, setLedger] = useState<{ [dateKey: string]: number }>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return {};
  });

  // Track session seconds in memory and sync periodically
  const sessionSecondsRef = useRef(0);

  useEffect(() => {
    // Generate dates for the last 8 calendar days
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    setLedger((prev) => {
      const updated = { ...prev };
      let changed = false;

      for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        if (updated[k] === undefined) {
          if (k === todayKey) {
            updated[k] = 25 * 60; // 25 min baseline for today
          } else {
            const seedIdx = (7 - i) % SEED_MINUTES.length;
            updated[k] = SEED_MINUTES[seedIdx] * 60;
          }
          changed = true;
        }
      }

      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
      return updated;
    });

    // Real-time dynamic accumulation timer (ticks every second)
    const interval = window.setInterval(() => {
      sessionSecondsRef.current += 1;
      const todayDate = new Date();
      const currentTodayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

      setLedger((prev) => {
        const currentVal = prev[currentTodayKey] || 0;
        const nextVal = currentVal + 1;
        const updated = { ...prev, [currentTodayKey]: nextVal };

        // Sync to storage every 10 seconds to avoid excessive I/O
        if (sessionSecondsRef.current % 10 === 0) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // ignore
          }
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Compute 8 days data array
  const dayBars: DayData[] = useMemo(() => {
    const bars: DayData[] = [];
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
      const seconds = ledger[k] || 0;

      bars.push({
        dateKey: k,
        dateLabel: label,
        seconds,
        isToday: k === todayKey,
      });
    }

    return bars;
  }, [ledger]);

  // Determine scaling based on maximum minutes (min 120 minutes)
  const maxMinutes = useMemo(() => {
    const mins = dayBars.map((b) => Math.floor(b.seconds / 60));
    return Math.max(...mins, 120);
  }, [dayBars]);

  // Build directory tree
  const rootMap = useMemo(() => {
    const map = new Map<string, DirectoryNode>();

    for (const item of items) {
      const { root, subfolders } = getFolderSegments(item);
      if (!map.has(root)) {
        map.set(root, {
          name: root,
          fullPath: root,
          subfolders: new Map(),
          files: [],
        });
      }

      let currentNode = map.get(root)!;
      let currentMap = currentNode.subfolders;

      for (const seg of subfolders) {
        if (!currentMap.has(seg)) {
          currentMap.set(seg, {
            name: seg,
            fullPath: `${currentNode.fullPath}/${seg}`,
            subfolders: new Map(),
            files: [],
          });
        }
        currentNode = currentMap.get(seg)!;
        currentMap = currentNode.subfolders;
      }

      currentNode.files.push(item);
    }

    for (const node of map.values()) {
      const sortRecursive = (n: DirectoryNode) => {
        n.files = sortMediaItemsDescending(n.files);
        for (const sub of n.subfolders.values()) {
          sortRecursive(sub);
        }
      };
      sortRecursive(node);
    }

    return map;
  }, [items]);

  // URL deep link auto-unlock
  useEffect(() => {
    if (!initialAlbum || items.length === 0) return;
    const cleanTarget = initialAlbum.toLowerCase().replace(/[-_\s]+/g, '');

    for (const hub of HUBS) {
      const rootNode = rootMap.get(hub.rawName);
      if (!rootNode) continue;

      if (hub.rawName.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
        const sortedSubs = sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
        setIsUnlocked(true);
        setSelectedHub(hub.key);
        setSelectedSubfolder(sortedSubs[0]?.name || null);
        return;
      }

      for (const sub of rootNode.subfolders.values()) {
        if (sub.name.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
          setIsUnlocked(true);
          setSelectedHub(hub.key);
          setSelectedSubfolder(sub.name);
          return;
        }
      }
    }
  }, [initialAlbum, items.length, rootMap]);

  // Hub selection handler
  const handleSelectHub = (hubKey: string, rawName: string) => {
    if (selectedHub === hubKey) {
      setSelectedHub(null);
      setSelectedSubfolder(null);
      return;
    }

    setSelectedHub(hubKey);
    const rootNode = rootMap.get(rawName);
    if (rootNode && rootNode.subfolders.size > 0) {
      const sortedSubs = sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
      setSelectedSubfolder(sortedSubs[0]?.name || null);
    } else {
      setSelectedSubfolder(null);
    }
  };

  const currentSubfolders = useMemo(() => {
    if (!selectedHub) return [];
    const activeHubConfig = HUBS.find((h) => h.key === selectedHub);
    if (!activeHubConfig) return [];
    const rootNode = rootMap.get(activeHubConfig.rawName);
    if (!rootNode) return [];
    return sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
  }, [selectedHub, rootMap]);

  const activeDirectoryNode = useMemo(() => {
    if (!selectedHub || !selectedSubfolder) return null;
    const activeHubConfig = HUBS.find((h) => h.key === selectedHub);
    if (!activeHubConfig) return null;
    const rootNode = rootMap.get(activeHubConfig.rawName);
    if (!rootNode) return null;
    return rootNode.subfolders.get(selectedSubfolder) || null;
  }, [selectedHub, selectedSubfolder, rootMap]);

  const { photoFiles, videoFiles, shortFiles } = useMemo(() => {
    if (!activeDirectoryNode) return { photoFiles: [], videoFiles: [], shortFiles: [] };

    const photos: StageMediaItem[] = [];
    const videos: StageMediaItem[] = [];
    const shorts: StageMediaItem[] = [];

    const isShortDir =
      activeDirectoryNode.fullPath.toLowerCase().includes('short') ||
      (selectedHub === 'SHORTS');

    for (const file of activeDirectoryNode.files) {
      const isPhoto = file.type === 'image' || isPhotoExtension(file.path || file.url || file.name || '');
      if (isPhoto) {
        photos.push(file);
      } else {
        const isShort =
          isShortDir ||
          file.mediaType === 'short' ||
          file.path?.toLowerCase().includes('short') ||
          file.url?.toLowerCase().includes('short');

        if (isShort) shorts.push(file);
        else videos.push(file);
      }
    }

    return {
      photoFiles: sortMediaItemsDescending(photos),
      videoFiles: sortMediaItemsDescending(videos),
      shortFiles: sortMediaItemsDescending(shorts),
    };
  }, [activeDirectoryNode, selectedHub]);

  // Global Escape key listener for conceal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUnlocked && !isModalOpen) {
        if (e.cancelable) e.preventDefault();
        setIsUnlocked(false);
        setSelectedHub(null);
        setSelectedSubfolder(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlocked, isModalOpen]);

  // Backdrop Auto-Conceal: clicking empty backdrop hides the vault
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (isModalOpen) return;
    if (menuContainerRef.current && menuContainerRef.current.contains(e.target as Node)) {
      return;
    }
    if (isUnlocked) {
      setIsUnlocked(false);
      setSelectedHub(null);
      setSelectedSubfolder(null);
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="relative w-full h-[100dvh] overflow-hidden select-none text-white font-['Roboto',sans-serif] bg-[#030406]"
      style={{ isolation: 'isolate' }}
    >
      {/* 1. Ambient Deep Obsidian Backdrop with Drifting Procedural Mist */}
      <CinematicBackdropCanvas theme={theme} isPaused={isModalOpen} />

      {/* 2. Central Stepped Monolith Bar Graph (Interactive Unlock Stage) */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setIsUnlocked(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            setIsUnlocked(true);
          }
        }}
        aria-label="Monolith daily usage bar graph. Tap to decrypt vault."
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[780px] h-[280px] flex flex-col justify-end px-4 sm:px-8 cursor-pointer select-none z-10 outline-none transition-all duration-700 ${
          isUnlocked
            ? 'opacity-0 pointer-events-none scale-95 blur-sm'
            : 'opacity-100 pointer-events-auto scale-100 hover:scale-[1.01]'
        }`}
      >
        <div className="relative w-full h-[230px] flex items-end justify-between gap-2 sm:gap-4 md:gap-6">
          {/* Subtle Continuous Baseline Hair-line behind bottom of the bars */}
          <div className="absolute bottom-[28px] left-0 right-0 h-px bg-white/[0.08] pointer-events-none z-0" />

          {dayBars.map((bar) => {
            const minutes = Math.floor(bar.seconds / 60);
            // Height scaled proportionally between 16px and 165px
            const heightPx = Math.max(16, Math.min(165, Math.round((minutes / maxMinutes) * 165)));

            return (
              <div
                key={bar.dateKey}
                className="group relative flex flex-col items-center justify-end h-full flex-1 max-w-[68px] z-10"
              >
                {/* Tip of Bar: Time Spent Readout (H.MM) */}
                <span
                  className={`font-['Roboto',sans-serif] font-bold text-[0.68rem] sm:text-[0.75rem] md:text-xs tracking-wider mb-2 select-none transition-all duration-200 ${
                    bar.isToday
                      ? 'text-white font-extrabold drop-shadow-[0_0_8px_rgba(255,255,255,0.85)] scale-105'
                      : 'text-neutral-400 group-hover:text-white'
                  }`}
                >
                  {formatHoursMinutes(bar.seconds)}
                </span>

                {/* Monolith Pillar Rectangle */}
                <div
                  style={{ height: `${heightPx}px` }}
                  className={`w-4 sm:w-6 md:w-8 rounded-t-sm transition-all duration-300 ${
                    bar.isToday
                      ? 'bg-white shadow-[0_0_20px_rgba(255,255,255,0.7),0_0_40px_rgba(255,255,255,0.25)]'
                      : 'bg-neutral-800/80 group-hover:bg-neutral-600'
                  }`}
                />

                {/* Bottom of Bar: Calendar Date (e.g. "NOV 08") */}
                <span
                  className={`font-['Roboto',sans-serif] uppercase text-[0.65rem] sm:text-[0.7rem] tracking-wider mt-2.5 whitespace-nowrap select-none transition-colors duration-200 ${
                    bar.isToday
                      ? 'text-white font-bold'
                      : 'text-neutral-500 group-hover:text-neutral-300'
                  }`}
                >
                  {bar.dateLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Fixed Signature at Bottom-Right: "SARWAR.CYOU" */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-10 z-20 pointer-events-none select-none font-['Roboto',sans-serif] font-bold text-xs sm:text-sm tracking-[0.28em] text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
        SARWAR.CYOU
      </div>

      {/* 4. Progressive Navigation Stage (Desktop 3-Tier Cascade + Mobile Adaptive Drill-Down) */}
      <div
        ref={menuContainerRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full h-full select-none z-30 transition-all duration-500 ${
          isUnlocked
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* ========================================================= */}
        {/* DESKTOP 3-TIER HORIZONTAL CASCADE (md: and up)            */}
        {/* ========================================================= */}
        <div className="hidden md:flex flex-row items-center w-full h-full p-6 sm:p-10 md:p-14 gap-6 sm:gap-8 md:gap-10 overflow-x-auto overflow-y-hidden no-scrollbar">
          {/* TIER 1: Left-Middle Navigation Menu (4 Major Hubs) */}
          <div className="flex-shrink-0 flex flex-col justify-center">
            <div className="bg-black/40 backdrop-blur-2xl rounded-2xl p-6 md:p-8 flex flex-col space-y-6 shadow-2xl">
              {HUBS.map((hub) => (
                <ScrambledHubItem
                  key={hub.key}
                  label={hub.label}
                  isActive={selectedHub === hub.key}
                  isUnlocked={isUnlocked}
                  onClick={() => handleSelectHub(hub.key, hub.rawName)}
                />
              ))}
            </div>
          </div>

          {/* TIER 2: Subfolders Column (Smoothly slides open on choosing major hub) */}
          {selectedHub && currentSubfolders.length > 0 && (
            <div className="flex-shrink-0 flex flex-col justify-center min-w-[170px] sm:min-w-[200px] md:min-w-[230px] max-w-[290px] animate-fade-in">
              <div className="bg-black/40 backdrop-blur-2xl rounded-2xl p-5 md:p-6 flex flex-col space-y-3.5 max-h-[75vh] overflow-y-auto no-scrollbar shadow-2xl">
                {currentSubfolders.map((subNode) => {
                  const isSubActive = selectedSubfolder === subNode.name;
                  return (
                    <button
                      key={subNode.name}
                      type="button"
                      onClick={() => setSelectedSubfolder(subNode.name)}
                      className={`text-left font-['Roboto',sans-serif] uppercase transition-all duration-200 cursor-pointer p-0 bg-transparent border-0 outline-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
                        isSubActive
                          ? 'text-white font-bold tracking-wider text-base md:text-lg'
                          : 'text-neutral-400 font-medium tracking-wide text-base md:text-lg hover:text-white'
                      }`}
                    >
                      {subNode.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TIER 3: Edge-to-Edge Media Grid (Responsive Multi-Row Layout, Non-Clipping) */}
          {activeDirectoryNode && (
            <div className="flex-1 min-w-[320px] max-w-[85vw] h-full overflow-y-auto space-scrollbar py-6 sm:py-10 pl-2 pr-4 sm:pr-8 flex flex-col justify-center">
              <div className="my-auto flex flex-col gap-6 w-full max-h-[82vh]">
                {/* Photos: Multi-Row Responsive Grid */}
                {photoFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 p-1">
                    {photoFiles.map((photo, idx) => (
                      <div
                        key={photo.id || idx}
                        onClick={() => onOpenPhoto(photo, photoFiles, idx)}
                        className="relative aspect-square cursor-pointer overflow-hidden rounded-xl group bg-neutral-900/40 backdrop-blur-sm transition-all duration-300 transform border-0 shadow-lg hover:shadow-2xl hover:scale-[1.03]"
                      >
                        <img
                          src={getMediaUrl(photo.url)}
                          alt={photo.title || photo.name || 'Photo'}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) parent.classList.add('bg-neutral-900');
                          }}
                          className="w-full h-full object-cover rounded-xl transition-all duration-300 group-hover:brightness-110"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Videos: 16:9 Landscape Widescreen Cards Grid */}
                {videoFiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-5 p-1">
                    {videoFiles.map((video) => {
                      const cleanTitle = sanitizeMediaTitle(video.title || video.name, activeDirectoryNode.name);
                      const thumb = getThumbnailUrl(video) || resolveStaticVideoThumbnail(video);
                      return (
                        <div
                          key={video.id || video.url}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenVideo(video, videoFiles)}
                          className="group flex flex-col gap-2 cursor-pointer select-none text-left transition-all duration-300 transform hover:-translate-y-1"
                        >
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-900/60 backdrop-blur-sm border-0 shadow-lg group-hover:shadow-2xl transition-all duration-200">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={cleanTitle}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                <Play className="w-6 h-6 text-neutral-400" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                              <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <span className="text-xs sm:text-sm font-['Roboto',sans-serif] uppercase line-clamp-2 leading-snug text-neutral-300 group-hover:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                            {cleanTitle}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Shorts: 9:16 Vertical Cards Grid */}
                {shortFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 p-1">
                    {shortFiles.map((short, idx) => {
                      const cleanTitle = sanitizeMediaTitle(short.title || short.name, activeDirectoryNode.name);
                      const thumb = getImageUrl(short) || getThumbnailUrl(short) || resolveStaticVideoThumbnail(short);
                      return (
                        <div
                          key={short.id || short.url}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenShort(short, shortFiles, idx, activeDirectoryNode.name)}
                          className="group flex flex-col gap-2 cursor-pointer select-none text-left transition-all duration-300 transform hover:-translate-y-1"
                        >
                          <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-neutral-900/60 backdrop-blur-sm border-0 shadow-lg group-hover:shadow-2xl transition-all duration-200">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={cleanTitle}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                <Play className="w-5 h-5 text-neutral-400" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                              <div className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <span className="text-xs sm:text-sm font-['Roboto',sans-serif] uppercase line-clamp-2 leading-snug text-neutral-300 group-hover:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                            {cleanTitle}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* MOBILE ADAPTIVE VIEW (< md, 418px mobile screens)         */}
        {/* ========================================================= */}
        <div className="md:hidden flex flex-col w-full h-full pt-14 pb-4 px-4 overflow-hidden">
          {!selectedHub ? (
            /* Mobile Step 1: Centered 4 Major Hubs */
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="w-full max-w-xs bg-black/50 backdrop-blur-2xl rounded-2xl p-6 flex flex-col space-y-6 shadow-2xl">
                <div className="text-[10px] font-['Roboto',sans-serif] tracking-[0.25em] text-neutral-400 uppercase pb-2 border-b border-white/10 text-center">
                  SELECT HUB
                </div>
                {HUBS.map((hub) => (
                  <ScrambledHubItem
                    key={hub.key}
                    label={hub.label}
                    isActive={selectedHub === hub.key}
                    isUnlocked={isUnlocked}
                    onClick={() => handleSelectHub(hub.key, hub.rawName)}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Mobile Step 2: Top Subfolder Switcher & Full-Width Media Grid */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Mobile Header Bar with Back Button & Subfolder Pills */}
              <div className="flex-shrink-0 flex items-center gap-2 pb-3 mb-2 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHub(null);
                    setSelectedSubfolder(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-['Roboto',sans-serif] tracking-wider uppercase flex items-center gap-1 active:scale-95 transition-transform flex-shrink-0"
                >
                  ← HUBS
                </button>

                {/* Horizontal Scrollable Subfolder Selector */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 py-1">
                  {currentSubfolders.map((subNode) => {
                    const isSubActive = selectedSubfolder === subNode.name;
                    return (
                      <button
                        key={subNode.name}
                        type="button"
                        onClick={() => setSelectedSubfolder(subNode.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-['Roboto',sans-serif] uppercase whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                          isSubActive
                            ? 'bg-white/20 text-white font-bold shadow-md'
                            : 'bg-black/40 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {subNode.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full-Width Mobile Media Stage */}
              <div className="flex-1 overflow-y-auto space-scrollbar py-2">
                {activeDirectoryNode && (
                  <div className="flex flex-col gap-5 pb-8">
                    {/* Photos Grid */}
                    {photoFiles.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {photoFiles.map((photo, idx) => (
                          <div
                            key={photo.id || idx}
                            onClick={() => onOpenPhoto(photo, photoFiles, idx)}
                            className="relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-neutral-900/50 backdrop-blur-sm border-0 shadow-md active:scale-95 transition-transform"
                          >
                            <img
                              src={getMediaUrl(photo.url)}
                              alt={photo.title || photo.name || 'Photo'}
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) parent.classList.add('bg-neutral-900');
                              }}
                              className="w-full h-full object-cover rounded-xl"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Videos Grid */}
                    {videoFiles.length > 0 && (
                      <div className="grid grid-cols-1 gap-4">
                        {videoFiles.map((video) => {
                          const cleanTitle = sanitizeMediaTitle(video.title || video.name, activeDirectoryNode.name);
                          const thumb = getThumbnailUrl(video) || resolveStaticVideoThumbnail(video);
                          return (
                            <div
                              key={video.id || video.url}
                              role="button"
                              tabIndex={0}
                              onClick={() => onOpenVideo(video, videoFiles)}
                              className="group flex flex-col gap-1.5 cursor-pointer select-none text-left active:scale-[0.98] transition-transform"
                            >
                              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-900/60 backdrop-blur-sm border-0 shadow-lg">
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={cleanTitle}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover object-center"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                    <Play className="w-6 h-6 text-neutral-400" />
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-['Roboto',sans-serif] uppercase line-clamp-2 leading-snug text-neutral-300">
                                {cleanTitle}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Shorts Grid */}
                    {shortFiles.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {shortFiles.map((short, idx) => {
                          const cleanTitle = sanitizeMediaTitle(short.title || short.name, activeDirectoryNode.name);
                          const thumb = getImageUrl(short) || getThumbnailUrl(short) || resolveStaticVideoThumbnail(short);
                          return (
                            <div
                              key={short.id || short.url}
                              role="button"
                              tabIndex={0}
                              onClick={() => onOpenShort(short, shortFiles, idx, activeDirectoryNode.name)}
                              className="group flex flex-col gap-1.5 cursor-pointer select-none text-left active:scale-[0.98] transition-transform"
                            >
                              <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-neutral-900/60 backdrop-blur-sm border-0 shadow-lg">
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={cleanTitle}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover object-center"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                    <Play className="w-5 h-5 text-neutral-400" />
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-['Roboto',sans-serif] uppercase line-clamp-2 leading-snug text-neutral-300">
                                {cleanTitle}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonolithBarGate;