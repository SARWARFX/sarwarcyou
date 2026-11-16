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
 * Tactical Cyber Tall Transparent Drop-Up Navigation
 * - 100% Transparent Glass: underlying background video seen directly through the glass
 * - Zero Webpage Blur: crystal-sharp backdrop
 * - Tall Major Folders Dock with Embedded Cyber Wave Telemetry Graph & Keep Screen On toggle
 * - Dynamic Spline Waveform rendering with glowing white stroke, gradient area fade, and Today beacon
 * - 100% square geometry with pure white L-brackets and Michroma typography
 * - High-contrast inverted white active buttons (bg-white text-black font-black)
 */
export const LogoDropUpNav: React.FC<LogoDropUpNavProps> = ({
  isOpen,
  onClose,
  activeMainTab,
  onSelectMainTab,
  activeSubfolder,
  onSelectSubfolder,
  onSelectHome,
  telemetryData,
  keepAwakeOn,
  onToggleKeepAwake,
}) => {
  // Mobile breakpoint detector (< 640px)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track which folder is actively selected/hovered to display in Dock 2.
  // Initially set to activeMainTab so the subfolder dock opens seamlessly alongside
  const [expandedFolder, setExpandedFolder] = useState<MainDirectoryTab | null>(activeMainTab);

  // Sync expanded folder when activeMainTab changes or dock opens
  useEffect(() => {
    if (isOpen) {
      setExpandedFolder(activeMainTab);
    } else {
      setExpandedFolder(null);
    }
  }, [isOpen, activeMainTab]);

  const mainFolders: MainDirectoryTab[] = ['Photographs', 'Shorts', 'Video Clips', 'Bandhobi'];
  const subfoldersList = expandedFolder ? DIRECTORY_SUBFOLDERS[expandedFolder] || [] : [];

  // Today's session metrics
  const todayEntry = telemetryData.find((d) => d.label === 'Today') || telemetryData[0];
  const todayMinutes = todayEntry?.minutes || 0;
  const todayFormatted = formatShortHoursMins(todayMinutes);

  // Compute 7-day spline curve coordinates for the Cyber Wave Graph
  const waveData = useMemo(() => {
    const ptsCount = 7;
    const w = 240;
    const h = 75;

    // Build array of 7 points in chronological order (oldest to today)
    const reversed = [...telemetryData].slice(0, ptsCount).reverse();
    // Fill to 7 items if less
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
      const x = Math.round(12 + idx * ((w - 24) / (ptsCount - 1)));
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

  // Render the Cyber Wave Graph embedded inside the tall dock
  const renderCyberWaveGraph = () => (
    <div className="border border-white/25 bg-black/45 p-2.5 relative overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between font-['Michroma',sans-serif] text-[8px] text-white/70 mb-1.5 border-b border-white/10 pb-1">
        <span className="font-bold text-white tracking-wider">7-DAY TELEMETRY</span>
        <span className="font-['Michroma',sans-serif] text-[8px] font-bold text-white tracking-tight">
          TODAY: {todayFormatted}
        </span>
      </div>

      {/* SVG Cyber Waveform */}
      <svg
        className="w-full h-[75px] overflow-visible"
        viewBox={`0 0 ${waveData.w} ${waveData.h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cyberWaveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>
          <filter id="whiteLaserGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Faint Horizontal Metric Grid Ticks */}
        <line
          x1="0"
          y1={waveData.h * 0.3}
          x2={waveData.w}
          y2={waveData.h * 0.3}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          strokeDasharray="3,3"
        />
        <line
          x1="0"
          y1={waveData.h * 0.65}
          x2={waveData.w}
          y2={waveData.h * 0.65}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          strokeDasharray="3,3"
        />

        {/* Gradient Area Under Curve */}
        <path d={waveData.areaPath} fill="url(#cyberWaveGradient)" />

        {/* High-Voltage Stroke Line */}
        <path
          d={waveData.strokePath}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          filter="url(#whiteLaserGlow)"
        />

        {/* Milestone Data Nodes */}
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
                filter="url(#whiteLaserGlow)"
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

      {/* Axis Days Labels */}
      <div className="flex justify-between font-['Michroma',sans-serif] text-[7px] text-white/60 pt-1 border-t border-white/10 mt-0.5">
        <span>MON</span>
        <span>WED</span>
        <span>FRI</span>
        <span className="text-white font-bold">TODAY</span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Backdrop overlay: STRICTLY ZERO BLUR to keep the background video crystal sharp */}
      <div
        className="fixed inset-0 z-45 bg-black/40 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. DOCK NAVIGATION SYSTEM */}
      {isMobile ? (
        /* ============================================================== */
        /* MOBILE VIEW: TALL TRANSPARENT DOCK WITH SLIDE-TO-SUBFOLDER     */
        /* ============================================================== */
        <div
          className="fixed bottom-[68px] left-3 z-50 pointer-events-auto select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Main Directory Tall Dock (Slides left when folder selected) */}
          <aside
            aria-label="Tactical Navigation Dock"
            className={`w-[260px] bg-[rgba(0,0,0,0.4)] border border-white/35 p-3 shadow-[0_0_35px_rgba(255,255,255,0.1),inset_0_0_25px_rgba(255,255,255,0.02)] rounded-none flex flex-col gap-2.5 overflow-hidden transition-all duration-300 ease-out ${
              expandedFolder !== null
                ? '-translate-x-[140%] opacity-0 pointer-events-none'
                : 'translate-x-0 opacity-100 pointer-events-auto animate-hacker-dock-deploy'
            }`}
          >
            <div className="cyber-dock-corner-tl" />
            <div className="cyber-dock-corner-br" />

            {/* Top Row: Square Radar Indicator + Keep Screen On Toggle */}
            <div className="flex items-center justify-between border-b border-white/20 pb-2">
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
                <span className="font-['Michroma',sans-serif] text-[7.5px] text-white/80 tracking-wider uppercase">
                  KEEP SCREEN ON
                </span>
              </label>
            </div>

            {/* Embedded Cyber Wave Graph */}
            {renderCyberWaveGraph()}

            {/* Major Folder Slots */}
            <div className="flex flex-col gap-1.5 pt-1">
              {/* > HOME Button */}
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  setExpandedFolder(null);
                  onSelectHome();
                  onClose();
                }}
                className="font-['Michroma',sans-serif] text-[8.5px] font-bold tracking-widest text-left px-3 py-2 border rounded-none transition-all duration-200 cursor-pointer border-white/18 bg-white/4 text-[#a0aec0] active:bg-white active:text-black active:border-white"
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
                      setExpandedFolder(folder);
                      onSelectMainTab(folder);
                    }}
                    className={`font-['Michroma',sans-serif] text-[8.5px] font-bold tracking-widest text-left px-3 py-2 border rounded-none transition-all duration-200 cursor-pointer flex items-center justify-between ${
                      isActiveMain
                        ? 'border-white bg-white text-black font-black shadow-[0_0_20px_rgba(255,255,255,0.6)]'
                        : 'border-white/18 bg-white/4 text-[#a0aec0] active:border-white active:text-white active:bg-white/12'
                    }`}
                  >
                    <span>&gt; {folder.toUpperCase()}</span>
                    <span className="text-[7.5px] opacity-75">»</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Subfolder Dock (Slides in from the right when folder is active) */}
          {expandedFolder && subfoldersList.length > 0 && (
            <aside
              key={expandedFolder}
              aria-label="Subfolder Matrix Dock"
              className="absolute bottom-0 left-0 w-[240px] bg-[rgba(0,0,0,0.42)] border border-white/40 p-3 shadow-[0_0_35px_rgba(255,255,255,0.15)] rounded-none flex flex-col gap-2 animate-mobile-subdock-enter-right"
            >
              <div className="cyber-dock-corner-tl" />
              <div className="cyber-dock-corner-br" />

              {/* < BACK Button to return smoothly to Main Dock */}
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setExpandedFolder(null);
                }}
                className="font-['Michroma',sans-serif] text-[8px] font-bold tracking-widest text-left px-2.5 py-1.5 border rounded-none transition-all duration-200 cursor-pointer border-white/30 bg-white/10 text-white active:bg-white active:text-black flex items-center gap-1.5 mb-0.5"
              >
                <span>&lt; BACK</span>
              </button>

              <div className="font-['Michroma',sans-serif] text-[7.5px] tracking-wider text-white/60 pb-1.5 border-b border-white/15 uppercase truncate">
                {expandedFolder} // SUB
              </div>

              {/* Subfolder List */}
              <div className="flex flex-col gap-1.5">
                {subfoldersList.map((subfolder) => {
                  const isActive = activeSubfolder === subfolder && activeMainTab === expandedFolder;
                  return (
                    <button
                      key={subfolder}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        onSelectSubfolder(expandedFolder, subfolder);
                        onClose();
                      }}
                      className={`font-['Michroma',sans-serif] text-[8px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer truncate ${
                        isActive
                          ? 'border-white bg-white text-black font-black shadow-[0_0_18px_rgba(255,255,255,0.5)]'
                          : 'border-white/18 bg-white/4 text-[#a0aec0] active:border-white active:text-white active:bg-white/12'
                      }`}
                    >
                      &gt; {subfolder.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      ) : (
        /* ============================================================== */
        /* DESKTOP VIEW: TALL TRANSPARENT DUAL DOCKS SIDE-BY-SIDE         */
        /* ============================================================== */
        <div
          className="fixed bottom-[68px] sm:bottom-[76px] left-3 sm:left-6 z-50 flex items-end gap-2.5 pointer-events-auto select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Main Directory Tall Transparent Dock (Dock 1) */}
          <aside
            aria-label="Tactical Navigation Dock"
            className="relative w-[265px] bg-[rgba(0,0,0,0.38)] border border-white/35 p-3.5 shadow-[0_0_35px_rgba(255,255,255,0.1),inset_0_0_25px_rgba(255,255,255,0.02)] rounded-none flex flex-col gap-2.5 animate-hacker-dock-deploy overflow-hidden"
          >
            <div className="cyber-dock-corner-tl" />
            <div className="cyber-dock-corner-br" />
            <div className="absolute left-0 right-0 bg-white shadow-[0_0_14px_#ffffff] pointer-events-none z-40 animate-hacker-beam-sweep" />

            {/* Top Row: Square Radar Indicator + Keep Screen On Toggle */}
            <div className="flex items-center justify-between border-b border-white/20 pb-2">
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
                <span className="font-['Michroma',sans-serif] text-[7.5px] text-white/80 tracking-wider uppercase">
                  KEEP SCREEN ON
                </span>
              </label>
            </div>

            {/* Embedded Cyber Wave Graph */}
            {renderCyberWaveGraph()}

            {/* Navigation Buttons */}
            <div className="flex flex-col gap-1.5 pt-1">
              {/* > HOME Button */}
              <button
                type="button"
                onMouseEnter={() => setExpandedFolder(null)}
                onClick={() => {
                  hapticMedium();
                  setExpandedFolder(null);
                  onSelectHome();
                  onClose();
                }}
                className="font-['Michroma',sans-serif] text-[8.5px] font-bold tracking-widest text-left px-3 py-2.5 border rounded-none transition-all duration-200 cursor-pointer border-white/18 bg-white/4 text-[#a0aec0] hover:border-white hover:text-white hover:bg-white/12"
              >
                &gt; HOME
              </button>

              {/* 4 Main Folders */}
              {mainFolders.map((folder) => {
                const isExpanded = expandedFolder === folder;
                const isActiveMain = activeMainTab === folder;
                return (
                  <button
                    key={folder}
                    type="button"
                    onMouseEnter={() => setExpandedFolder(folder)}
                    onClick={() => {
                      hapticMedium();
                      setExpandedFolder(folder);
                      onSelectMainTab(folder);
                    }}
                    className={`font-['Michroma',sans-serif] text-[8.5px] font-bold tracking-widest text-left px-3 py-2.5 border rounded-none transition-all duration-200 cursor-pointer flex items-center justify-between ${
                      isActiveMain
                        ? 'border-white bg-white text-black font-black shadow-[0_0_20px_rgba(255,255,255,0.6)]'
                        : isExpanded
                        ? 'border-white/80 bg-white/15 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                        : 'border-white/18 bg-white/4 text-[#a0aec0] hover:border-white hover:text-white hover:bg-white/12'
                    }`}
                  >
                    <span>&gt; {folder.toUpperCase()}</span>
                    <span className="text-[7.5px] opacity-75">»</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Subfolder Dock (Dock 2: Opens alongside to the right) */}
          {expandedFolder && subfoldersList.length > 0 && (
            <aside
              key={expandedFolder}
              aria-label="Subfolder Matrix Dock"
              className="relative w-[175px] sm:w-[190px] bg-[rgba(0,0,0,0.42)] border border-white/40 p-3 shadow-[0_0_35px_rgba(255,255,255,0.15),inset_0_0_25px_rgba(255,255,255,0.02)] rounded-none flex flex-col gap-2 animate-hacker-subdock-slide"
            >
              <div className="cyber-dock-corner-tl" />
              <div className="cyber-dock-corner-br" />

              {/* Section Header */}
              <div className="font-['Michroma',sans-serif] text-[7.5px] tracking-wider text-white/60 pb-1.5 border-b border-white/15 uppercase truncate">
                {expandedFolder} // SUB
              </div>

              {/* Subfolder Slots */}
              <div className="flex flex-col gap-1.5">
                {subfoldersList.map((subfolder) => {
                  const isActive = activeSubfolder === subfolder && activeMainTab === expandedFolder;
                  return (
                    <button
                      key={subfolder}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        onSelectSubfolder(expandedFolder, subfolder);
                        onClose();
                      }}
                      className={`font-['Michroma',sans-serif] text-[8px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer truncate ${
                        isActive
                          ? 'border-white bg-white text-black font-black shadow-[0_0_20px_rgba(255,255,255,0.6)]'
                          : 'border-white/18 bg-white/4 text-[#a0aec0] hover:border-white hover:text-white hover:bg-white/12'
                      }`}
                    >
                      &gt; {subfolder.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      )}
    </>
  );
};

export default LogoDropUpNav;