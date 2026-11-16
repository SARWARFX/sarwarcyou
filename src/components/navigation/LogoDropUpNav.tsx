import React, { useState, useEffect, useMemo, useRef } from 'react';
import { hapticLight, hapticMedium } from '../../utils/hapticsManager';
import { type Telemetry7DayEntry } from '../../utils/usageTelemetry';
import { LaserSparkLogo } from '../brand/LaserSparkLogo';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import type { StageMediaItem } from '../../types';

export type MainDirectoryTab = 'Photographs' | 'Shorts' | 'Video Clips' | 'Bandhobi';

export const DIRECTORY_SUBFOLDERS: Record<MainDirectoryTab, string[]> = {
  Photographs: ['Favorite', '2027', '2026', '2025', 'Older'],
  'Video Clips': ['Favorite', '2027', '2026', '2025', 'Older'],
  Shorts: ['2027', 'Older'],
  Bandhobi: ['Photographs', 'Shorts', 'Video Clips'],
};

export interface LogoDropUpNavProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleOpen?: () => void;
  activeMainTab: MainDirectoryTab;
  onSelectMainTab: (tab: MainDirectoryTab) => void;
  activeSubfolder: string;
  onSelectSubfolder: (tab: MainDirectoryTab, subfolder: string) => void;
  onSelectHome: () => void;
  telemetryData: Telemetry7DayEntry[];
  keepAwakeOn: boolean;
  onToggleKeepAwake: () => void;
  items?: StageMediaItem[];
  onSelectItem?: (item: StageMediaItem) => void;
}

function formatRetentionTime(minutes: number): string {
  if (!minutes || minutes < 1) return '< 1m';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

/**
 * Tactical Cyber Unified Tall Transparent Dock (ZERO OUTLINES)
 * - Restored Majestic Tall Height (min-h-[560px] sm:min-h-[600px])
 * - Time Spent written text right beneath website logo inside the dock (e.g. 1h 52m)
 * - Inline Dock Search Textbox (search works strictly inside the dock; press '/' to focus)
 * - Reverse 7-Day Spline Graph: Today on Left, slow 12s sparking laser
 * - Wi-Fi vs Mobile Data Detection:
 *     - If Wi-Fi: "CONNECTED TO WI-FI"
 *     - If Mobile Data: "MOBILE DATA" + warning that streaming videos/shorts consumes significant data
 * - Larger typography for tab buttons (> HOME, > PHOTOGRAPHS, etc.)
 * - Zero outlines, pure high-contrast black & white styling
 */
export const LogoDropUpNav: React.FC<LogoDropUpNavProps> = ({
  isOpen,
  onClose,
  onToggleOpen,
  activeMainTab,
  onSelectMainTab: _onSelectMainTab,
  activeSubfolder,
  onSelectSubfolder,
  onSelectHome,
  telemetryData,
  keepAwakeOn,
  onToggleKeepAwake,
  items = [],
  onSelectItem,
}) => {
  // Navigation mode: false = major tabs list, true = subfolder list
  const [viewingSubfolders, setViewingSubfolders] = useState<boolean>(false);
  const [activeFolderForSub, setActiveFolderForSub] = useState<MainDirectoryTab>(activeMainTab);

  // Inline Search inside Dock
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Network Connection Type Detection (Wi-Fi vs Mobile Data)
  const [networkType, setNetworkType] = useState<{
    isOnline: boolean;
    isCellular: boolean;
    label: string;
  }>(() => {
    if (typeof window === 'undefined') {
      return { isOnline: true, isCellular: false, label: 'CONNECTED TO WI-FI' };
    }
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const isOnline = navigator.onLine;
    const isCellular = conn?.type === 'cellular';
    return {
      isOnline,
      isCellular,
      label: !isOnline ? 'OFFLINE' : isCellular ? 'MOBILE DATA' : 'CONNECTED TO WI-FI',
    };
  });

  useEffect(() => {
    const checkNetwork = () => {
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const isOnline = navigator.onLine;
      const isCellular = conn?.type === 'cellular';
      setNetworkType({
        isOnline,
        isCellular,
        label: !isOnline ? 'OFFLINE' : isCellular ? 'MOBILE DATA' : 'CONNECTED TO WI-FI',
      });
    };

    window.addEventListener('online', checkNetwork);
    window.addEventListener('offline', checkNetwork);

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', checkNetwork);
    }

    return () => {
      window.removeEventListener('online', checkNetwork);
      window.removeEventListener('offline', checkNetwork);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', checkNetwork);
      }
    };
  }, []);

  // Proportional responsive scaling & positioning so the dock NEVER overlaps the 28px top marquee bar
  // and stays completely on-screen on rotated phones and short viewports
  const [dockLayout, setDockLayout] = useState<{ scale: number; top: number }>({
    scale: 1,
    top: 34,
  });

  useEffect(() => {
    const computeDockLayout = () => {
      const vh = window.innerHeight;
      const naturalDockHeight = 580; // restored tall dock natural height
      const marqueeHeight = 28;
      const topOffset = 34; // strictly >= 34px to completely clear the 28px top marquee bar
      const bottomOffset = 10;
      const availableH = vh - topOffset - bottomOffset;

      if (availableH < naturalDockHeight) {
        // Scaled proportionally to fit the available screen height
        const s = Math.max(0.48, availableH / naturalDockHeight);
        setDockLayout({
          scale: Number(s.toFixed(3)),
          top: topOffset, // strictly 34px from top
        });
      } else {
        // Full size, vertically centered in the space below the 28px marquee bar
        const centeredTop = Math.round(marqueeHeight + (vh - marqueeHeight - naturalDockHeight) / 2);
        setDockLayout({
          scale: 1,
          top: Math.max(topOffset, centeredTop),
        });
      }
    };

    computeDockLayout();
    window.addEventListener('resize', computeDockLayout);
    window.addEventListener('orientationchange', computeDockLayout);
    return () => {
      window.removeEventListener('resize', computeDockLayout);
      window.removeEventListener('orientationchange', computeDockLayout);
    };
  }, []);

  // Sync activeFolderForSub when activeMainTab changes
  useEffect(() => {
    setActiveFolderForSub(activeMainTab);
  }, [activeMainTab]);

  const mainFolders: MainDirectoryTab[] = ['Photographs', 'Shorts', 'Video Clips', 'Bandhobi'];

  // Today's Retention / Time Spent
  const todayEntry = telemetryData.find(
    (t) => t.label === 'Today' || t.label === 'today' || t.date === new Date().toISOString().split('T')[0]
  );
  const todayMinutes = todayEntry?.minutes || 0;
  const todayRetentionText = formatRetentionTime(todayMinutes);

  /**
   * Filter media items in real-time when user types in the inline dock search box
   */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((item) => {
        const name = (item.name || item.title || '').toLowerCase();
        const path = (item.path || '').toLowerCase();
        return name.includes(q) || path.includes(q);
      })
      .slice(0, 16);
  }, [items, searchQuery]);

  /**
   * Compute 7-day spline curve coordinates tailored for compact width w=170, h=48
   * DIRECTION: TODAY STARTS ON THE LEFT (x=8), earlier days proceed to the RIGHT (x=162)
   * 7 single-letter day labels: S, S, M, T, W, T, F dynamically matched
   */
  const waveData = useMemo(() => {
    const ptsCount = 7;
    const w = 170;
    const h = 48;

    const DAY_CHARS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const now = new Date();

    // Map 7 days starting from Today (offset 0 on left) to 6 days ago (offset 6 on right)
    const dayItems = [];
    for (let offset = 0; offset < ptsCount; offset++) {
      const d = new Date();
      d.setDate(now.getDate() - offset);
      const iso = d.toISOString().split('T')[0];
      const match = telemetryData.find(
        (t) => t.date === iso || (offset === 0 && (t.label === 'Today' || t.label === 'today'))
      );
      const mins = match ? match.minutes : 0;
      const char = DAY_CHARS[d.getDay()];
      dayItems.push({
        offset,
        char,
        minutes: mins,
        isToday: offset === 0,
      });
    }

    const rawMax = Math.max(...dayItems.map((i) => i.minutes));
    const maxMins = Math.max(rawMax, 45);

    const organicHarmonics = [0.78, 0.46, 0.68, 0.38, 0.82, 0.52, 0.32];

    const pts = dayItems.map((item, idx) => {
      const x = Math.round(8 + idx * ((w - 16) / (ptsCount - 1)));
      let norm = item.minutes > 0 ? Math.min(1, item.minutes / maxMins) : 0;
      if (rawMax <= 1) {
        norm = organicHarmonics[idx];
      } else if (norm === 0) {
        norm = 0.12;
      }
      const y = Math.round(h - 6 - norm * (h - 14));
      return { x, y, char: item.char, isToday: item.isToday, minutes: item.minutes };
    });

    let strokePath = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = Math.round((p0.x + p1.x) / 2);
      strokePath += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const first = pts[0];
    const last = pts[pts.length - 1];
    const areaPath = `${strokePath} L ${last.x} ${h} L ${first.x} ${h} Z`;

    return { pts, strokePath, areaPath, w, h };
  }, [telemetryData]);

  return (
    <aside
      aria-label="Tactical Navigation Dock"
      onClick={(e) => e.stopPropagation()}
      style={{
        top: `${dockLayout.top}px`,
        transform: isOpen
          ? `translate3d(0, 0, 0) scale(${dockLayout.scale})`
          : `translate3d(-160%, 0, 0) scale(${dockLayout.scale})`,
        transformOrigin: 'left top',
      }}
      className={`fixed left-2 sm:left-4 z-50 w-[210px] sm:w-[220px] min-h-[560px] sm:min-h-[580px] bg-[rgba(5,7,12,0.85)] backdrop-blur-xl p-2.5 shadow-[0_12px_45px_rgba(0,0,0,0.85)] rounded-none flex flex-col justify-between overflow-y-auto space-scrollbar border-0 transition-transform duration-300 ease-out select-none ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* 1-shot laser sweep beam on dock reveal */}
      {isOpen && (
        <div className="absolute left-0 right-0 bg-white shadow-[0_0_14px_#ffffff] pointer-events-none z-40 animate-hacker-beam-sweep" />
      )}

      {/* ============================================================== */}
      {/* SECTION 1: WEBSITE LOGO + RETENTION TIME SPENT TEXT            */}
      {/* ============================================================== */}
      <div>
        {/* Top Logo */}
        <div
          className="flex items-center justify-center cursor-pointer hover:brightness-125 transition-all pb-1.5 pt-0.5"
          onClick={() => {
            hapticMedium();
            if (onToggleOpen) onToggleOpen();
            else onClose();
          }}
          title="SARWAR.CYOU (Click to close dock)"
        >
          <LaserSparkLogo width={175} height={24} interactive={false} />
        </div>

        {/* Time Spent Retention Text right beneath the website logo */}
        <div className="flex items-center justify-between px-1 pb-1 mb-1 font-['Michroma',sans-serif] text-[7.5px] tracking-wider select-none">
          <span className="text-white/50 text-[7px] uppercase">TIME SPENT:</span>
          <span className="font-bold text-white tracking-widest">{todayRetentionText}</span>
        </div>

        {/* ============================================================== */}
        {/* SECTION 2: 7-DAY SPLINE GRAPH (TODAY ON LEFT + SLOW SPARK)     */}
        {/* ============================================================== */}
        <div className="bg-white/[0.04] p-1.5 relative overflow-hidden select-none rounded-none border-0 mb-2">
          <svg
            className="w-full h-[50px] overflow-visible"
            viewBox={`0 0 ${waveData.w} ${waveData.h}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="cyberWaveGradMiddleNarrow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
              </linearGradient>
              <filter id="whiteLaserGlowMiddleNarrow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.6" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Gradient Area Fill */}
            <path d={waveData.areaPath} fill="url(#cyberWaveGradMiddleNarrow)" />

            {/* Base Spline Line with Draw-In Entrance */}
            <path
              d={waveData.strokePath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              filter="url(#whiteLaserGlowMiddleNarrow)"
              className="animate-graph-line-draw"
            />

            {/* High-Voltage Traveling Laser Dash Pulse (Slow 10s animation) */}
            <path
              d={waveData.strokePath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeDasharray="14 60"
              className="animate-laser-spark-dash"
            />

            {/* Active Sparking Electric Particle Traveling Along Spline (Slow 12s animation) */}
            <g>
              <animateMotion
                path={waveData.strokePath}
                dur="12s"
                repeatCount="indefinite"
                rotate="auto"
              />
              <circle r="3.2" fill="#ffffff" filter="url(#whiteLaserGlowMiddleNarrow)" />
              <circle r="1.4" fill="#ffffff" />
              <line x1="-5" y1="0" x2="5" y2="0" stroke="#ffffff" strokeWidth="1.2" opacity="0.9" />
              <line x1="0" y1="-5" x2="0" y2="5" stroke="#ffffff" strokeWidth="1.2" opacity="0.9" />
              <line x1="-2.8" y1="-2.8" x2="2.8" y2="2.8" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
              <line x1="-2.8" y1="2.8" x2="2.8" y2="-2.8" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
            </g>

            {/* Today's Peak Beacon on Far Left (pts[0]) */}
            {waveData.pts.length > 0 && (
              <g transform={`translate(${waveData.pts[0].x}, ${waveData.pts[0].y})`}>
                <circle
                  r="4.5"
                  fill="#ffffff"
                  filter="url(#whiteLaserGlowMiddleNarrow)"
                  className="animate-ping opacity-60"
                />
                <rect
                  x="-2.5"
                  y="-2.5"
                  width="5"
                  height="5"
                  fill="#ffffff"
                  filter="url(#whiteLaserGlowMiddleNarrow)"
                />
                <rect x="-1" y="-1" width="2" height="2" fill="#000000" />
              </g>
            )}

            {/* Milestone Nodes */}
            {waveData.pts.slice(1).map((pt, idx) => (
              <rect
                key={idx}
                x={pt.x - 1.2}
                y={pt.y - 1.2}
                width="2.4"
                height="2.4"
                fill="#ffffff"
                opacity="0.75"
              />
            ))}
          </svg>

          {/* 7 Single-Letter Day Axis (S, S, M, T, W, T, F) - Today starts at Left */}
          <div className="flex justify-between font-['Michroma',sans-serif] text-[7.5px] text-white/50 pt-1 mt-0.5 px-0.5 select-none">
            {waveData.pts.map((pt, idx) => (
              <span
                key={idx}
                className={pt.isToday ? 'text-white font-black drop-shadow-[0_0_6px_#ffffff]' : 'text-white/50'}
                title={pt.isToday ? 'Today' : `${idx} days ago`}
              >
                {pt.char}
              </span>
            ))}
          </div>
        </div>

        {/* ============================================================== */}
        {/* INLINE DOCK SEARCH TEXT BOX (SEARCH OPERATES STRICTLY IN DOCK) */}
        {/* ============================================================== */}
        <div className="w-full relative mb-2">
          <div className="flex items-center bg-white/[0.06] focus-within:bg-white/[0.14] transition-colors duration-200 px-2 py-1.5 rounded-none">
            <span className="text-[10px] text-white/50 mr-1.5 select-none">⌕</span>
            <input
              id="dockSearchInput"
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH VAULT [/]"
              className="w-full bg-transparent border-0 outline-none text-white font-['Michroma',sans-serif] text-[8px] placeholder:text-white/40 tracking-wider"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-white/60 hover:text-white text-[9px] px-1 cursor-pointer"
                title="Clear Search"
              >
                ✕
              </button>
            ) : (
              <span className="text-[7px] text-white/40 px-1 font-mono bg-white/10 select-none">/</span>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 3: DOCK BODY (SEARCH RESULTS OR FOLDERS VIEW)          */}
      {/* ============================================================== */}
      <div className="relative w-full overflow-hidden flex-1 flex flex-col justify-center my-1 min-h-[220px]">
        {/* VIEW 1: INLINE SEARCH RESULTS (When user is typing in dock search) */}
        {searchQuery.trim() !== '' ? (
          <div className="w-full h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center text-[7px] font-['Michroma',sans-serif] text-white/60 pb-1 mb-1 border-b border-white/10">
              <span>{searchResults.length} FOUND</span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[6.5px] text-white/80 hover:text-white cursor-pointer"
              >
                CLEAR
              </button>
            </div>
            <div className="w-full flex-1 overflow-y-auto space-scrollbar flex flex-col gap-1 pr-0.5 max-h-[230px]">
              {searchResults.length === 0 ? (
                <div className="text-[7.5px] font-['Michroma',sans-serif] text-white/40 text-center py-8">
                  NO MATCHES
                </div>
              ) : (
                searchResults.map((item, idx) => {
                  const isPhoto = isPhotoExtension(item.path || '');
                  const isShort = item.mediaType === 'short';
                  const typeLabel = isShort ? 'SHORT' : isPhoto ? 'PHOTO' : 'VIDEO';
                  return (
                    <button
                      key={item.id || item.url || idx}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        if (onSelectItem) onSelectItem(item);
                      }}
                      className="w-full text-left p-1.5 bg-white/[0.05] hover:bg-white hover:text-black transition-colors duration-150 cursor-pointer border-0 rounded-none flex items-center gap-1.5"
                    >
                      <span className="text-[6px] font-bold font-['Michroma',sans-serif] px-1 py-0.5 bg-white/15 text-white tracking-widest shrink-0">
                        {typeLabel}
                      </span>
                      <span className="text-[7.5px] font-['Michroma',sans-serif] truncate tracking-wider text-white">
                        {item.name || item.title || 'Untitled'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <>
            {/* VIEW 2A: MAJOR FOLDERS */}
            <div
              className={`w-full flex flex-col gap-1.5 transition-all duration-300 ease-out ${
                viewingSubfolders
                  ? '-translate-x-[115%] opacity-0 pointer-events-none absolute inset-x-0'
                  : 'translate-x-0 opacity-100 pointer-events-auto relative'
              }`}
            >
              {/* > HOME Button */}
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  onSelectHome();
                }}
                className="font-['Michroma',sans-serif] text-[10px] sm:text-[10.5px] font-bold tracking-widest text-left px-2.5 py-2.5 rounded-none transition-all duration-200 cursor-pointer border-0 bg-white/[0.05] text-[#c0cad6] hover:bg-white/[0.14] hover:text-white active:bg-white active:text-black"
              >
                &gt; HOME
              </button>

              {/* 4 Main Folders */}
              {mainFolders.map((folder) => {
                const isActiveMain = activeMainTab === folder;
                return (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      setActiveFolderForSub(folder);
                      setViewingSubfolders(true);
                    }}
                    className={`font-['Michroma',sans-serif] text-[10px] sm:text-[10.5px] font-bold tracking-widest text-left px-2.5 py-2.5 rounded-none transition-all duration-200 cursor-pointer flex items-center justify-between border-0 ${
                      isActiveMain
                        ? 'bg-white text-black font-black shadow-[0_0_20px_rgba(255,255,255,0.45)]'
                        : 'bg-white/[0.05] text-[#c0cad6] hover:bg-white/[0.14] hover:text-white active:bg-white active:text-black'
                    }`}
                  >
                    <span className="truncate">&gt; {folder.toUpperCase()}</span>
                    <span className="text-[9px] opacity-75 shrink-0 ml-1">»</span>
                  </button>
                );
              })}
            </div>

            {/* VIEW 2B: SUBFOLDERS */}
            <div
              className={`w-full flex flex-col gap-1.5 transition-all duration-300 ease-out ${
                viewingSubfolders
                  ? 'translate-x-0 opacity-100 pointer-events-auto relative'
                  : 'translate-x-[115%] opacity-0 pointer-events-none absolute inset-x-0'
              }`}
            >
              <div className="font-['Michroma',sans-serif] text-[8.5px] font-bold tracking-wider text-white/80 pb-1 uppercase truncate">
                {activeFolderForSub} // SUB
              </div>

              {DIRECTORY_SUBFOLDERS[activeFolderForSub]?.map((subfolder) => {
                const isActive = activeSubfolder === subfolder && activeMainTab === activeFolderForSub;
                return (
                  <button
                    key={subfolder}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      onSelectSubfolder(activeFolderForSub, subfolder);
                    }}
                    className={`font-['Michroma',sans-serif] text-[10px] sm:text-[10.5px] font-bold tracking-widest text-left px-2.5 py-2 rounded-none transition-all duration-200 cursor-pointer truncate border-0 ${
                      isActive
                        ? 'bg-white text-black font-black shadow-[0_0_20px_rgba(255,255,255,0.45)]'
                        : 'bg-white/[0.05] text-[#c0cad6] hover:bg-white/[0.14] hover:text-white active:bg-white active:text-black'
                    }`}
                  >
                    &gt; {subfolder.toUpperCase()}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setViewingSubfolders(false);
                }}
                className="font-['Michroma',sans-serif] text-[9.5px] font-bold tracking-widest text-left px-2.5 py-2 rounded-none transition-all duration-200 cursor-pointer bg-white/10 text-white hover:bg-white hover:text-black active:bg-white active:text-black flex items-center gap-1.5 mt-1 border-0"
              >
                <span>&lt; BACK</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* SECTION 4: MOBILE DATA WARNING (IF ON CELLULAR)                */}
      {/* ============================================================== */}
      {networkType.isCellular && (
        <div className="w-full mb-1.5 p-1.5 bg-amber-500/10 text-[6.5px] font-['Michroma',sans-serif] text-amber-300 tracking-wide leading-tight select-none border-0">
          ⚠ CAUTION: Connected to mobile data. Streaming high-resolution videos or shorts may consume substantial cellular data.
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 5: DOCK FOOTER (KEEP ON + WI-FI / MOBILE DATA STATUS)  */}
      {/* ============================================================== */}
      <div className="flex items-center justify-between pt-2 border-0">
        {/* Bottom-Left: KEEP SCREEN ON */}
        <div
          className="flex items-center gap-1.5 cursor-pointer select-none"
          onClick={() => {
            hapticLight();
            onToggleKeepAwake();
          }}
          title="Keep Screen Awake"
        >
          <div
            className={`w-4 h-2.5 rounded-none relative transition-colors duration-200 border-0 ${
              keepAwakeOn ? 'bg-white' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-none absolute top-0.5 transition-transform duration-200 ${
                keepAwakeOn ? 'translate-x-2 bg-black' : 'translate-x-0.5 bg-white'
              }`}
            />
          </div>
          <span className="font-['Michroma',sans-serif] text-[7px] text-white/80 tracking-wider uppercase">
            KEEP ON
          </span>
        </div>

        {/* Bottom-Right: WI-FI or MOBILE DATA Status Indicator */}
        <div
          className="flex items-center gap-1.5 select-none"
          title={
            !networkType.isOnline
              ? 'Network Connection: Offline'
              : networkType.isCellular
              ? 'Warning: Connected to Mobile Data. Streaming media may incur high data usage.'
              : 'Network Connection: Connected to Wi-Fi'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-none ${
              !networkType.isOnline
                ? 'bg-red-500 shadow-[0_0_6px_#ef4444] animate-pulse'
                : networkType.isCellular
                ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse'
                : 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
            }`}
          />
          <span
            className={`font-['Michroma',sans-serif] text-[7px] font-bold tracking-wider uppercase ${
              !networkType.isOnline
                ? 'text-red-400 animate-pulse'
                : networkType.isCellular
                ? 'text-amber-300'
                : 'text-white/80'
            }`}
          >
            {networkType.label}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default LogoDropUpNav;
