import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Maximize2,
  Tag,
  Image as ImageIcon,
  Newspaper,
  Film,
  Play,
} from 'lucide-react';
import celebrityData from '../data/celebrityGallery.json';
import celebrityNewsData from '../data/celebrityNews.json';
import latestMusicReleasesData from '../data/latestMusicReleases.json';
import actressesRegistryData from '../data/actressesRegistry.json';
import type { StageMediaItem, AlbumData } from '../types';
import { MediaModal } from './MediaModal';
import { YouTubeTheaterModal } from './YouTubeTheaterModal';
import { hapticMedium } from '../utils/hapticsManager';
import { CelebrityNewsPaper } from './CelebrityNewsPaper';
import { trackActivityEvent } from '../utils/usageTelemetry';
import { useBackButton } from '../utils/backButtonManager';

export interface CelebrityItem {
  id: string;
  name: string;
  title: string;
  category: string;
  src: string;
  thumb: string;
  aspect: 'portrait' | 'landscape';
  timestamp?: number;
}

export interface CelebrityNewsItem {
  id: string;
  celebrity: string;
  headline: string;
  summary: string;
  source: string;
  sourceUrl: string;
  imageUrl?: string;
  publishedAt: string;
  category: 'Filmfare' | 'Production' | 'Event' | 'Interview' | string;
}

export interface CelebrityShowcaseProps {
  onOpenPhoto?: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  className?: string;
  initialTab?: 'PORTRAITS' | 'DISPATCHES' | 'REELS';
  initialFilter?: string;
  initialVideoId?: string | null;
  hideViewTabs?: boolean;
  subfolderBar?: React.ReactNode;
  onTabChange?: (tab: 'PORTRAITS' | 'DISPATCHES' | 'REELS') => void;
  onFilterChange?: (filter: string) => void;
  onVideoChange?: (videoId: string | null) => void;
}

export const REGION_TABS = [
  { id: 'ALL', label: 'ALL', count: 50 },
  { id: 'BANGLADESH', label: 'BANGLADESH', count: 12 },
  { id: 'BOLLYWOOD', label: 'BOLLYWOOD', count: 12 },
  { id: 'SOUTH_INDIA', label: 'SOUTH INDIA', count: 13 },
  { id: 'PAKISTAN', label: 'PAKISTAN', count: 9 },
  { id: 'BHOJPURI', label: 'BHOJPURI', count: 4 },
];

function toStageMediaItem(entry: CelebrityItem): StageMediaItem {
  return {
    id: entry.id,
    title: entry.title,
    name: entry.name,
    url: entry.src,
    path: entry.src,
    thumbnail: entry.thumb || entry.src,
    category: entry.category || 'Celebrity',
    type: 'image',
    mediaType: 'photo',
    parentAlbum: 'Celebrity Wallpapers',
  };
}

export const CelebrityShowcase: React.FC<CelebrityShowcaseProps> = ({
  onOpenPhoto,
  className = '',
  initialTab,
  initialFilter,
  initialVideoId,
  hideViewTabs = false,
  subfolderBar,
  onTabChange,
  onFilterChange,
  onVideoChange,
}) => {
  const [activeTab, setActiveTab] = useState<'PORTRAITS' | 'DISPATCHES' | 'REELS'>(initialTab || 'PORTRAITS');
  const [showcaseDirection, setShowcaseDirection] = useState<'right' | 'left'>('right');
  const SHOWCASE_TABS = useMemo(() => ['PORTRAITS', 'DISPATCHES', 'REELS'], []);

  const switchShowcaseTab = useCallback((newTab: 'PORTRAITS' | 'DISPATCHES' | 'REELS') => {
    if (activeTab === newTab) return;
    const oldIdx = SHOWCASE_TABS.indexOf(activeTab);
    const newIdx = SHOWCASE_TABS.indexOf(newTab);
    setShowcaseDirection(newIdx >= oldIdx ? 'right' : 'left');
    setActiveTab(newTab);
    onTabChange?.(newTab);
  }, [activeTab, SHOWCASE_TABS, onTabChange]);

  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter || 'ALL');

  // Auto-detect region when an actress is selected
  useEffect(() => {
    if (activeFilter && activeFilter !== 'ALL') {
      const found = (actressesRegistryData as Array<{ name: string; region: string }>).find(
        (a) => a.name.toLowerCase() === activeFilter.toLowerCase()
      );
      if (found && found.region) {
        setSelectedRegion(found.region);
      }
    }
  }, [activeFilter]);

  const visibleActresses = useMemo(() => {
    const list = actressesRegistryData as Array<{
      id: string;
      slug: string;
      name: string;
      label: string;
      region: string;
      avatar: string;
      country: string;
    }>;
    if (selectedRegion === 'ALL') return list;
    return list.filter((a) => a.region === selectedRegion);
  }, [selectedRegion]);

  const regionalActressNames = useMemo(() => {
    if (selectedRegion === 'ALL') return null;
    return new Set(
      (actressesRegistryData as Array<{ name: string; region: string }>)
        .filter((a) => a.region === selectedRegion)
        .map((a) => a.name.toLowerCase())
    );
  }, [selectedRegion]);

  const handleSelectRegion = useCallback((regionId: string) => {
    hapticMedium();
    setSelectedRegion(regionId);
    // If current filtered actress is not in the newly selected region, reset filter to ALL
    if (activeFilter !== 'ALL') {
      const found = (actressesRegistryData as Array<{ name: string; region: string }>).find(
        (a) => a.name.toLowerCase() === activeFilter.toLowerCase()
      );
      if (regionId !== 'ALL' && (!found || found.region !== regionId)) {
        setActiveFilter('ALL');
        onFilterChange?.('ALL');
      }
    }
  }, [activeFilter, onFilterChange]);

  const handleSelectFilter = useCallback((filterId: string) => {
    setActiveFilter(filterId);
    onFilterChange?.(filterId);
  }, [onFilterChange]);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialFilter && initialFilter !== activeFilter) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter]);
  const [internalModalState, setInternalModalState] = useState<{
    isOpen: boolean;
    currentIndex: number;
    activeItem: StageMediaItem | null;
  }>({
    isOpen: false,
    currentIndex: 0,
    activeItem: null,
  });

  const [isTheaterOpen, setIsTheaterOpen] = useState(false);
  const [theaterIndex, setTheaterIndex] = useState(0);

  // Auto-hide horizontal filter scrollbar (visible only while scrolling)
  const [isFilterScrolling, setIsFilterScrolling] = useState(false);
  const filterScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFilterScroll = useCallback(() => {
    setIsFilterScrolling(true);
    if (filterScrollTimerRef.current) {
      clearTimeout(filterScrollTimerRef.current);
    }
    filterScrollTimerRef.current = setTimeout(() => {
      setIsFilterScrolling(false);
    }, 850);
  }, []);

  useEffect(() => {
    return () => {
      if (filterScrollTimerRef.current) {
        clearTimeout(filterScrollTimerRef.current);
      }
    };
  }, []);

  // Map latestMusicReleases to StageMediaItem[]
  const cinemaReelItems: StageMediaItem[] = useMemo(() => {
    return (latestMusicReleasesData as Array<{
      id: string;
      title: string;
      actress: string;
      channel: string;
      publishedAt: string;
      thumbnail: string;
    }>).map((rel) => ({
      id: rel.id,
      title: rel.title,
      name: `${rel.title} - ${rel.actress}`,
      url: `https://www.youtube-nocookie.com/embed/${rel.id}`,
      thumbnail: rel.thumbnail,
      category: 'CINEMA REELS',
      type: 'video' as const,
      mediaType: 'clip' as const,
      parentAlbum: 'CINEMA REELS',
      poster: rel.thumbnail,
      posterUrl: rel.thumbnail,
      date: new Date(rel.publishedAt).getTime(),
      actress: rel.actress,
      channel: rel.channel,
      publishedAt: rel.publishedAt,
    } as StageMediaItem & { actress?: string; channel?: string; publishedAt?: string }));
  }, []);

  // Filter cinema reels by activeFilter (actress or 'ALL') and selectedRegion
  const filteredCinemaReels = useMemo(() => {
    let list = cinemaReelItems;
    if (activeFilter !== 'ALL') {
      const filter = activeFilter.toLowerCase();
      list = list.filter((item: any) => {
        const act = (item.actress || '').toLowerCase();
        return act.includes(filter) || filter.includes(act);
      });
    } else if (regionalActressNames) {
      list = list.filter((item: any) => {
        const act = (item.actress || '').toLowerCase();
        return regionalActressNames.has(act);
      });
    }
    return list;
  }, [cinemaReelItems, activeFilter, regionalActressNames]);

  const cinemaReelsAlbum: AlbumData = useMemo(() => ({
    id: 'cinema-reels-archive',
    index: 0,
    name: 'CINEMA REELS',
    type: 'video' as const,
    itemCount: filteredCinemaReels.length,
    items: filteredCinemaReels,
    layoutType: 'grid-wall' as const,
    subtitle: 'Verified Actress Music Releases',
  }), [filteredCinemaReels]);

  const handleOpenCinemaReel = useCallback((index: number) => {
    hapticMedium();
    trackActivityEvent(1);
    setTheaterIndex(index);
    setIsTheaterOpen(true);
    const videoItem = filteredCinemaReels[index];
    if (videoItem) {
      onVideoChange?.(videoItem.id);
    }
  }, [filteredCinemaReels, onVideoChange]);

  const handleCloseTheater = useCallback(() => {
    setIsTheaterOpen(false);
    onVideoChange?.(null);
  }, [onVideoChange]);

  useEffect(() => {
    if (!initialVideoId) return;
    const idx = cinemaReelItems.findIndex((it) => it.id === initialVideoId);
    if (idx !== -1) {
      setTheaterIndex(idx);
      setIsTheaterOpen(true);
    }
  }, [initialVideoId, cinemaReelItems]);

  useBackButton(
    useCallback(() => {
      if (isTheaterOpen) {
        handleCloseTheater();
        return true;
      }
      return false;
    }, [isTheaterOpen, handleCloseTheater])
  );

  // 1. Scroll Controller with Dynamic Height Measurement & Direction Hysteresis
  const [headerVisible, setHeaderVisible] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(185);
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Measure actual rendered header height dynamically (handles mobile wrapping, font sizing, orientations)
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateHeight = () => {
      if (el) {
        const height = el.offsetHeight;
        if (height > 0) {
          setHeaderHeight(height);
        }
      }
    };

    updateHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(el);
    }

    window.addEventListener('resize', updateHeight);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [activeTab]);

  useEffect(() => {
    const handleScroll = (currentScrollY: number) => {
      const scrollPos = Math.max(0, currentScrollY);
      const delta = scrollPos - lastScrollY.current;

      // Guard: Always show and never oscillate when within headerHeight from the top
      if (scrollPos <= headerHeight) {
        setHeaderVisible(true);
        accumulatedDelta.current = 0;
        lastScrollY.current = scrollPos;
        return;
      }

      // Accumulate direction delta (reset on direction reversal)
      if ((delta > 0 && accumulatedDelta.current < 0) || (delta < 0 && accumulatedDelta.current > 0)) {
        accumulatedDelta.current = 0;
      }
      accumulatedDelta.current += delta;

      // Require deliberate 35px continuous threshold before toggling
      if (accumulatedDelta.current > 35) {
        setHeaderVisible(false); // Definite scroll down
      } else if (accumulatedDelta.current < -35) {
        setHeaderVisible(true);  // Definite scroll up
      }

      lastScrollY.current = scrollPos;
    };

    const container = scrollContainerRef.current;
    const onContainerScroll = () => {
      if (container) handleScroll(container.scrollTop);
    };
    const onWindowScroll = () => {
      handleScroll(window.scrollY);
    };

    if (container) {
      container.addEventListener('scroll', onContainerScroll, { passive: true });
    }
    window.addEventListener('scroll', onWindowScroll, { passive: true });

    return () => {
      if (container) {
        container.removeEventListener('scroll', onContainerScroll);
      }
      window.removeEventListener('scroll', onWindowScroll);
    };
  }, [headerHeight]);

  const rawWallpapers = (celebrityData as CelebrityItem[]) || [];
  const rawNews = (celebrityNewsData as CelebrityNewsItem[]) || [];

  const filteredWallpapers = useMemo(() => {
    let list = rawWallpapers;
    if (activeFilter !== 'ALL') {
      const lower = activeFilter.toLowerCase();
      list = list.filter((item) => item.name.toLowerCase() === lower);
    } else if (regionalActressNames) {
      list = list.filter((item) => regionalActressNames.has(item.name.toLowerCase()));
    }
    return list;
  }, [rawWallpapers, activeFilter, regionalActressNames]);

  const filteredNews = useMemo(() => {
    let list = rawNews;
    if (activeFilter !== 'ALL') {
      const lower = activeFilter.toLowerCase();
      list = list.filter((item) => item.celebrity.toLowerCase() === lower);
    } else if (regionalActressNames) {
      list = list.filter((item) => regionalActressNames.has(item.celebrity.toLowerCase()));
    }
    return list;
  }, [rawNews, activeFilter, regionalActressNames]);

  const stagePlaylist = useMemo(() => {
    return filteredWallpapers.map(toStageMediaItem);
  }, [filteredWallpapers]);

  const handleCardClick = useCallback(
    (index: number) => {
      hapticMedium();
      trackActivityEvent(1);
      const targetStageItem = stagePlaylist[index];
      if (!targetStageItem) return;

      if (onOpenPhoto) {
        onOpenPhoto(targetStageItem, stagePlaylist, index);
      } else {
        setInternalModalState({
          isOpen: true,
          currentIndex: index,
          activeItem: targetStageItem,
        });
      }
    },
    [onOpenPhoto, stagePlaylist]
  );

  return (
    <div className={`w-full h-full flex flex-col min-w-0 select-none relative overflow-hidden bg-transparent ${className}`}>
      {/* 1. Header Bar: Title, View Switcher & Minimalist Flat Filters (Decoupled from Document Flow) */}
      <header
        ref={headerRef}
        className={`celebrity-header-wrapper showcase-control-header ${
          headerVisible ? 'visible' : 'hidden'
        } flex flex-col gap-3.5`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div>
              <h1 className="text-base sm:text-lg font-serif font-bold tracking-widest text-[#f4f4f5] uppercase">
                {hideViewTabs
                  ? activeTab === 'DISPATCHES'
                    ? 'CELEBRITY PRESS INTELLIGENCE'
                    : activeTab === 'PORTRAITS'
                    ? 'CELEBRITY PORTRAITS'
                    : 'OFFICIAL VIDEO RELEASES'
                  : 'CELEBRITY ARCHIVE'}
              </h1>
              <p className="text-[10px] sm:text-[11px] tracking-wide text-neutral-400 line-clamp-1 sm:line-clamp-none">
                {hideViewTabs
                  ? activeTab === 'DISPATCHES'
                    ? 'Daily Verified Dispatches • South Asian Film & Entertainment Coverage'
                    : activeTab === 'PORTRAITS'
                    ? 'Curated High-Definition Editorial Portraits in True Master Color'
                    : 'Official 16:9 4K Cinema Sequences, Teasers & Music Releases'
                  : 'Curated High-Definition Portraits & Verified Intelligence on Leading Actresses'}
              </p>
            </div>
          </div>

          {subfolderBar ? (
            <div className="flex items-center md:justify-end gap-1.5 overflow-x-auto no-scrollbar max-w-full md:max-w-[70%] shrink-0">
              {subfolderBar}
            </div>
          ) : !hideViewTabs ? (
            <div className="flex items-center gap-2.5">
              {/* View Toggle Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121215] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    switchShowcaseTab('PORTRAITS');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                    activeTab === 'PORTRAITS'
                      ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>PHOTOGRAPHY</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    switchShowcaseTab('DISPATCHES');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                    activeTab === 'DISPATCHES'
                      ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Newspaper className="w-3.5 h-3.5" />
                  <span>NEWS</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    switchShowcaseTab('REELS');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                    activeTab === 'REELS'
                      ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>LATEST VIDEOS</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* 2-Tier Navigation Engine: Guaranteed Flex-Col Separation */}
        <div className="w-full flex flex-col gap-2.5 pt-2 border-t border-white/[0.06] shrink-0">
          {/* Tier 1 Region Filter Pills */}
          <div className="w-full flex items-center gap-2 overflow-x-auto autohide-scrollbar py-1 shrink-0">
            {REGION_TABS.map((tab) => {
              const isRegActive = selectedRegion === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectRegion(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer shrink-0 border ${
                    isRegActive
                      ? 'bg-[#ccff00]/15 text-[#ccff00] border-[#ccff00]/60 shadow-[0_0_10px_rgba(204,255,0,0.25)]'
                      : 'bg-white/[0.03] text-neutral-400 border-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isRegActive ? 'bg-[#ccff00] text-black font-black' : 'bg-white/10 text-neutral-400'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tier 2 Actress Filter Chips */}
          <div
            onScroll={handleFilterScroll}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
                handleFilterScroll();
              }
            }}
            className={`w-full flex items-center gap-2.5 overflow-x-auto autohide-scrollbar py-1 shrink-0 ${
              isFilterScrolling ? 'is-scrolling' : ''
            }`}
          >
            {/* ALL CHIP */}
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                handleSelectFilter('ALL');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono tracking-wider uppercase transition-all duration-150 cursor-pointer shrink-0 border ${
                activeFilter === 'ALL'
                  ? 'bg-white text-black font-black border-white shadow-md'
                  : 'bg-white/[0.02] text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              <span>ALL {selectedRegion === 'ALL' ? '(50)' : `(${visibleActresses.length})`}</span>
            </button>

            {/* DYNAMIC REGIONAL ACTRESSES */}
            {visibleActresses.map((actress) => {
              const isActive = activeFilter === actress.name;
              return (
                <button
                  key={actress.id}
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    handleSelectFilter(actress.name);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono tracking-wider uppercase transition-all duration-150 cursor-pointer shrink-0 border ${
                    isActive
                      ? 'bg-[#ccff00] text-black font-black border-[#ccff00] shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                      : 'bg-white/[0.02] text-neutral-300 border-white/10 hover:border-white/30 hover:text-white'
                  }`}
                >
                  <img
                    src={actress.avatar}
                    alt={actress.name}
                    loading="lazy"
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                  <span>{actress.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Scrollable Container with Static Dummy Spacer (Decoupled from Header Visibility) */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-y-auto space-scrollbar relative"
      >
        {/* Dynamic persistent spacer measured from header ensures document layout height never jumps */}
        <div
          className="celebrity-header-spacer shrink-0"
          style={{ height: `${headerHeight}px` }}
          aria-hidden="true"
        />

        {/* 2. Main Body Content: Portraits vs News Feed vs Cinema Reels */}
        <main className="p-4 sm:p-6 lg:p-8 pt-3 sm:pt-5 pb-20">
          {activeTab === 'PORTRAITS' ? (
            <div key={`portraits-${activeFilter}`} className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-stretch ${showcaseDirection === 'right' ? 'animate-kinetic-slide-right' : 'animate-kinetic-slide-left'}`}>
              {filteredWallpapers.map((item, idx) => {
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleCardClick(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(idx);
                      }
                    }}
                    style={{ animationDelay: `${Math.min(idx * 28, 300)}ms` }}
                    className="group relative rounded-xl overflow-hidden bg-[#0d0d10] border border-white/[0.08] hover:border-[#ccff00] hover:shadow-[0_0_20px_rgba(204,255,0,0.25)] shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] animate-velvet-cascade cursor-pointer flex flex-col justify-end aspect-[3/4]"
                  >
                    {/* Background Image Loading Shimmer Layer */}
                    <div
                      className="absolute inset-0 w-full h-full animate-laser-shimmer pointer-events-none opacity-35 z-0"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent 0%, rgba(204,255,0,0.02) 25%, rgba(204,255,0,0.14) 50%, rgba(255,255,255,0.08) 53%, rgba(204,255,0,0.02) 75%, transparent 100%)',
                      }}
                    />

                    {/* Background Image - Full Natural Color */}
                    <img
                      src={item.thumb || item.src}
                      alt={item.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Ambient Top Vignette */}
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

                    {/* Top Category Badge */}
                    <div className="absolute top-3 right-3 z-10">
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] tracking-wider uppercase text-neutral-300 bg-[#09090b]/80 backdrop-blur-md border border-white/[0.08] group-hover:border-[#ccff00]/40 transition-colors">
                        <Tag className="w-2.5 h-2.5 text-[#ccff00]" />
                        <span>{item.category}</span>
                      </span>
                    </div>

                    {/* Hover Maximize Pip */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                      <div className="w-12 h-12 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.6)] group-hover:scale-110 transition-transform duration-300">
                        <Maximize2 className="w-5 h-5 text-black stroke-[2.5]" />
                      </div>
                    </div>

                    {/* Bottom Dark Gradient Caption Overlay */}
                    <div className="relative z-10 p-4 bg-gradient-to-t from-[#09090b]/95 via-[#09090b]/60 to-transparent flex flex-col gap-1 pointer-events-none">
                      <span className="font-serif font-bold tracking-wide text-sm text-[#f4f4f5] group-hover:text-[#ccff00] transition-colors">
                        {item.name}
                      </span>
                      <span className="font-sans text-xs text-neutral-400 line-clamp-1 leading-snug">
                        {item.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'DISPATCHES' ? (
            /* BROADSHEET NEWSPAPER EDITORIAL SECTION */
            <div key="dispatches-section" className={showcaseDirection === 'right' ? 'animate-kinetic-slide-right' : 'animate-kinetic-slide-left'}>
              <CelebrityNewsPaper
                articles={filteredNews}
                onResetFilter={() => handleSelectFilter('ALL')}
                activeFilter={activeFilter}
              />
            </div>
          ) : (
            /* CINEMA REELS VIEW */
            filteredCinemaReels.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center my-auto min-h-[35vh] text-white/60">
                <Film className="w-10 h-10 text-white/30 mb-3" />
                <p className="text-white/80 text-sm font-semibold tracking-wider uppercase mb-1">
                  No Cinema Reels Found for {activeFilter}
                </p>
                <button
                  type="button"
                  onClick={() => handleSelectFilter('ALL')}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-mono tracking-wider uppercase transition-all cursor-pointer"
                >
                  Show All Releases
                </button>
              </div>
            ) : (
              <div key={`reels-${activeFilter}`} className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-stretch ${showcaseDirection === 'right' ? 'animate-kinetic-slide-right' : 'animate-kinetic-slide-left'}`}>
                {filteredCinemaReels.map((item, idx) => {
                  const itemAny = item as any;
                  const formattedDate = itemAny.publishedAt
                    ? new Date(itemAny.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '';

                  const channelBadgeClass =
                    itemAny.channel === 'T-Series'
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : itemAny.channel === 'Zee Music Company'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : itemAny.channel === 'Sony Music India'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : itemAny.channel === 'YRF'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-white/10 text-white/90 border-white/20';

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenCinemaReel(idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenCinemaReel(idx);
                        }
                      }}
                      style={{ animationDelay: `${Math.min(idx * 28, 300)}ms` }}
                      className="group relative rounded-xl overflow-hidden bg-[#0d0d10] border border-white/[0.08] hover:border-[#ccff00] hover:shadow-[0_0_20px_rgba(204,255,0,0.25)] shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] animate-velvet-cascade cursor-pointer flex flex-col justify-between aspect-video select-none"
                    >
                      {/* Background Image Loading Shimmer Layer */}
                      <div
                        className="absolute inset-0 w-full h-full animate-laser-shimmer pointer-events-none opacity-35 z-0"
                        style={{
                          background:
                            'linear-gradient(90deg, transparent 0%, rgba(204,255,0,0.02) 25%, rgba(204,255,0,0.14) 50%, rgba(255,255,255,0.08) 53%, rgba(204,255,0,0.02) 75%, transparent 100%)',
                        }}
                      />

                      {/* 16:9 Thumbnail Cover with Auto Fallback */}
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src.includes('maxresdefault.jpg')) {
                            target.src = target.src.replace('maxresdefault.jpg', 'hqdefault.jpg');
                          } else {
                            const found = (actressesRegistryData as any[]).find((a) => a.name === itemAny.actress);
                            if (found?.avatar) {
                              target.src = found.avatar;
                            }
                          }
                        }}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Ambient Obsidian Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/95 via-[#09090b]/30 to-transparent pointer-events-none" />

                      {/* Top Right Record Label Badge */}
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase backdrop-blur-md border shadow-md ${channelBadgeClass}`}>
                          {itemAny.channel || 'OFFICIAL'}
                        </span>
                      </div>

                      {/* Center Hover Play Icon */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                        <div className="w-12 h-12 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.6)] group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5 text-black" />
                        </div>
                      </div>

                      {/* Bottom Metadata Bar */}
                      <div className="relative z-10 p-3.5 mt-auto flex flex-col gap-1 pointer-events-none">
                        <h3 className="font-['Roboto_Condensed'] font-bold text-sm sm:text-base text-white group-hover:text-[#ccff00] transition-colors line-clamp-1">
                          {item.title}
                        </h3>
                        <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                          <span className="text-zinc-300 font-medium group-hover:text-white transition-colors">
                            {itemAny.actress}
                          </span>
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </main>
      </div>

      {/* Fallback Internal MediaModal (used if onOpenPhoto is omitted) */}
      {!onOpenPhoto && internalModalState.isOpen && internalModalState.activeItem && (
        <MediaModal
          isOpen={internalModalState.isOpen}
          onClose={() =>
            setInternalModalState((prev) => ({ ...prev, isOpen: false }))
          }
          type="image"
          url={internalModalState.activeItem.url}
          title={internalModalState.activeItem.title}
          items={stagePlaylist}
          currentIndex={internalModalState.currentIndex}
          onIndexChange={(newIdx) => {
            const next = stagePlaylist[newIdx];
            if (next) {
              setInternalModalState((prev) => ({
                ...prev,
                currentIndex: newIdx,
                activeItem: next,
              }));
            }
          }}
        />
      )}

      {/* In-App Native YouTube Theater Modal for Cinema Reels */}
      <YouTubeTheaterModal
        isOpen={isTheaterOpen}
        onClose={handleCloseTheater}
        album={cinemaReelsAlbum}
        allAlbums={[cinemaReelsAlbum]}
        initialIndex={theaterIndex}
        title={filteredCinemaReels[theaterIndex]?.title}
        onIndexChange={(newIdx) => {
          setTheaterIndex(newIdx);
          onVideoChange?.(filteredCinemaReels[newIdx]?.id || null);
        }}
      />
    </div>
  );
};

export default CelebrityShowcase;
