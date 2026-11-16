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
}

function formatShortHoursMins(minutes: number): string {
  if (!minutes || minutes < 1) return '< 1M';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}H ${mins}M`;
  if (hrs > 0) return `${hrs}H`;
  return `${mins}M`;
}

/**
 * Tactical Cyber Unified Tall Transparent Dock
 * - Positioned at Middle-Left of screen (top-1/2 -translate-y-1/2)
 * - Taller, less wider proportions (w-[185px] sm:w-[195px], min-h-[520px])
 * - Website Logo at the TOP of the dock (clicking logo toggles/collapses dock)
 * - 100% Transparent Glass: underlying background video seen directly through the dock
 * - Embedded Cyber Wave Graph (7-Day Telemetry)
 * - Single Dock Sliding Navigation:
 *     - Clicking major tabs does NOT navigate page; slides in subfolders from right
 *     - ONLY clicking subfolders navigates the webpage to show media cards
 *     - Subfolder names have '< BACK' directly underneath to return to major tabs
 * - Dock Footer:
 *     - Bottom-Left: KEEP SCREEN ON toggle
 *     - Bottom-Right: Interactive 3-option theme button (Dark, White, Device Default)
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

  // Today's session metrics
  const todayEntry = telemetryData.find((d) => d.label === 'Today') || telemetryData[0];
  const todayMinutes = todayEntry?.minutes || 0;
  const todayFormatted = formatShortHoursMins(todayMinutes);

  // Compute 7-day spline curve coordinates tailored for compact width w=160, h=56
  const waveData = useMemo(() => {
    const ptsCount = 7;
    const w = 160;
    const h = 56;

    // Build array of 7 points in chronological order (oldest to today)
    const reversed = [...telemetryData].slice(0, ptsCount).reverse();
    while (reversed.length < ptsCount) {
      reversed.unshift({
        date: '',
        label: '',
        minutes: 0,
        formattedText: '',
      });
    }

    const maxMins = Math.max(...reversed.map((d) => d.minutes), 30);

    const pts = reversed.map((item, idx) => {
      const x = Math.round(8 + idx * ((w - 16) / (ptsCount - 1)));
      const norm = item.minutes > 0 ? Math.min(1, item.minutes / maxMins) : 0.08;
      const y = Math.round(h - 8 - norm * (h - 18));
      return { x, y, minutes: item.minutes, label: item.label };
    });

    // Build smooth cubic bezier curve path
    let strokePath = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = Math.round((p0.x + p1.x) / 2);
      strokePath += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const last = pts[pts.length - 1];
    const first = pts[0];
    const areaPath = `${strokePath} L ${last.x} ${h} L ${first.x} ${h} Z`;

    return { pts, strokePath, areaPath, w, h };
  }, [telemetryData]);

  // If dock is closed, do not render dock (the website logo appears at bottom-left corner)
  if (!isOpen) return null;

  return (
    <aside
      aria-label="Tactical Navigation Dock"
      onClick={(e) => e.stopPropagation()}
      className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 w-[185px] sm:w-[195px] min-h-[520px] sm:min-h-[560px] bg-[rgba(5,7,12,0.72)] border border-white/35 p-2.5 shadow-[0_0_35px_rgba(255,255,255,0.08),inset_0_0_25px_rgba(255,255,255,0.03)] rounded-none flex flex-col justify-between animate-hacker-dock-deploy overflow-hidden pointer-events-auto select-none"
    >
      {/* Corner White L-Brackets */}
      <div className="cyber-dock-corner-tl" />
      <div className="cyber-dock-corner-br" />

      {/* 1-shot laser sweep beam */}
      <div className="absolute left-0 right-0 bg-white shadow-[0_0_14px_#ffffff] pointer-events-none z-40 animate-hacker-beam-sweep" />

      {/* ============================================================== */}
      {/* SECTION 1: WEBSITE LOGO AT TOP OF DOCK + TELEMETRY HEADER      */}
      {/* ============================================================== */}
      <div>
        {/* Website Logo at the Top */}
        <div
          className="flex items-center justify-center cursor-pointer hover:brightness-125 transition-all pb-2 mb-1.5 border-b border-white/20 pt-0.5"
          onClick={() => {
            hapticMedium();
            if (onToggleOpen) onToggleOpen();
            else onClose();
          }}
          title="SARWAR.CYOU (Click to toggle dock)"
        >
          <LaserSparkLogo width={160} height={23} interactive={false} />
        </div>

        {/* Telemetry Status Line */}
        <div className="flex items-center justify-between font-['Michroma',sans-serif] text-[6.5px] text-white/70 tracking-wider pb-1.5 mb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-none bg-white shadow-[0_0_8px_#ffffff] animate-pulse" />
            <span>TELEMETRY</span>
          </div>
          <span className="text-[6.5px] font-bold text-white tracking-tight">
            TODAY: {todayFormatted}
          </span>
        </div>

        {/* ============================================================== */}
        {/* SECTION 2: EMBEDDED CYBER WAVE GRAPH (7-DAY TELEMETRY)         */}
        {/* ============================================================== */}
        <div className="border border-white/25 bg-black/45 p-1.5 relative overflow-hidden select-none mb-2">
          {/* SVG Cyber Waveform */}
          <svg
            className="w-full h-[58px] overflow-visible"
            viewBox={`0 0 ${waveData.w} ${waveData.h}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="cyberWaveGradMiddleNarrow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
              </linearGradient>
              <filter id="whiteLaserGlowMiddleNarrow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.8" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid Ticks */}
            <line
              x1="0"
              y1={waveData.h * 0.35}
              x2={waveData.w}
              y2={waveData.h * 0.35}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <line
              x1="0"
              y1={waveData.h * 0.7}
              x2={waveData.w}
              y2={waveData.h * 0.7}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />

            {/* Gradient Area Fill */}
            <path d={waveData.areaPath} fill="url(#cyberWaveGradMiddleNarrow)" />

            {/* High-Voltage Stroke Line */}
            <path
              d={waveData.strokePath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              filter="url(#whiteLaserGlowMiddleNarrow)"
            />

            {/* Milestone Nodes */}
            {waveData.pts.map((pt, idx) => {
              if (idx === waveData.pts.length - 1) {
                // Today's Glowing Peak Beacon
                return (
                  <rect
                    key={idx}
                    x={pt.x - 2.5}
                    y={pt.y - 2.5}
                    width="5"
                    height="5"
                    fill="#ffffff"
                    filter="url(#whiteLaserGlowMiddleNarrow)"
                    className="animate-pulse"
                  />
                );
              }
              if (idx === 2 || idx === 4) {
                return (
                  <rect
                    key={idx}
                    x={pt.x - 1.5}
                    y={pt.y - 1.5}
                    width="3"
                    height="3"
                    fill="#ffffff"
                  />
                );
              }
              return null;
            })}
          </svg>

          {/* Axis Labels */}
          <div className="flex justify-between font-['Michroma',sans-serif] text-[6.5px] text-white/60 pt-1 border-t border-white/10 mt-0.5">
            <span>MON</span>
            <span>WED</span>
            <span>FRI</span>
            <span className="text-white font-bold">TODAY</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 3: DYNAMIC SINGLE-DOCK SLIDING VIEW                     */}
      {/* View A (Major Folders) <---> View B (Subfolders with < BACK)   */}
      {/* ============================================================== */}
      <div className="relative w-full overflow-hidden flex-1 flex flex-col justify-center my-1 min-h-[210px]">
        {/* VIEW A: MAJOR FOLDERS (Clicking does NOT navigate page) */}
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
            className="font-['Michroma',sans-serif] text-[7.5px] font-bold tracking-widest text-left px-2 py-2 border rounded-none transition-all duration-200 cursor-pointer border-white/18 bg-white/4 text-[#a0aec0] hover:border-white hover:text-white hover:bg-white/12 active:bg-white active:text-black"
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
                  // ONLY opens subfolders view; does NOT navigate page
                  setViewingSubfolders(true);
                }}
                className={`font-['Michroma',sans-serif] text-[7.5px] font-bold tracking-widest text-left px-2 py-2 border rounded-none transition-all duration-200 cursor-pointer flex items-center justify-between ${
                  isActiveMain
                    ? 'border-white bg-white text-black font-black shadow-[0_0_18px_rgba(255,255,255,0.5)]'
                    : 'border-white/18 bg-white/4 text-[#a0aec0] hover:border-white hover:text-white hover:bg-white/12 active:border-white active:text-white'
                }`}
              >
                <span className="truncate">&gt; {folder.toUpperCase()}</span>
                <span className="text-[7px] opacity-75 shrink-0">»</span>
              </button>
            );
          })}
        </div>

        {/* VIEW B: SUBFOLDER NAMES (Clicking subfolder navigates & shows media) */}
        <div
          className={`w-full flex flex-col gap-1.5 transition-all duration-300 ease-out ${
            viewingSubfolders
              ? 'translate-x-0 opacity-100 pointer-events-auto relative'
              : 'translate-x-[115%] opacity-0 pointer-events-none absolute inset-x-0'
          }`}
        >
          {/* Subfolder Category Header */}
          <div className="font-['Michroma',sans-serif] text-[7px] tracking-wider text-white/70 pb-1 border-b border-white/15 uppercase truncate">
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
                  // ONLY here does clicking show the media cards!
                  onSelectSubfolder(activeFolderForSub, subfolder);
                }}
                className={`font-['Michroma',sans-serif] text-[7.5px] font-bold tracking-widest text-left px-2 py-1.5 border rounded-none transition-all duration-200 cursor-pointer truncate ${
                  isActive
                    ? 'border-white bg-white text-black font-black shadow-[0_0_18px_rgba(255,255,255,0.5)]'
                    : 'border-white/18 bg-white/4 text-[#a0aec0] hover:border-white hover:text-white hover:bg-white/12 active:border-white active:text-white'
                }`}
              >
                &gt; {subfolder.toUpperCase()}
              </button>
            );
          })}

          {/* < BACK Button positioned directly under the subfolder names */}
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setViewingSubfolders(false);
            }}
            className="font-['Michroma',sans-serif] text-[7px] font-bold tracking-widest text-left px-2 py-1.5 border rounded-none transition-all duration-200 cursor-pointer border-white/30 bg-white/10 text-white hover:bg-white hover:text-black active:bg-white active:text-black flex items-center gap-1.5 mt-0.5"
          >
            <span>&lt; BACK</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 4: DOCK FOOTER (BOTTOM-LEFT & BOTTOM-RIGHT CONTROLS)   */}
      {/* Bottom-Left: KEEP SCREEN ON toggle                             */}
      {/* Bottom-Right: 3-Option Theme Button (Dark / White / Default)   */}
      {/* ============================================================== */}
      <div className="flex items-center justify-between border-t border-white/15 pt-2 mt-1">
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
            className={`w-4 h-2.5 rounded-none relative border transition-colors duration-200 ${
              keepAwakeOn ? 'bg-white border-white' : 'bg-white/10 border-white/30'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-none absolute top-0.5 transition-transform duration-200 ${
                keepAwakeOn ? 'translate-x-1.5 bg-black' : 'translate-x-0.5 bg-white'
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
          className="font-['Michroma',sans-serif] text-[6.5px] font-bold tracking-wider px-1.5 py-1 border border-white/25 bg-white/8 hover:border-white hover:bg-white/20 text-white active:scale-95 transition-all cursor-pointer flex items-center gap-1"
          title={`Theme Mode: ${themeMode.toUpperCase()} (Click to cycle Dark -> White -> Device Default)`}
        >
          <span className="w-1.5 h-1.5 rounded-none bg-white shadow-[0_0_6px_#ffffff]" />
          <span>{themeMode === 'dark' ? 'DARK' : themeMode === 'white' ? 'WHITE' : 'AUTO'}</span>
        </button>
      </div>
    </aside>
  );
};

export default LogoDropUpNav;