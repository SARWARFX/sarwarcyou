import React, { useState, useEffect, useMemo } from 'react';
import { hapticLight, hapticMedium } from '../../utils/hapticsManager';
import { type Telemetry7DayEntry } from '../../utils/usageTelemetry';

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
 * - Taller, less wider proportions (w-[215px] sm:w-[225px])
 * - 100% Transparent Glass: underlying background video seen directly through the dock (zero blur)
 * - Embedded Cyber Wave Graph at top + KEEP SCREEN ON toggle
 * - Single Dock Architecture (No second dock):
 *     - Clicking major folder slides major tabs to the left
 *     - Subfolder list slides in from the right
 *     - Has a '< BACK' button directly under the subfolder names to return
 * - Default open on homepage, toggles on logo click
 * - 100% square geometry with pure white L-brackets and Michroma typography
 */
export const LogoDropUpNav: React.FC<LogoDropUpNavProps> = ({
  isOpen,
  onClose: _onClose,
  activeMainTab,
  onSelectMainTab,
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

  // Sync activeFolderForSub when activeMainTab changes
  useEffect(() => {
    setActiveFolderForSub(activeMainTab);
  }, [activeMainTab]);

  const mainFolders: MainDirectoryTab[] = ['Photographs', 'Shorts', 'Video Clips', 'Bandhobi'];

  // Today's session metrics
  const todayEntry = telemetryData.find((d) => d.label === 'Today') || telemetryData[0];
  const todayMinutes = todayEntry?.minutes || 0;
  const todayFormatted = formatShortHoursMins(todayMinutes);

  // Compute 7-day spline curve coordinates for the Cyber Wave Graph (tailored for w=190, h=72)
  const waveData = useMemo(() => {
    const ptsCount = 7;
    const w = 190;
    const h = 72;

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
      const x = Math.round(10 + idx * ((w - 20) / (ptsCount - 1)));
      // Baseline offset so 0-minute days remain visibly anchored
      const norm = item.minutes > 0 ? Math.min(1, item.minutes / maxMins) : 0.08;
      const y = Math.round(h - 10 - norm * (h - 22));
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

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Tactical Navigation Dock"
      onClick={(e) => e.stopPropagation()}
      className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-50 w-[215px] sm:w-[225px] min-h-[460px] sm:min-h-[490px] bg-[rgba(0,0,0,0.38)] border border-white/35 p-3 shadow-[0_0_35px_rgba(255,255,255,0.1),inset_0_0_25px_rgba(255,255,255,0.02)] rounded-none flex flex-col justify-between animate-hacker-dock-deploy overflow-hidden pointer-events-auto select-none"
    >
      {/* Corner White L-Brackets */}
      <div className="cyber-dock-corner-tl" />
      <div className="cyber-dock-corner-br" />

      {/* 1-shot laser sweep beam */}
      <div className="absolute left-0 right-0 bg-white shadow-[0_0_14px_#ffffff] pointer-events-none z-40 animate-hacker-beam-sweep" />

      {/* ============================================================== */}
      {/* SECTION 1: TOP STATUS BAR (RADAR + KEEP SCREEN ON TOGGLE)      */}
      {/* ============================================================== */}
      <div>
        <div className="flex items-center justify-between border-b border-white/20 pb-2 mb-2">
          <div className="flex items-center gap-1.5 font-['Michroma',sans-serif] text-[7.5px] text-white/80 tracking-wider">
            <span className="w-2 h-2 rounded-none bg-white shadow-[0_0_10px_#ffffff] animate-pulse" />
            <span>TELEMETRY</span>
          </div>
          <label
            className="inline-flex items-center gap-2 cursor-pointer select-none"
            onClick={() => {
              hapticLight();
              onToggleKeepAwake();
            }}
          >
            <div
              className={`w-6 h-3.5 rounded-none relative border transition-colors duration-200 ${
                keepAwakeOn ? 'bg-white border-white' : 'bg-white/10 border-white/30'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-none absolute top-0.5 transition-transform duration-200 ${
                  keepAwakeOn ? 'translate-x-2.5 bg-black' : 'translate-x-0.5 bg-white'
                }`}
              />
            </div>
            <span className="font-['Michroma',sans-serif] text-[7px] text-white/80 tracking-wider uppercase">
              KEEP SCREEN ON
            </span>
          </label>
        </div>

        {/* ============================================================== */}
        {/* SECTION 2: EMBEDDED CYBER WAVE GRAPH (7-DAY TELEMETRY)         */}
        {/* ============================================================== */}
        <div className="border border-white/25 bg-black/45 p-2 relative overflow-hidden select-none mb-3">
          {/* Header */}
          <div className="flex items-center justify-between font-['Michroma',sans-serif] text-[7.5px] text-white/70 mb-1 border-b border-white/10 pb-1">
            <span className="font-bold text-white tracking-wider">7-DAY TELEMETRY</span>
            <span className="font-['Michroma',sans-serif] text-[7.5px] font-bold text-white tracking-tight">
              TODAY: {todayFormatted}
            </span>
          </div>

          {/* SVG Cyber Waveform */}
          <svg
            className="w-full h-[68px] overflow-visible"
            viewBox={`0 0 ${waveData.w} ${waveData.h}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="cyberWaveGradMiddle" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
              </linearGradient>
              <filter id="whiteLaserGlowMiddle" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="glow" />
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
            <path d={waveData.areaPath} fill="url(#cyberWaveGradMiddle)" />

            {/* High-Voltage Stroke Line */}
            <path
              d={waveData.strokePath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              filter="url(#whiteLaserGlowMiddle)"
            />

            {/* Milestone Nodes */}
            {waveData.pts.map((pt, idx) => {
              if (idx === waveData.pts.length - 1) {
                // Today's Glowing Peak Beacon
                return (
                  <rect
                    key={idx}
                    x={pt.x - 3}
                    y={pt.y - 3}
                    width="6"
                    height="6"
                    fill="#ffffff"
                    filter="url(#whiteLaserGlowMiddle)"
                    className="animate-pulse"
                  />
                );
              }
              if (idx === 2 || idx === 4) {
                return (
                  <rect
                    key={idx}
                    x={pt.x - 2}
                    y={pt.y - 2}
                    width="4"
                    height="4"
                    fill="#ffffff"
                  />
                );
              }
              return null;
            })}
          </svg>

          {/* Axis Labels */}
          <div className="flex justify-between font-['Michroma',sans-serif] text-[7px] text-white/60 pt-1 border-t border-white/10 mt-0.5">
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
      <div className="relative w-full overflow-hidden flex-1 flex flex-col justify-end">
        {/* VIEW A: MAJOR FOLDERS */}
        <div
          className={`w-full flex flex-col gap-1.5 transition-all duration-300 ease-out ${
            viewingSubfolders
              ? '-translate-x-[115%] opacity-0 pointer-events-none absolute inset-x-0 bottom-0'
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
            className="font-['Michroma',sans-serif] text-[8px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer border-white/18 bg-white/4 text-[#a0aec0] hover:border-white hover:text-white hover:bg-white/12 active:bg-white active:text-black"
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
                  onSelectMainTab(folder);
                  setViewingSubfolders(true);
                }}
                className={`font-['Michroma',sans-serif] text-[8px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer flex items-center justify-between ${
                  isActiveMain
                    ? 'border-white bg-white text-black font-black shadow-[0_0_18px_rgba(255,255,255,0.5)]'
                    : 'border-white/18 bg-white/4 text-[#a0aec0] hover:border-white hover:text-white hover:bg-white/12 active:border-white active:text-white'
                }`}
              >
                <span>&gt; {folder.toUpperCase()}</span>
                <span className="text-[7.5px] opacity-75">»</span>
              </button>
            );
          })}
        </div>

        {/* VIEW B: SUBFOLDER NAMES (WITH < BACK UNDER THE LIST) */}
        <div
          className={`w-full flex flex-col gap-1.5 transition-all duration-300 ease-out ${
            viewingSubfolders
              ? 'translate-x-0 opacity-100 pointer-events-auto relative'
              : 'translate-x-[115%] opacity-0 pointer-events-none absolute inset-x-0 bottom-0'
          }`}
        >
          {/* Subfolder Category Header */}
          <div className="font-['Michroma',sans-serif] text-[7.5px] tracking-wider text-white/70 pb-1 border-b border-white/15 uppercase truncate">
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
                className={`font-['Michroma',sans-serif] text-[8px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer truncate ${
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
            className="font-['Michroma',sans-serif] text-[7.5px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer border-white/30 bg-white/10 text-white hover:bg-white hover:text-black active:bg-white active:text-black flex items-center gap-1.5 mt-0.5"
          >
            <span>&lt; BACK</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default LogoDropUpNav;