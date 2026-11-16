import React, { useState, useEffect, useMemo } from 'react';
import { hapticLight, hapticMedium } from '../../utils/hapticsManager';
import { type Telemetry7DayEntry } from '../../utils/usageTelemetry';
import { LaserSparkLogo } from '../brand/LaserSparkLogo';
import {
  getStoredThemeMode,
  saveThemeMode,
  getNextThemeMode,
  type ThemeMode,
  applyThemeMode,
} from '../../utils/themeModeManager';

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
  onShuffle?: () => void;
}

/**
 * Tactical Cyber Unified Tall Transparent Dock (ZERO OUTLINES)
 * - Outline-free Pure Black & White Michroma design
 * - Middle-Left screen alignment (top-1/2 -translate-y-1/2)
 * - Taller, less wider proportions (w-[185px] sm:w-[195px], min-h-[520px])
 * - Website Logo at the TOP of the dock (toggles dock on click)
 * - Reverse 7-Day Spline Graph:
 *     - TODAY starts on the LEFT, earlier days proceed to the RIGHT
 *     - Single-letter day indicators (S, S, M, T, W, T, F)
 *     - Continuous sparking laser animation traveling along the top spline curve
 *     - No "TELEMETRY" header and no "TODAY TIME SPENT" text
 * - Filled Empty Spaces:
 *     - Below Graph: Quick Search trigger pill + Audio HUD status
 *     - Below Folders: Surprise Shuffle button + Session pacing meter
 * - Single Dock Sliding Navigation (major folders slide to subfolders with < BACK)
 * - Dock Footer: Keep screen on toggle + 3-option theme button
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
  onShuffle,
}) => {
  // Navigation mode: false = major tabs list, true = subfolder list
  const [viewingSubfolders, setViewingSubfolders] = useState<boolean>(false);
  const [activeFolderForSub, setActiveFolderForSub] = useState<MainDirectoryTab>(activeMainTab);

  // Theme mode: 'dark' | 'white' | 'default'
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());

  // Apply initial theme on mount & listen to system changes
  useEffect(() => {
    applyThemeMode(themeMode);
    if (themeMode === 'default' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyThemeMode('default');
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [themeMode]);

  const handleCycleTheme = () => {
    const next = getNextThemeMode(themeMode);
    setThemeMode(next);
    saveThemeMode(next);
  };

  // Sync activeFolderForSub when activeMainTab changes
  useEffect(() => {
    setActiveFolderForSub(activeMainTab);
  }, [activeMainTab]);

  const mainFolders: MainDirectoryTab[] = ['Photographs', 'Shorts', 'Video Clips', 'Bandhobi'];

  /**
   * Compute 7-day spline curve coordinates tailored for compact width w=160, h=48
   * DIRECTION: TODAY STARTS ON THE LEFT (x=8), earlier days proceed to the RIGHT (x=152)
   * 7 single-letter day labels: S, S, M, T, W, T, F dynamically matched
   */
  const waveData = useMemo(() => {
    const ptsCount = 7;
    const w = 160;
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

  // If dock is closed, do not render dock (the website logo appears at bottom-left corner)
  if (!isOpen) return null;

  return (
    <aside
      aria-label="Tactical Navigation Dock"
      onClick={(e) => e.stopPropagation()}
      className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 w-[185px] sm:w-[195px] min-h-[530px] sm:min-h-[570px] bg-[rgba(5,7,12,0.82)] backdrop-blur-xl p-2.5 shadow-[0_12px_45px_rgba(0,0,0,0.85)] rounded-none flex flex-col justify-between animate-hacker-dock-deploy overflow-hidden pointer-events-auto select-none border-0"
    >
      {/* 1-shot laser sweep beam on dock reveal */}
      <div className="absolute left-0 right-0 bg-white shadow-[0_0_14px_#ffffff] pointer-events-none z-40 animate-hacker-beam-sweep" />

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
          title="SARWAR.CYOU (Click to toggle dock)"
        >
          <LaserSparkLogo width={160} height={23} interactive={false} />
        </div>

        {/* ============================================================== */}
        {/* SECTION 2: 7-DAY SPLINE GRAPH (TODAY ON LEFT + SPARKING LASER) */}
        {/* ============================================================== */}
        <div className="bg-white/[0.04] p-1.5 relative overflow-hidden select-none rounded-none border-0 mb-1.5">
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

            {/* High-Voltage Traveling Laser Dash Pulse */}
            <path
              d={waveData.strokePath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeDasharray="14 60"
              className="animate-laser-spark-dash"
            />

            {/* Active Sparking Electric Particle Traveling Along Spline */}
            <g>
              <animateMotion
                path={waveData.strokePath}
                dur="2.8s"
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
          <div className="flex justify-between font-['Michroma',sans-serif] text-[7px] text-white/50 pt-1 mt-0.5 px-0.5 select-none">
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
        {/* NEW FEATURE 1 (SPACE BELOW GRAPH): QUICK SEARCH + AUDIO HUD    */}
        {/* ============================================================== */}
        <div className="w-full flex flex-col gap-1 mb-1">
          {/* Quick Search Button (Opens Fast-Find Palette) */}
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              if (onOpenSearch) onOpenSearch();
            }}
            className="w-full flex items-center justify-between font-['Michroma',sans-serif] text-[7px] font-bold tracking-widest px-2 py-1.5 bg-white/[0.06] hover:bg-white hover:text-black text-white/80 transition-all duration-200 cursor-pointer rounded-none border-0"
            title="Quick Search (Press / to search)"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-[9px]">⌕</span>
              <span>QUICK SEARCH</span>
            </span>
            <span className="text-[6.5px] px-1 py-0.2 bg-white/15 text-white/90 font-mono">/</span>
          </button>

          {/* Mini Live Audio Status Indicator */}
          <div className="flex items-center justify-between px-1.5 py-0.5 text-[6.5px] font-['Michroma',sans-serif] text-white/50 tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-none bg-white shadow-[0_0_6px_#ffffff] animate-pulse" />
              <span>AUDIO: LIVE</span>
            </span>
            <div className="flex items-end gap-0.5 h-2">
              <span className="w-0.5 h-1 bg-white animate-pulse" />
              <span className="w-0.5 h-2 bg-white animate-pulse delay-75" />
              <span className="w-0.5 h-1.5 bg-white animate-pulse delay-150" />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 3: DYNAMIC SINGLE-DOCK SLIDING VIEW (ZERO OUTLINES)    */}
      {/* View A (Major Folders) <---> View B (Subfolders with < BACK)   */}
      {/* ============================================================== */}
      <div className="relative w-full overflow-hidden flex-1 flex flex-col justify-center my-0.5 min-h-[195px]">
        {/* VIEW A: MAJOR FOLDERS (Clicking opens subfolders; no page change) */}
        <div
          className={`w-full flex flex-col gap-1 transition-all duration-300 ease-out ${
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
            className="font-['Michroma',sans-serif] text-[7.5px] font-bold tracking-widest text-left px-2 py-1.5 rounded-none transition-all duration-200 cursor-pointer border-0 bg-white/[0.05] text-[#b0b8c4] hover:bg-white/[0.14] hover:text-white active:bg-white active:text-black"
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
                className={`font-['Michroma',sans-serif] text-[7.5px] font-bold tracking-widest text-left px-2 py-1.5 rounded-none transition-all duration-200 cursor-pointer flex items-center justify-between border-0 ${
                  isActiveMain
                    ? 'bg-white text-black font-black shadow-[0_0_20px_rgba(255,255,255,0.45)]'
                    : 'bg-white/[0.05] text-[#b0b8c4] hover:bg-white/[0.14] hover:text-white active:bg-white active:text-black'
                }`}
              >
                <span className="truncate">&gt; {folder.toUpperCase()}</span>
                <span className="text-[7px] opacity-75 shrink-0">»</span>
              </button>
            );
          })}
        </div>

        {/* VIEW B: SUBFOLDERS (Clicking subfolder shows media cards) */}
        <div
          className={`w-full flex flex-col gap-1 transition-all duration-300 ease-out ${
            viewingSubfolders
              ? 'translate-x-0 opacity-100 pointer-events-auto relative'
              : 'translate-x-[115%] opacity-0 pointer-events-none absolute inset-x-0'
          }`}
        >
          {/* Subfolder Category Header */}
          <div className="font-['Michroma',sans-serif] text-[7px] font-bold tracking-wider text-white/80 pb-0.5 uppercase truncate">
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
                className={`font-['Michroma',sans-serif] text-[7.5px] font-bold tracking-widest text-left px-2 py-1.5 rounded-none transition-all duration-200 cursor-pointer truncate border-0 ${
                  isActive
                    ? 'bg-white text-black font-black shadow-[0_0_20px_rgba(255,255,255,0.45)]'
                    : 'bg-white/[0.05] text-[#b0b8c4] hover:bg-white/[0.14] hover:text-white active:bg-white active:text-black'
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
            className="font-['Michroma',sans-serif] text-[7px] font-bold tracking-widest text-left px-2 py-1.5 rounded-none transition-all duration-200 cursor-pointer bg-white/10 text-white hover:bg-white hover:text-black active:bg-white active:text-black flex items-center gap-1.5 mt-0.5 border-0"
          >
            <span>&lt; BACK</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 4: FILLED SPACE BELOW FOLDERS & DOCK FOOTER            */}
      {/* ============================================================== */}
      <div>
        {/* NEW FEATURE 2 (SPACE BELOW FOLDERS): RANDOM SHUFFLE BUTTON */}
        <button
          type="button"
          onClick={() => {
            hapticMedium();
            if (onShuffle) onShuffle();
          }}
          className="w-full flex items-center justify-center gap-1.5 font-['Michroma',sans-serif] text-[7px] font-bold tracking-widest px-2 py-1.5 bg-white/[0.06] hover:bg-white hover:text-black text-white/80 transition-all duration-200 cursor-pointer rounded-none border-0 mb-1.5"
          title="Shuffle Vault - Launch Random Media"
        >
          <span className="text-[8px]">⚡</span>
          <span>SHUFFLE VAULT</span>
        </button>

        {/* Session Pacing HUD Bar */}
        <div className="w-full px-1 py-0.5 mb-1.5" title="Vault Telemetry Pacing">
          <div className="flex justify-between items-center text-[6px] font-['Michroma',sans-serif] text-white/40 tracking-wider mb-0.5">
            <span>SESSION HUD</span>
            <span>60 FPS</span>
          </div>
          <div className="w-full h-[2px] bg-white/10 overflow-hidden">
            <div className="h-full bg-white animate-cyber-scan" style={{ width: '45%' }} />
          </div>
        </div>

        {/* SECTION 5: DOCK FOOTER (ZERO OUTLINES) */}
        <div className="flex items-center justify-between pt-1">
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
            <span className="font-['Michroma',sans-serif] text-[6.5px] text-white/80 tracking-wider uppercase">
              KEEP ON
            </span>
          </div>

          {/* Bottom-Right: Interactive 3-Option Theme Button (Dark / White / Default) */}
          <button
            type="button"
            onClick={() => {
              hapticLight();
              handleCycleTheme();
            }}
            className="font-['Michroma',sans-serif] text-[6.5px] font-bold tracking-wider px-2 py-1 border-0 bg-white/10 hover:bg-white hover:text-black text-white active:scale-95 transition-all cursor-pointer flex items-center gap-1"
            title={`Theme Mode: ${themeMode.toUpperCase()} (Click to cycle Dark -> White -> Device Default)`}
          >
            <span className="w-1.5 h-1.5 rounded-none bg-white shadow-[0_0_6px_#ffffff]" />
            <span>{themeMode === 'dark' ? 'DARK' : themeMode === 'white' ? 'WHITE' : 'AUTO'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default LogoDropUpNav;
