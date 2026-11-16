import React from 'react';
import { hapticLight, hapticMedium } from '../../utils/hapticsManager';

export type MainDirectoryTab = 'Photographs' | 'Shorts' | 'Video Clips' | 'Bandhobi';

export const DIRECTORY_SUBFOLDERS: Record<MainDirectoryTab, string[]> = {
  Photographs: ['Favorite', '2027', '2026', '2025', 'Older'],
  'Video Clips': ['Favorite', '2027', '2026', '2025', 'Older'],
  Shorts: ['2027', 'Older'],
  Bandhobi: ['Photographs', 'Shorts', 'Video Clips'],
};

export interface TelemetryDayData {
  date: string;
  label: string;
  minutes: number;
}

export interface LogoDropUpNavProps {
  isOpen: boolean;
  onClose: () => void;
  activeMainTab: MainDirectoryTab;
  onSelectMainTab: (tab: MainDirectoryTab) => void;
  activeSubfolder: string;
  onSelectSubfolder: (tab: MainDirectoryTab, subfolder: string) => void;
  telemetryData: TelemetryDayData[];
  keepAwakeOn: boolean;
  onToggleKeepAwake: () => void;
}

export const LogoDropUpNav: React.FC<LogoDropUpNavProps> = ({
  isOpen,
  onClose,
  activeMainTab,
  onSelectMainTab,
  activeSubfolder,
  onSelectSubfolder,
  telemetryData,
  keepAwakeOn,
  onToggleKeepAwake,
}) => {
  if (!isOpen) return null;

  const maxMinutes = Math.max(
    ...telemetryData.map((d) => d.minutes),
    60
  );

  const mainTabs: MainDirectoryTab[] = ['Photographs', 'Shorts', 'Video Clips', 'Bandhobi'];
  const currentSubfolders = DIRECTORY_SUBFOLDERS[activeMainTab] || [];

  return (
    <>
      {/* Backdrop overlay to close when clicking outside */}
      <div
        className="fixed inset-0 z-45 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Upward expanding glassmorphic navigation tray */}
      <nav
        className="fixed bottom-[68px] sm:bottom-[76px] left-3 sm:left-6 z-50 w-[calc(100vw-24px)] sm:w-[480px] max-w-[520px] max-h-[82vh] overflow-y-auto space-scrollbar rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(204,255,0,0.12)] p-4 sm:p-5 select-none pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
        aria-label="Website Directory Navigation"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================== */}
        {/* 1. TOP SECTION: VISITOR TIME-SPENT GRAPH                       */}
        {/* ============================================================== */}
        <section className="border-b border-white/10 pb-4 mb-4">
          {/* Desktop/Tablet Graph (> 640px) */}
          <div className="hidden sm:flex items-end justify-between gap-1.5 h-20 px-1 pt-1 pb-1">
            {telemetryData.map((d) => {
              const isToday = d.label === 'Today';
              const heightPct =
                d.minutes > 0 ? Math.max(12, Math.round((d.minutes / maxMinutes) * 100)) : 4;
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center justify-end h-full group"
                  title={`${d.label}: ${d.minutes}m`}
                >
                  <div className="w-full flex items-end justify-center h-14 bg-white/5 rounded-sm p-0.5">
                    <div
                      className="w-full bg-gradient-to-t from-[#99cc00] to-[#ccff00] rounded-xs shadow-[0_0_10px_rgba(204,255,0,0.35)] transition-all duration-300"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span
                    className={`font-['Orbitron',sans-serif] text-[8.5px] tracking-wider uppercase pt-1 whitespace-nowrap ${
                      isToday ? 'text-[#ccff00] font-black' : 'text-white/45 font-bold'
                    }`}
                  >
                    {d.label.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile Graph (< 640px): Compact horizontal track list */}
          <div className="flex sm:hidden flex-col gap-1.5 max-h-[140px] overflow-y-auto space-scrollbar pt-1">
            {telemetryData.map((d) => {
              const isToday = d.label === 'Today';
              const widthPct =
                d.minutes > 0 ? Math.max(10, Math.round((d.minutes / maxMinutes) * 100)) : 0;
              return (
                <div key={d.date} className="flex items-center justify-between gap-2">
                  <span
                    className={`w-12 font-['Orbitron',sans-serif] text-[9px] tracking-wider uppercase shrink-0 ${
                      isToday ? 'text-[#ccff00] font-black' : 'text-white/45 font-bold'
                    }`}
                  >
                    {d.label}
                  </span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-[#99cc00] to-[#ccff00] rounded-full shadow-[0_0_8px_rgba(204,255,0,0.4)] transition-all duration-300"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Keep Screen On Toggle */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
            <label
              className="inline-flex items-center gap-2.5 cursor-pointer select-none"
              onClick={() => {
                hapticLight();
                onToggleKeepAwake();
              }}
            >
              <div
                className={`w-8 h-4.5 rounded-full relative transition-colors duration-200 ${
                  keepAwakeOn ? 'bg-[#ccff00]' : 'bg-white/15'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full absolute top-0.5 transition-transform duration-200 ${
                    keepAwakeOn ? 'translate-x-4 bg-black' : 'translate-x-0.5 bg-white'
                  }`}
                />
              </div>
              <span className="font-mono text-[10.5px] text-white/60 tracking-wider">
                Keep Screen On
              </span>
            </label>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 2. LEVEL 1: FOUR MAIN DIRECTORY TABS                           */}
        {/* Photographs • Shorts • Video Clips • Bandhobi                  */}
        {/* ============================================================== */}
        <section className="mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
            {mainTabs.map((tab) => {
              const isActive = activeMainTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    onSelectMainTab(tab);
                  }}
                  className={`font-['Orbitron',sans-serif] text-[10px] sm:text-[10.5px] font-bold tracking-wider uppercase py-2 px-1.5 rounded-lg transition-all duration-200 cursor-pointer text-center truncate ${
                    isActive
                      ? 'bg-[#ccff00] text-black shadow-[0_0_16px_rgba(204,255,0,0.5)] font-black'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </section>

        {/* ============================================================== */}
        {/* 3. LEVEL 2: SUBFOLDER SELECTION                                */}
        {/* Displays ordered subfolders for the selected main directory     */}
        {/* ============================================================== */}
        <section>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {currentSubfolders.map((subfolder) => {
              const isActive = activeSubfolder === subfolder;
              return (
                <button
                  key={subfolder}
                  type="button"
                  onClick={() => {
                    hapticLight();
                    onSelectSubfolder(activeMainTab, subfolder);
                    onClose();
                  }}
                  className={`font-['Orbitron',sans-serif] text-[10px] sm:text-[11px] tracking-wider uppercase px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'border-[#ccff00] bg-[#ccff00]/15 text-[#ccff00] font-black drop-shadow-[0_0_10px_#ccff00]'
                      : 'border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/25 hover:bg-white/10'
                  }`}
                >
                  {subfolder}
                </button>
              );
            })}
          </div>
        </section>
      </nav>
    </>
  );
};

export default LogoDropUpNav;
