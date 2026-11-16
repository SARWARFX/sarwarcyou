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
 * Tactical Cyber Drop-Up Navigation
 * - Zero Webpage Blur: crystal-sharp backdrop
 * - Graph + Keep Screen On module:
 *     - Desktop: bottom-right corner of the website
 *     - Mobile: top of the screen right under the 28px EULO marquee bar
 * - Main Navigation Dock:
 *     - Desktop: side-by-side cascading subfolder dock
 *     - Mobile: smooth animated slide transition (main dock slides left offscreen,
 *       subfolder dock slides in from the right with < BACK button)
 * - 100% square geometry with cyber L-brackets (Cyan #00f0ff & Pink #ff2bd6)
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
  // Initially null so Dock 2 does NOT open by default.
  const [expandedFolder, setExpandedFolder] = useState<MainDirectoryTab | null>(null);

  // Reset state whenever dock closes
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

  // Reusable Telemetry & Power Control Component (Graph + Keep Screen On)
  const renderTelemetryPanel = (extraClass: string = '') => (
    <aside
      aria-label="Activity Telemetry & Power Control"
      className={`relative bg-[rgba(6,10,18,0.96)] border border-[rgba(0,245,255,0.35)] p-2.5 sm:p-3 shadow-[0_0_35px_rgba(0,245,255,0.15),inset_0_0_20px_rgba(0,245,255,0.05)] rounded-none flex flex-col gap-2 overflow-hidden ${extraClass}`}
    >
      {/* Top-Left Cyan L-Bracket */}
      <div className="cyber-dock-corner-tl" />

      {/* Bottom-Right Pink L-Bracket */}
      <div className="cyber-dock-corner-br" />

      {/* 1-shot laser sweep beam */}
      <div className="absolute left-0 right-0 bg-[#00f0ff] shadow-[0_0_12px_#00f0ff] pointer-events-none z-40 animate-hacker-beam-sweep" />

      {/* Top Row: Square Radar Indicator + Keep Screen On Toggle */}
      <div className="flex items-center justify-between border-b border-[rgba(0,245,255,0.2)] pb-1.5">
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

      {/* 7-Day Time Spent Graph (Compact Horizontal Bars) */}
      <div className="space-y-1 max-h-[130px] sm:max-h-[140px] overflow-y-auto space-scrollbar pr-0.5">
        {filteredDays.map((d) => {
          const isToday = d.label === 'Today';
          const widthPct = d.minutes > 0 ? Math.max(20, Math.round((d.minutes / maxMinutes) * 100)) : 14;
          const displayTime = formatFullSpentTime(d.minutes);

          return (
            <div
              key={d.date}
              className="w-full h-[18px] bg-white/5 border border-white/10 rounded-none relative overflow-hidden flex items-center"
            >
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
    </aside>
  );

  return (
    <>
      {/* 1. Backdrop overlay: STRICTLY ZERO BLUR to keep the background webpage crystal sharp */}
      <div
        className="fixed inset-0 z-45 bg-black/40 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. ACTIVITY GRAPH & KEEP SCREEN ON PANEL */}
      {/* MOBILE: At the top of the page, right under the 28px EULO marquee bar */}
      {isMobile ? (
        <div
          className="fixed top-[28px] left-2 right-2 max-w-[420px] mx-auto z-50 animate-hacker-mobile-top-deploy pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {renderTelemetryPanel('w-full')}
        </div>
      ) : (
        /* DESKTOP: Bottom-right corner of the website */
        <div
          className="fixed bottom-[68px] sm:bottom-[76px] right-3 sm:right-6 z-50 animate-hacker-dock-deploy pointer-events-auto select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {renderTelemetryPanel('w-[220px] sm:w-[245px]')}
        </div>
      )}

      {/* 3. DOCK NAVIGATION SYSTEM */}
      {isMobile ? (
        /* ============================================================== */
        /* MOBILE VIEW: SINGLE DOCK WITH SMOOTH HORIZONTAL SLIDE TRANSITION */
        /* ============================================================== */
        <div
          className="fixed bottom-[68px] left-3 z-50 pointer-events-auto select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Main Directory Dock (Slides left out of screen when folder is active) */}
          <aside
            aria-label="Tactical Navigation Dock"
            className={`w-[205px] bg-[rgba(6,10,18,0.96)] border border-[rgba(0,245,255,0.35)] p-2.5 shadow-[0_0_35px_rgba(0,245,255,0.15)] rounded-none flex flex-col gap-1.5 overflow-hidden transition-all duration-300 ease-out ${
              expandedFolder !== null
                ? '-translate-x-[140%] opacity-0 pointer-events-none'
                : 'translate-x-0 opacity-100 pointer-events-auto animate-hacker-dock-deploy'
            }`}
          >
            <div className="cyber-dock-corner-tl" />
            <div className="cyber-dock-corner-br" />

            {/* > HOME Button */}
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                setExpandedFolder(null);
                onSelectHome();
                onClose();
              }}
              className="font-['Orbitron',sans-serif] text-[9px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer border-white/10 bg-white/5 text-white/85 active:border-[#00f0ff] active:text-[#00f0ff]"
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
                  className={`font-['Orbitron',sans-serif] text-[9px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer ${
                    isActiveMain
                      ? 'border-[#00f0ff]/60 text-white bg-[rgba(0,245,255,0.08)]'
                      : 'border-white/10 bg-white/2 text-[#8fa0bc] active:border-[#00f0ff]/60 active:text-white'
                  }`}
                >
                  &gt; {folder.toUpperCase()}
                </button>
              );
            })}
          </aside>

          {/* Subfolder Dock (Slides in from the right when folder is active) */}
          {expandedFolder && subfoldersList.length > 0 && (
            <aside
              key={expandedFolder}
              aria-label="Subfolder Matrix Dock"
              className="absolute bottom-0 left-0 w-[205px] bg-[rgba(6,10,18,0.96)] border border-[rgba(0,245,255,0.45)] p-2.5 shadow-[0_0_35px_rgba(0,245,255,0.2)] rounded-none flex flex-col gap-1.5 animate-mobile-subdock-enter-right"
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
                className="font-['Orbitron',sans-serif] text-[8.5px] font-bold tracking-widest text-left px-2.5 py-1.5 border rounded-none transition-all duration-200 cursor-pointer border-[#ff2bd6]/50 bg-[rgba(255,43,214,0.1)] text-[#ff2bd6] active:bg-[rgba(255,43,214,0.25)] flex items-center gap-1.5 mb-0.5"
              >
                <span>&lt; BACK</span>
              </button>

              {/* Subfolder List */}
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
                        : 'border-white/10 bg-white/2 text-[#8fa0bc] active:border-[#00f0ff]/50 active:text-white'
                    }`}
                  >
                    &gt; {subfolder.toUpperCase()}
                  </button>
                );
              })}
            </aside>
          )}
        </div>
      ) : (
        /* ============================================================== */
        /* DESKTOP VIEW: DUAL DOCK SIDE-BY-SIDE ON BOTTOM-LEFT            */
        /* ============================================================== */
        <div
          className="fixed bottom-[68px] sm:bottom-[76px] left-3 sm:left-6 z-50 flex items-end gap-2 pointer-events-auto select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Main Directory Dock (Dock 1) */}
          <aside
            aria-label="Tactical Navigation Dock"
            className="relative w-[210px] sm:w-[225px] bg-[rgba(6,10,18,0.96)] border border-[rgba(0,245,255,0.35)] p-3 shadow-[0_0_35px_rgba(0,245,255,0.15),inset_0_0_20px_rgba(0,245,255,0.05)] rounded-none flex flex-col gap-1.5 animate-hacker-dock-deploy overflow-hidden"
          >
            <div className="cyber-dock-corner-tl" />
            <div className="cyber-dock-corner-br" />
            <div className="absolute left-0 right-0 bg-[#00f0ff] shadow-[0_0_12px_#00f0ff] pointer-events-none z-40 animate-hacker-beam-sweep" />

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
          </aside>

          {/* Subfolder Dock (Dock 2: Opens alongside to the right on hover or click) */}
          {expandedFolder && subfoldersList.length > 0 && (
            <aside
              key={expandedFolder}
              aria-label="Subfolder Matrix Dock"
              className="relative w-[165px] sm:w-[180px] bg-[rgba(6,10,18,0.96)] border border-[rgba(0,245,255,0.45)] p-2.5 shadow-[0_0_35px_rgba(0,245,255,0.2),inset_0_0_20px_rgba(0,245,255,0.06)] rounded-none flex flex-col gap-1.5 animate-hacker-subdock-slide"
            >
              <div className="cyber-dock-corner-tl" />
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
      )}
    </>
  );
};

export default LogoDropUpNav;
