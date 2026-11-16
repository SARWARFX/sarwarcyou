import React, { useState, useEffect } from 'react';
import { hapticLight, hapticMedium } from '../../utils/hapticsManager';
import { formatFullSpentTime, type Telemetry7DayEntry } from '../../utils/usageTelemetry';

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

/**
 * Hacker Tactical Dock Drop-Up Navigation
 * - 100% Square Geometry (zero rounded corners)
 * - Corner L-brackets (Cyan top-left #00f0ff, Pink bottom-right #ff2bd6)
 * - Hacker Terminal CRT Unroll & Beam Sweep Animation on Logo Click
 * - Clean Functional Architecture: Zero unnecessary text fluff
 * - 7-Day horizontal time spent graph with text written directly on the bar
 * - Level 1 Main Dock (> HOME, > PHOTOGRAPHS, > SHORTS, > VIDEO CLIPS, > BANDHOBI)
 * - Level 2 Cascading Subfolder Dock: ONLY reveals when main folders are clicked or hovered
 * - Hacker Cyber Slide-and-Glitch animation on Subfolder Dock reveal
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
  // Track which folder is actively hovered or clicked to display in Dock 2.
  // Initially null so Dock 2 does NOT open by default.
  const [expandedFolder, setExpandedFolder] = useState<MainDirectoryTab | null>(null);

  // Reset expandedFolder whenever dock closes
  useEffect(() => {
    if (!isOpen) {
      setExpandedFolder(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter out days with 0 data (excluding zero days as requested)
  // Keep Today so user sees current session even if 0m
  const filteredDays = telemetryData.filter((d, idx) => d.minutes > 0 || idx === 0);

  const maxMinutes = Math.max(
    ...filteredDays.map((d) => d.minutes),
    30
  );

  const mainFolders: MainDirectoryTab[] = ['Photographs', 'Shorts', 'Video Clips', 'Bandhobi'];
  const subfoldersList = expandedFolder ? DIRECTORY_SUBFOLDERS[expandedFolder] || [] : [];

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-45 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dock Container Anchor */}
      <div
        className="fixed bottom-[68px] sm:bottom-[76px] left-3 sm:left-6 z-50 flex items-end gap-2 pointer-events-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================== */}
        {/* DOCK 1: PRIMARY HACKER TACTICAL DOCK                           */}
        {/* ============================================================== */}
        <aside
          aria-label="Tactical Navigation Dock"
          className="relative w-[210px] sm:w-[225px] bg-[rgba(6,10,18,0.96)] border border-[rgba(0,245,255,0.35)] backdrop-blur-xl p-3 shadow-[0_0_35px_rgba(0,245,255,0.15),inset_0_0_20px_rgba(0,245,255,0.05)] rounded-none flex flex-col gap-2.5 animate-hacker-dock-deploy overflow-hidden"
        >
          {/* Top-Left Cyan L-Bracket */}
          <div className="cyber-dock-corner-tl" />

          {/* Bottom-Right Pink L-Bracket */}
          <div className="cyber-dock-corner-br" />

          {/* 1-shot laser sweep beam across dock on deploy */}
          <div className="absolute left-0 right-0 bg-[#00f0ff] shadow-[0_0_12px_#00f0ff] pointer-events-none z-40 animate-hacker-beam-sweep" />

          {/* Top Row: Square Radar Indicator + Keep Screen On Toggle */}
          <div className="flex items-center justify-between border-b border-[rgba(0,245,255,0.2)] pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-none bg-[#00ff9d] shadow-[0_0_10px_#00ff9d] animate-pulse" />
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
                  keepAwakeOn ? 'bg-[#00f0ff] border-[#00f0ff]' : 'bg-white/10 border-white/20'
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-none absolute top-0.5 transition-transform duration-200 ${
                    keepAwakeOn ? 'translate-x-2.5 bg-black' : 'translate-x-0.5 bg-white'
                  }`}
                />
              </div>
              <span className="font-mono text-[8px] text-white/80 tracking-wider uppercase">
                KEEP SCREEN ON
              </span>
            </label>
          </div>

          {/* 7-Day Time Spent Graph (Compact Horizontal Bars with direct time labels) */}
          <div className="border-b border-white/10 pb-2 space-y-1 max-h-[140px] overflow-y-auto space-scrollbar pr-0.5">
            {filteredDays.map((d) => {
              const isToday = d.label === 'Today';
              const widthPct = d.minutes > 0 ? Math.max(20, Math.round((d.minutes / maxMinutes) * 100)) : 14;
              const displayTime = formatFullSpentTime(d.minutes);

              return (
                <div key={d.date} className="w-full h-[18px] bg-white/5 border border-white/10 rounded-none relative overflow-hidden flex items-center">
                  <div
                    className={`h-full rounded-none transition-all duration-300 ${
                      isToday
                        ? 'bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] shadow-[0_0_10px_rgba(0,245,255,0.4)]'
                        : 'bg-white/25'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                  <span
                    className={`absolute left-1.5 text-[8px] font-mono font-bold tracking-tight truncate z-10 ${
                      isToday ? 'text-black font-black' : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
                    }`}
                  >
                    {d.label}: {displayTime}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Main Directory Slots */}
          <div className="flex flex-col gap-1.5">
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
              className="font-['Orbitron',sans-serif] text-[9px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer border-white/10 bg-white/5 text-white/85 hover:border-[#00f0ff] hover:text-[#00f0ff] hover:bg-[rgba(0,245,255,0.08)]"
            >
              &gt; HOME
            </button>

            {/* 4 Main Folders: Photographs, Shorts, Video Clips, Bandhobi */}
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
                  className={`font-['Orbitron',sans-serif] text-[9px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer ${
                    isExpanded
                      ? 'border-[#00f0ff] text-[#00f0ff] bg-[rgba(0,245,255,0.14)] shadow-[0_0_14px_rgba(0,245,255,0.25)] font-black'
                      : isActiveMain
                      ? 'border-[#00f0ff]/50 text-white bg-[rgba(0,245,255,0.06)]'
                      : 'border-white/10 bg-white/2 text-[#8fa0bc] hover:border-[#00f0ff]/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  &gt; {folder.toUpperCase()}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ============================================================== */}
        {/* DOCK 2: CASCADING SUBFOLDER DOCK (Opens on hover or click)      */}
        {/* ============================================================== */}
        {expandedFolder && subfoldersList.length > 0 && (
          <aside
            key={expandedFolder}
            aria-label="Subfolder Matrix Dock"
            className="relative w-[165px] sm:w-[180px] bg-[rgba(6,10,18,0.96)] border border-[rgba(0,245,255,0.45)] backdrop-blur-xl p-2.5 shadow-[0_0_35px_rgba(0,245,255,0.2),inset_0_0_20px_rgba(0,245,255,0.06)] rounded-none flex flex-col gap-1.5 animate-hacker-subdock-slide"
          >
            {/* Top-Left Cyan L-Bracket */}
            <div className="cyber-dock-corner-tl" />

            {/* Bottom-Right Pink L-Bracket */}
            <div className="cyber-dock-corner-br" />

            {/* Subfolder Slots */}
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
                  className={`font-['Orbitron',sans-serif] text-[8.5px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer truncate ${
                    isActive
                      ? 'border-[#00f0ff] text-[#00f0ff] bg-[rgba(0,245,255,0.18)] shadow-[0_0_12px_rgba(0,245,255,0.35)] font-black'
                      : 'border-white/10 bg-white/2 text-[#8fa0bc] hover:border-[#00f0ff]/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  &gt; {subfolder.toUpperCase()}
                </button>
              );
            })}
          </aside>
        )}
      </div>
    </>
  );
};

export default LogoDropUpNav;
