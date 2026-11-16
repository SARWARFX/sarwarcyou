import React from 'react';
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
  telemetryData: Telemetry7DayEntry[];
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

  // Filter out days with 0 data (excluding zero days as requested)
  // If Today has 0 minutes, keep Today so user sees current session
  const filteredDays = telemetryData.filter((d, idx) => d.minutes > 0 || idx === 0);

  const maxMinutes = Math.max(
    ...filteredDays.map((d) => d.minutes),
    30
  );

  const mainTabs: MainDirectoryTab[] = ['Photographs', 'Shorts', 'Video Clips', 'Bandhobi'];
  const currentSubfolders = DIRECTORY_SUBFOLDERS[activeMainTab] || [];

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-45 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Upward expanding square cyber navigation tray (less wide, more height, no rounded corners) */}
      <nav
        className="fixed bottom-[68px] sm:bottom-[76px] left-3 sm:left-6 z-50 w-[calc(100vw-24px)] sm:w-[350px] max-w-[360px] min-h-[500px] max-h-[88vh] overflow-y-auto space-scrollbar rounded-none bg-black/92 backdrop-blur-2xl border border-[#00f0ff]/30 shadow-[0_24px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(0,240,255,0.18)] p-4 select-none pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 flex flex-col justify-between"
        aria-label="Website Directory Navigation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 flex flex-col">
          {/* ============================================================== */}
          {/* 1. TOP SECTION: VISITOR TIME-SPENT 7-DAY HORIZONTAL GRAPH      */}
          {/* Displays Today, Yesterday, and past days (excluding zero days) */}
          {/* Spent time written directly inside the horizontal bar           */}
          {/* ============================================================== */}
          <section className="border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-['Orbitron',sans-serif] text-[10px] tracking-widest uppercase text-[#00f0ff] font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-none bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]"></span>
                Time Spent (7 Days)
              </span>
            </div>

            {/* Horizontal Bar Graph */}
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto space-scrollbar pr-1">
              {filteredDays.length === 0 ? (
                <div className="text-[11px] font-mono text-white/40 py-2">
                  No active session time recorded yet.
                </div>
              ) : (
                filteredDays.map((d) => {
                  const isToday = d.label === 'Today';
                  const widthPct = d.minutes > 0 ? Math.max(22, Math.round((d.minutes / maxMinutes) * 100)) : 16;
                  const displayTime = formatFullSpentTime(d.minutes);

                  return (
                    <div key={d.date} className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-center text-[10.5px] font-mono">
                        <span className={isToday ? 'text-[#00f0ff] font-bold' : 'text-white/80'}>
                          {d.label}
                        </span>
                      </div>
                      <div className="w-full h-[22px] bg-white/5 border border-white/10 rounded-none relative overflow-hidden flex items-center">
                        <div
                          className={`h-full rounded-none transition-all duration-300 ${
                            isToday
                              ? 'bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                              : 'bg-gradient-to-r from-white/30 to-white/50'
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                        <span
                          className={`absolute left-2 text-[9.5px] font-mono font-bold tracking-wide truncate z-10 ${
                            isToday ? 'text-black' : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
                          }`}
                        >
                          {displayTime}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Keep Screen On Square Toggle */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
              <label
                className="inline-flex items-center gap-2.5 cursor-pointer select-none"
                onClick={() => {
                  hapticLight();
                  onToggleKeepAwake();
                }}
              >
                <div
                  className={`w-7 h-4 rounded-none relative border transition-colors duration-200 ${
                    keepAwakeOn ? 'bg-[#00f0ff] border-[#00f0ff]' : 'bg-white/10 border-white/20'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-none absolute top-0.5 transition-transform duration-200 ${
                      keepAwakeOn ? 'translate-x-3 bg-black' : 'translate-x-0.5 bg-white'
                    }`}
                  />
                </div>
                <span className="font-mono text-[10px] text-white/70 tracking-wider uppercase">
                  Keep Screen On
                </span>
              </label>
            </div>
          </section>

          {/* ============================================================== */}
          {/* 2. LEVEL 1: FOUR MAIN DIRECTORY TABS (SQUARE BOXES)            */}
          {/* Photographs • Shorts • Video Clips • Bandhobi                  */}
          {/* ============================================================== */}
          <section className="mb-3">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 rounded-none border border-white/10">
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
                    className={`font-['Orbitron',sans-serif] text-[10px] font-bold tracking-wider uppercase py-2 px-1 rounded-none border transition-all duration-200 cursor-pointer text-center truncate ${
                      isActive
                        ? 'border-[#00f0ff] bg-[#00f0ff] text-black shadow-[0_0_14px_rgba(0,240,255,0.5)] font-black'
                        : 'border-white/5 text-white/60 hover:text-white hover:border-[#00f0ff]/30 hover:bg-white/10'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ============================================================== */}
          {/* 3. LEVEL 2: SUBFOLDER SELECTION (SQUARE BOXES)                 */}
          {/* Displays ordered subfolders for the selected main directory     */}
          {/* ============================================================== */}
          <section className="mt-1">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#00f0ff] mb-1.5">
              Subfolders // {activeMainTab}
            </div>
            <div className="flex flex-wrap gap-1.5">
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
                    className={`font-['Orbitron',sans-serif] text-[10px] tracking-wider uppercase px-2.5 py-1.5 rounded-none border transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'border-[#00f0ff] bg-[#00f0ff]/20 text-[#00f0ff] font-bold shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                        : 'border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-[#00f0ff]/40 hover:bg-white/10'
                    }`}
                  >
                    {subfolder}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </nav>
    </>
  );
};

export default LogoDropUpNav;
