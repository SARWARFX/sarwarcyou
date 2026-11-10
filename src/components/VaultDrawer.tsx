import React, { useEffect, useState, useMemo } from 'react';
import { hapticMedium } from '../utils/hapticsManager';
import { getRolling7DayUsage, formatShortDuration } from '../utils/usageTelemetry';
import {
  getKeepScreenOnState,
  toggleKeepScreenOn,
  subscribeKeepScreenOn,
} from '../utils/keepAwakeManager';
import type { StageMediaItem } from '../types';
import type { DirectoryNode } from './DeepSpaceTreeExplorer';
import { Clock, Calendar, ShieldCheck, X, BarChart3, Sun } from 'lucide-react';

export interface VaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder?: (
    folderId: 'clips' | 'shorts' | 'photography' | 'realtube' | 'youtube',
    subfolderName?: string
  ) => void;
  onSelectHome?: () => void;
  rootMap?: Map<string, DirectoryNode>;
  onOpenPhoto?: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo?: (item: StageMediaItem) => void;
}

export const VaultDrawer: React.FC<VaultDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [telemetry, setTelemetry] = useState(() => getRolling7DayUsage());
  const [keepScreenOn, setKeepScreenOn] = useState<boolean>(() => getKeepScreenOnState());
  const [showOnlyActiveDays, setShowOnlyActiveDays] = useState<boolean>(true);

  // Subscribe to Keep Screen On
  useEffect(() => {
    return subscribeKeepScreenOn((active) => {
      setKeepScreenOn(active);
    });
  }, []);

  const handleToggleKeepScreenOn = async () => {
    hapticMedium();
    const nextVal = await toggleKeepScreenOn();
    setKeepScreenOn(nextVal);
  };

  // When drawer opens: refresh telemetry & listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    setTelemetry(getRolling7DayUsage());

    // Live refresh every 15 seconds while open
    const interval = setInterval(() => {
      setTelemetry(getRolling7DayUsage());
    }, 15000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Days to display based on user preference (hide 0-minute days by default)
  const displayedDays = useMemo(() => {
    if (showOnlyActiveDays) {
      return telemetry.activeDays.length > 0
        ? telemetry.activeDays
        : telemetry.days.filter((d) => d.label === 'TODAY');
    }
    return telemetry.days;
  }, [showOnlyActiveDays, telemetry]);

  const maxVal = useMemo(() => {
    return Math.max(...displayedDays.map((d) => d.minutes), 1);
  }, [displayedDays]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Acid Avant-Garde Telemetry Tray Panel */}
      <aside
        role="dialog"
        aria-label="User Activity Telemetry"
        className={`fixed top-0 left-0 bottom-0 z-50 w-96 max-w-[92vw] bg-[#08080a] border-r border-white/10 flex flex-col p-5 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.95)] transition-transform duration-300 ease-out select-none font-['Roboto_Condensed'] font-sans text-white overflow-hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 10% 10%, rgba(204, 255, 0, 0.04) 0%, transparent 60%)',
        }}
      >
        {/* Masthead */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="font-['Space_Grotesk',sans-serif] text-base font-black tracking-wider uppercase text-white">
              SARWAR<span className="text-[#ccff00]">.CYOU</span>
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-[#ccff00] uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] shadow-[0_0_6px_rgba(204,255,0,0.8)] animate-pulse" />
              <span>TIME &amp; SESSION METRICS</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#ccff00]/15 border border-white/10 hover:border-[#ccff00]/40 text-neutral-400 hover:text-[#ccff00] flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
            title="Close tray"
            aria-label="Close tray"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Metrics Content */}
        <div className="flex-1 overflow-y-auto space-scrollbar py-4 space-y-5">
          {/* 1. Hero Stat Card: Today's Time */}
          <div className="relative rounded-2xl p-5 bg-[#0d0d11] border border-white/10 overflow-hidden shadow-lg">
            {/* Background subtle scanline aura */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(ellipse_at_top_right,_rgba(204,255,0,0.12)_0%,_transparent_70%)] pointer-events-none" />

            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#ccff00] font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>TODAY&apos;S ENGAGEMENT</span>
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono text-neutral-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>

            {/* Huge Time Metric */}
            <div className="my-1">
              <span className="font-['Space_Grotesk',sans-serif] text-4xl sm:text-5xl font-black text-[#ccff00] tracking-tight drop-shadow-[0_0_12px_rgba(204,255,0,0.3)]">
                {telemetry.todayFormatted.replace(' today', '')}
              </span>
              <span className="text-sm font-mono text-neutral-400 uppercase tracking-wider ml-2">
                TODAY
              </span>
            </div>

            <p className="text-[11px] font-sans text-neutral-400 mt-2 leading-relaxed">
              Active browser session recorded across the platform today.
            </p>

            {/* Quick Micro-Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/10">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col">
                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
                  7-DAY TOTAL
                </span>
                <span className="text-sm font-mono font-bold text-white mt-0.5">
                  {formatShortDuration(telemetry.totalWeekMinutes)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col">
                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
                  DAILY AVG
                </span>
                <span className="text-sm font-mono font-bold text-white mt-0.5">
                  {formatShortDuration(telemetry.averageMinutes)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Interactive Time Spent Graph */}
          <div className="rounded-2xl p-5 bg-[#0d0d11] border border-white/10 shadow-lg flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#ccff00]" />
                <h3 className="font-['Space_Grotesk',sans-serif] text-xs font-bold uppercase tracking-wider text-white">
                  TIME SPENT GRAPH
                </h3>
              </div>

              {/* Filter Switcher: Active Days Only vs All 7 Days */}
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  setShowOnlyActiveDays((prev) => !prev);
                }}
                className="text-[9px] font-mono tracking-wider uppercase px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                title="Toggle empty days"
              >
                {showOnlyActiveDays ? 'FILTER: ACTIVE DAYS' : 'SHOW: ALL 7 DAYS'}
              </button>
            </div>

            {/* Graph Bars Area */}
            {displayedDays.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 font-mono text-xs">
                No activity recorded yet for this period.
              </div>
            ) : (
              <div className="pt-6 pb-2">
                <div className="flex items-end justify-around gap-2 h-36 border-b border-white/10 px-1 pb-1">
                  {displayedDays.map((day) => {
                    const isToday = day.label === 'TODAY';
                    const heightPercent =
                      maxVal > 0 && day.minutes > 0
                        ? Math.max(Math.round((day.minutes / maxVal) * 100), 10)
                        : 3;

                    return (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer max-w-[48px]"
                        title={`${day.label} (${day.formattedDate}): ${day.formattedMinutes}`}
                      >
                        {/* Hover / Active Floating Value */}
                        <span
                          className={`text-[9px] font-mono font-bold mb-1 transition-all duration-200 truncate ${
                            isToday
                              ? 'text-[#ccff00]'
                              : 'text-neutral-400 group-hover:text-white'
                          }`}
                        >
                          {day.minutes > 0 ? day.formattedMinutes : '—'}
                        </span>

                        {/* Animated Glowing Vertical Bar */}
                        <div
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            isToday
                              ? 'bg-gradient-to-t from-[#ccff00]/40 to-[#ccff00] shadow-[0_0_14px_rgba(204,255,0,0.45)] group-hover:shadow-[0_0_20px_rgba(204,255,0,0.8)]'
                              : day.minutes > 0
                              ? 'bg-gradient-to-t from-white/10 to-neutral-200 group-hover:from-[#ccff00]/30 group-hover:to-[#ccff00] group-hover:shadow-[0_0_12px_rgba(204,255,0,0.4)]'
                              : 'bg-white/5'
                          }`}
                          style={{
                            height: `${heightPercent}%`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Labels */}
                <div className="flex items-center justify-around gap-2 pt-2 px-1">
                  {displayedDays.map((day) => {
                    const isToday = day.label === 'TODAY';
                    return (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center max-w-[48px]"
                      >
                        <span
                          className={`text-[10px] font-mono leading-none tracking-wider ${
                            isToday
                              ? 'text-[#ccff00] font-black'
                              : 'text-neutral-400 group-hover:text-white'
                          }`}
                        >
                          {day.label}
                        </span>
                        <span className="text-[8px] font-mono text-neutral-600 mt-1 leading-none">
                          {day.weekday}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Day-by-Day Detailed Log Breakdown */}
          <div className="rounded-2xl p-4 sm:p-5 bg-[#0d0d11] border border-white/10 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#ccff00]" />
                <span>ACTIVITY LOG ({displayedDays.filter((d) => d.minutes > 0).length} DAYS)</span>
              </span>
              <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
                VERIFIED
              </span>
            </div>

            <div className="space-y-2">
              {displayedDays
                .filter((d) => d.minutes > 0)
                .map((day) => {
                  const isToday = day.label === 'TODAY';
                  const percent = maxVal > 0 ? Math.round((day.minutes / maxVal) * 100) : 0;

                  return (
                    <div
                      key={day.date}
                      className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 flex flex-col gap-1.5 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-[11px] ${
                              isToday ? 'text-[#ccff00]' : 'text-neutral-300'
                            }`}
                          >
                            {isToday ? 'Today' : day.label === 'YEST' ? 'Yesterday' : day.weekday}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {day.formattedDate}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-xs text-white">
                          {day.formattedMinutes}
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isToday ? 'bg-[#ccff00]' : 'bg-neutral-400'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Drawer Footer Cluster: Keep Screen On & Privacy */}
        <div className="mt-auto pt-4 border-t border-white/[0.08] flex flex-col gap-3 shrink-0">
          {/* Keep Screen On Toggle Bar */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  keepScreenOn
                    ? 'bg-[#ccff00]/15 text-[#ccff00]'
                    : 'bg-white/5 text-neutral-400'
                }`}
              >
                <Sun className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-sans font-medium text-neutral-200 tracking-wide">
                  Keep Screen On
                </span>
                <span className="text-[9px] text-neutral-400 font-mono tracking-wider">
                  {keepScreenOn ? 'ALWAYS AWAKE' : 'SYSTEM SLEEP'}
                </span>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={keepScreenOn}
              onClick={handleToggleKeepScreenOn}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full p-0.5 border border-white/10 transition-colors duration-200 ease-in-out focus:outline-none ${
                keepScreenOn ? 'bg-[#ccff00] shadow-[0_0_10px_rgba(204,255,0,0.4)]' : 'bg-neutral-800'
              }`}
              title={keepScreenOn ? 'Keep screen on: Enabled' : 'Keep screen on: Disabled'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow-md transition duration-200 ease-in-out ${
                  keepScreenOn
                    ? 'translate-x-4 bg-black'
                    : 'translate-x-0 bg-neutral-400'
                }`}
              />
            </button>
          </div>

          {/* Privacy Note */}
          <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono text-neutral-500 uppercase tracking-widest text-center">
            <ShieldCheck className="w-3 h-3 text-[#ccff00]" />
            <span>100% PRIVATE • STORED LOCALLY IN BROWSER</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default VaultDrawer;
