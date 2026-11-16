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
 * Modeled after portfolio cyber-ad-dock:
 * - 100% Square Geometry (zero rounded corners)
 * - Corner L-brackets (Cyan top-left #00f0ff, Pink bottom-right #ff2bd6)
 * - Radar status ping indicator (#00ff9d)
 * - 7-Day horizontal time spent graph with text written on the bar
 * - Level 1 Main Dock with > HOME and > MAIN DIRECTORIES
 * - Cascading Level 2 Subfolder Dock opening alongside when a folder is clicked
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
  // Track which folder is actively selected to display in Dock 2
  const [expandedFolder, setExpandedFolder] = useState<MainDirectoryTab | null>(activeMainTab);

  useEffect(() => {
    if (isOpen) {
      setExpandedFolder(activeMainTab);
    }
  }, [isOpen, activeMainTab]);

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
        className="fixed bottom-[68px] sm:bottom-[76px] left-3 sm:left-6 z-50 flex items-end gap-2.5 pointer-events-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================== */}
        {/* DOCK 1: PRIMARY HACKER TACTICAL DOCK                           */}
        {/* ============================================================== */}
        <aside
          aria-label="Tactical Navigation Dock"
          className="relative w-[215px] sm:w-[235px] h-[520px] max-h-[85vh] bg-[rgba(6,10,18,0.96)] border border-[rgba(0,245,255,0.35)] backdrop-blur-xl p-3.5 shadow-[0_0_35px_rgba(0,245,255,0.15),inset_0_0_20px_rgba(0,245,255,0.05)] rounded-none flex flex-col justify-between transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
        >
          {/* Top-Left Cyan L-Bracket */}
          <div className="cyber-dock-corner-tl" />

          {/* Bottom-Right Pink L-Bracket */}
          <div className="cyber-dock-corner-br" />

          {/* Top Section: Header & Graph */}
          <div>
            {/* Dock Header */}
            <div className="flex items-center justify-between border-b border-[rgba(0,245,255,0.2)] pb-2 mb-2">
              <span className="font-['Orbitron',sans-serif] text-[8px] text-[#00f0ff] tracking-widest uppercase">
                CF // EDGE
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_10px_#00ff9d] animate-pulse" />
            </div>

            {/* Dock Title Lockup */}
            <div className="text-center mb-1.5">
              <div className="font-['Orbitron',sans-serif] text-[11px] font-extrabold tracking-widest text-white uppercase">
                STREAM<span className="text-[#00f0ff] drop-shadow-[0_0_12px_rgba(0,245,255,0.7)]">VAULT</span>
              </div>
              <div className="inline-block font-mono text-[7.5px] text-[#ff2bd6] tracking-widest bg-[rgba(255,43,214,0.08)] border border-dashed border-[rgba(255,43,214,0.35)] px-1.5 py-0.5 mt-0.5">
                4-IN-1 VAULT
              </div>
            </div>

            {/* 7-Day Time Spent Graph (Compact Horizontal Bars) */}
            <div className="border-t border-b border-white/10 py-2 my-2 space-y-1.5 max-h-[140px] overflow-y-auto space-scrollbar pr-0.5">
              <div className="text-[7.5px] font-mono text-[#00f0ff] tracking-widest uppercase mb-1">
                TIME SPENT // 7 DAYS
              </div>
              {filteredDays.map((d) => {
                const isToday = d.label === 'Today';
                const widthPct = d.minutes > 0 ? Math.max(20, Math.round((d.minutes / maxMinutes) * 100)) : 14;
                const displayTime = formatFullSpentTime(d.minutes);

                return (
                  <div key={d.date} className="flex flex-col gap-0.5">
                    <div className="w-full h-[18px] bg-white/5 border border-white/10 rounded-none relative overflow-hidden flex items-center">
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
                  </div>
                );
              })}
            </div>

            {/* Keep Screen On Toggle */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
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
                <span className="font-mono text-[8.5px] text-white/70 tracking-wider uppercase">
                  KEEP SCREEN ON
                </span>
              </label>
            </div>
          </div>

          {/* Level 1 Folder Matrix Slots */}
          <div className="flex flex-col gap-1.5 py-1">
            {/* > HOME Button */}
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onSelectHome();
                setExpandedFolder(null);
                onClose();
              }}
              className="font-['Orbitron',sans-serif] text-[9px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer border-white/10 bg-white/5 text-white/80 hover:border-[#00f0ff] hover:text-[#00f0ff] hover:bg-[rgba(0,245,255,0.08)] flex items-center justify-between"
            >
              <span>&gt; HOME</span>
              <span className="text-[7.5px] text-white/40 font-mono">PANEL 0</span>
            </button>

            {/* 4 Main Folders */}
            {mainFolders.map((folder) => {
              const isSelected = expandedFolder === folder;
              return (
                <button
                  key={folder}
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setExpandedFolder(folder);
                    onSelectMainTab(folder);
                  }}
                  className={`font-['Orbitron',sans-serif] text-[9px] font-bold tracking-widest text-left px-2.5 py-2 border rounded-none transition-all duration-200 cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-[#00f0ff] text-[#00f0ff] bg-[rgba(0,245,255,0.12)] shadow-[0_0_14px_rgba(0,245,255,0.25)] font-black'
                      : 'border-white/10 bg-white/2 text-[#8fa0bc] hover:border-[#00f0ff]/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>&gt; {folder.toUpperCase()}</span>
                  <span className="text-[7.5px] text-[#00f0ff]/70 font-mono">
                    {isSelected ? '● ACTIVE' : '▸'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dock Telemetry Stamp at Bottom */}
          <div className="border-t border-[rgba(0,245,255,0.18)] pt-2 text-left">
            <div className="font-['Orbitron',sans-serif] text-[7.5px] text-[#5a6b85] tracking-wider leading-relaxed border-l-2 border-[#00f0ff] pl-1.5">
              STATUS: NOMINAL<br />
              LATENCY: 0.8ms<br />
              CIPHER: ZERO_LOG
            </div>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* DOCK 2: CASCADING SUBFOLDER DOCK (Opens on folder click)        */}
        {/* ============================================================== */}
        {expandedFolder && subfoldersList.length > 0 && (
          <aside
            aria-label="Subfolder Matrix Dock"
            className="relative w-[175px] sm:w-[195px] h-[340px] max-h-[80vh] bg-[rgba(6,10,18,0.96)] border border-[rgba(0,245,255,0.45)] backdrop-blur-xl p-3 shadow-[0_0_35px_rgba(0,245,255,0.2),inset_0_0_20px_rgba(0,245,255,0.06)] rounded-none flex flex-col justify-between transition-all duration-300 animate-in fade-in slide-in-from-left-2"
          >
            {/* Top-Left Cyan L-Bracket */}
            <div className="cyber-dock-corner-tl" />

            {/* Bottom-Right Pink L-Bracket */}
            <div className="cyber-dock-corner-br" />

            {/* Header */}
            <div>
              <div className="flex items-center justify-between border-b border-[rgba(0,245,255,0.2)] pb-2 mb-2">
                <span className="font-['Orbitron',sans-serif] text-[8px] text-[#00f0ff] tracking-widest uppercase truncate max-w-[120px]">
                  DIR // {expandedFolder.toUpperCase()}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] animate-ping" />
              </div>

              <div className="font-mono text-[7px] text-[#ff2bd6] tracking-wider uppercase mb-2">
                [{subfoldersList.length} SUBFOLDERS DETECTED]
              </div>

              {/* Subfolder Matrix Slots */}
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
              </div>
            </div>

            {/* Direct Navigation Button at bottom of sub-dock */}
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onSelectSubfolder(expandedFolder, subfoldersList[0]);
                onClose();
              }}
              className="w-full py-2 bg-[#00f0ff] text-[#030712] font-['Orbitron',sans-serif] text-[8px] font-black tracking-widest border-none cursor-pointer shadow-[0_0_16px_rgba(0,245,255,0.4)] hover:bg-white transition-all uppercase"
            >
              OPEN {expandedFolder.toUpperCase()} &gt;
            </button>
          </aside>
        )}
      </div>
    </>
  );
};

export default LogoDropUpNav;
