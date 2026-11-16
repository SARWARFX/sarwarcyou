import React, { useState, useEffect, useMemo } from 'react';
import { hapticLight, hapticMedium } from '../../utils/hapticsManager';
import { type Telemetry7DayEntry } from '../../utils/usageTelemetry';
import { LaserSparkLogo } from '../brand/LaserSparkLogo';
import {
  getGlobalAudioMuted,
  toggleGlobalAudioMuted,
  subscribeGlobalAudioMuted,
} from '../../utils/audioMuteManager';

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
  onOpenSearch?: () => void;
}

/**
 * Tactical Cyber Unified Tall Transparent Dock (ZERO OUTLINES)
 * - Animated Left-Right sliding appearance synchronized with bottom-left logo
 * - Middle-Left screen alignment (top-1/2 -translate-y-1/2)
 * - Taller, less wider proportions (w-[205px] sm:w-[215px], min-h-[500px])
 * - Website Logo at TOP (toggles/closes dock on click)
 * - Reverse 7-Day Spline Graph:
 *     - TODAY starts on the LEFT, earlier days proceed to the RIGHT
 *     - Single-letter day indicators (S, S, M, T, W, T, F)
 *     - Graceful, slow-moving sparking laser animation (12s cycle)
 * - Quick Search trigger button ([ ⌕ QUICK SEARCH  / ])
 * - Interactive Audio Live / Muted button (controls site-wide default mute)
 * - High-legibility larger typography for tab buttons (> HOME, > PHOTOGRAPHS, etc.)
 * - Subfolder drilldown with < BACK
 * - Footer: KEEP ON (screen awake) + ONLINE / OFFLINE network status
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
  onOpenSearch,
}) => {
  // Navigation mode: false = major tabs list, true = subfolder list
  const [viewingSubfolders, setViewingSubfolders] = useState<boolean>(false);
  const [activeFolderForSub, setActiveFolderForSub] = useState<MainDirectoryTab>(activeMainTab);

  // Audio mute state synced with global audio manager
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => getGlobalAudioMuted());

  useEffect(() => {
    return subscribeGlobalAudioMuted((muted) => setIsAudioMuted(muted));
  }, []);

  const handleToggleAudio = () => {
    hapticLight();
    toggleGlobalAudioMuted();
  };

  // Device online / offline status indicator
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Proportional responsive scaling to fit short landscape/rotated mobile screens
  const [dockScale, setDockScale] = useState<number>(1);

  useEffect(() => {
    const computeDockScale = () => {
      const vh = window.innerHeight;
      const topBarOffset = 34; // 28px marquee bar + 6px breathing room
      const availableH = vh - topBarOffset;
      const naturalDockHeight = 525;
      if (availableH < naturalDockHeight) {
        // Proportionally scale down while maintaining exact aspect ratio
        const s = Math.max(0.55, availableH / naturalDockHeight);
        setDockScale(Number(s.toFixed(3)));
      } else {
        setDockScale(1);
      }
    };

    computeDockScale();
    window.addEventListener('resize', computeDockScale);
    window.addEventListener('orientationchange', computeDockScale);
    return () => {
      window.removeEventListener('resize', computeDockScale);
      window.removeEventListener('orientationchange', computeDockScale);
    };
  }, []);

  // Sync activeFolderForSub when activeMainTab changes
  useEffect(() => {
    setActiveFolderForSub(activeMainTab);
  }, [activeMainTab]);

  const mainFolders: MainDirectoryTab[] = ['Photographs', 'Shorts', 'Video Clips', 'Bandhobi'];

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
    const items = [];
    for (let offset = 0; offset < ptsCount; offset++) {
      const d = new Date();
      d.setDate(now.getDate() - offset);
      const iso = d.toISOString().split('T')[0];
      const match = telemetryData.find(
        (t) => t.date === iso || (offset === 0 && (t.label === 'Today' || t.label === 'today'))
      );
      const mins = match ? match.minutes : 0;
      const char = DAY_CHARS[d.getDay()];
      items.push({
        offset,
        char,
        minutes: mins,
        isToday: offset === 0,
      });
    }

    const rawMax = Math.max(...items.map((i) => i.minutes));
    const maxMins = Math.max(rawMax, 45);

    // Harmonic telemetry contour so graph is always alive and aesthetic
    const organicHarmonics = [0.78, 0.46, 0.68, 0.38, 0.82, 0.52, 0.32];

    const pts = items.map((item, idx) => {
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

    // Build smooth cubic bezier curve path starting from Today on left:
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
        top: 'calc(50% + 14px)',
        transform: isOpen
          ? `translate3d(0, -50%, 0) scale(${dockScale})`
          : `translate3d(-150%, -50%, 0) scale(${dockScale})`,
        transformOrigin: 'left center',
        maxHeight: 'calc(100dvh - 34px)',
      }}
      className={`fixed left-2 sm:left-4 z-50 w-[205px] sm:w-[215px] bg-[rgba(5,7,12,0.85)] backdrop-blur-xl p-2.5 shadow-[0_12px_45px_rgba(0,0,0,0.85)] rounded-none flex flex-col justify-between overflow-y-auto space-scrollbar border-0 transition-all duration-300 ease-out select-none ${
        isOpen
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* 1-shot laser sweep beam on dock reveal */}
      {isOpen && (
        <div className="absolute left-0 right-0 bg-white shadow-[0_0_14px_#ffffff] pointer-events-none z-40 animate-hacker-beam-sweep" />
      )}

      {/* ============================================================== */}
      {/* SECTION 1: WEBSITE LOGO AT TOP OF DOCK (ZERO BORDERS)          */}
      {/* ============================================================== */}
      <div>
        <div
          className="flex items-center justify-center cursor-pointer hover:brightness-125 transition-all pb-2 pt-0.5"
          onClick={() => {
            hapticMedium();
            if (onToggleOpen) onToggleOpen();
            else onClose();
          }}
          title="SARWAR.CYOU (Click to close dock)"
        >
          <LaserSparkLogo width={170} height={24} interactive={false} />
        </div>

        {/* ============================================================== */}
        {/* SECTION 2: 7-DAY SPLINE GRAPH (TODAY ON LEFT + SLOW SPARK)     */}
        {/* ============================================================== */}
        <div className="bg-white/[0.04] p-1.5 relative overflow-hidden select-none rounded-none border-0 mb-2">
          <svg
            className="w-full h-[52px] overflow-visible"
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
              {/* Electric 4-Point Star Spark Rays */}
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

            {/* Subtle Milestone Nodes for Past Days */}
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
        {/* QUICK SEARCH BUTTON + INTERACTIVE AUDIO MUTE CONTROLLER        */}
        {/* ============================================================== */}
        <div className="w-full flex flex-col gap-1.5 mb-2">
          {/* Quick Search Button (Opens Fast-Find Palette) */}
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              if (onOpenSearch) onOpenSearch();
            }}
            className="w-full flex items-center justify-between font-['Michroma',sans-serif] text-[8.5px] font-bold tracking-wider px-2 py-2 bg-white/[0.06] hover:bg-white hover:text-black text-white/80 transition-all duration-200 cursor-pointer rounded-none border-0"
            title="Quick Search (Press / to search)"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-[10px]">⌕</span>
              <span>QUICK SEARCH</span>
            </span>
            <span className="text-[7.5px] px-1 py-0.2 bg-white/15 text-white/90 font-mono">/</span>
          </button>

          {/* Interactive Audio Mute / Live Button */}
          <button
            type="button"
            onClick={handleToggleAudio}
            className="w-full flex items-center justify-between px-2 py-1.5 text-[8px] font-['Michroma',sans-serif] tracking-wider rounded-none border-0 transition-all cursor-pointer bg-white/[0.05] hover:bg-white hover:text-black text-white/80"
            title={isAudioMuted ? 'Website Audio Muted (Click to Unmute)' : 'Website Audio Live (Click to Mute)'}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-none ${
                  isAudioMuted
                    ? 'bg-red-400 shadow-[0_0_6px_#f87171]'
                    : 'bg-white shadow-[0_0_6px_#ffffff] animate-pulse'
                }`}
              />
              <span className="font-bold">{isAudioMuted ? 'AUDIO: MUTED' : 'AUDIO: LIVE'}</span>
            </span>
            <div className="flex items-end gap-0.5 h-2.5">
              {isAudioMuted ? (
                <span className="text-[9px] leading-none opacity-60">✕</span>
              ) : (
                <>
                  <span className="w-0.5 h-1.5 bg-current animate-pulse" />
                  <span className="w-0.5 h-2.5 bg-current animate-pulse delay-75" />
                  <span className="w-0.5 h-2 bg-current animate-pulse delay-150" />
                </>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 3: DYNAMIC SINGLE-DOCK SLIDING VIEW (LARGER TEXT)      */}
      {/* View A (Major Folders) <---> View B (Subfolders with < BACK)   */}
      {/* ============================================================== */}
      <div className="relative w-full overflow-hidden flex-1 flex flex-col justify-center my-1 min-h-[200px]">
        {/* VIEW A: MAJOR FOLDERS (Clicking opens subfolders; no page change) */}
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

        {/* VIEW B: SUBFOLDERS (Clicking subfolder shows media cards) */}
        <div
          className={`w-full flex flex-col gap-1.5 transition-all duration-300 ease-out ${
            viewingSubfolders
              ? 'translate-x-0 opacity-100 pointer-events-auto relative'
              : 'translate-x-[115%] opacity-0 pointer-events-none absolute inset-x-0'
          }`}
        >
          {/* Subfolder Category Header */}
          <div className="font-['Michroma',sans-serif] text-[8.5px] font-bold tracking-wider text-white/80 pb-1 uppercase truncate">
            {activeFolderForSub} // SUB
          </div>

          {/* Subfolder List */}
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

          {/* < BACK Button directly underneath subfolder names */}
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
      </div>

      {/* ============================================================== */}
      {/* SECTION 4: DOCK FOOTER (KEEP ON + ONLINE/OFFLINE STATUS)       */}
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

        {/* Bottom-Right: ONLINE / OFFLINE Status Indicator */}
        <div
          className="flex items-center gap-1.5 select-none"
          title={isOnline ? 'Network Connection: Online' : 'Network Connection: Offline'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-none ${
              isOnline
                ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                : 'bg-red-500 shadow-[0_0_6px_#ef4444] animate-pulse'
            }`}
          />
          <span
            className={`font-['Michroma',sans-serif] text-[7px] font-bold tracking-wider uppercase ${
              isOnline ? 'text-white/80' : 'text-red-400 animate-pulse'
            }`}
          >
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default LogoDropUpNav;
