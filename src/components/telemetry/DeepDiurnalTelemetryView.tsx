import React, { useState, useEffect, useMemo } from 'react';
import {
  getRolling7DayUsage,
  getDiurnalPhasesForDay,
  DIURNAL_PHASES_DEF,
} from '../../utils/usageTelemetry';
import { hapticMedium } from '../../utils/hapticsManager';

export interface DeepDiurnalTelemetryViewProps {
  onClose: () => void;
}

const DEFAULT_BASELINE_MINUTES = [112, 48, 24, 75, 125, 38, 62];

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}H ${String(m).padStart(2, '0')}M`;
}

/**
 * Deep Diurnal Telemetry Matrix View
 * - Displays 24-hour cycle segmented into 8 diurnal phases:
 *   1. Midnight (12:00 AM - 4:00 AM)
 *   2. Dawn (4:00 AM - 6:00 AM)
 *   3. Early Morning (6:00 AM - 9:00 AM)
 *   4. Morning (9:00 AM - 11:59 AM)
 *   5. Noon (12:00 PM - 3:00 PM)
 *   6. Afternoon (3:00 PM - 6:00 PM)
 *   7. Evening (6:00 PM - 8:00 PM)
 *   8. Early Night (8:00 PM - 12:00 AM)
 * - 7-day rolling day rail selector
 * - 100% rectangular geometry (0px border-radius), zero outline strokes
 * - Global Science Gothic typography
 */
export const DeepDiurnalTelemetryView: React.FC<DeepDiurnalTelemetryViewProps> = ({ onClose }) => {
  const [activeDayIdx, setActiveDayIdx] = useState<number>(0);

  // Keyboard shortcut: ESC closes the telemetry matrix
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Compute 7 days of telemetry
  const sevenDays = useMemo(() => {
    const now = new Date();
    const usage = getRolling7DayUsage();
    const storedDays = usage.days || [];
    const reversed = [...storedDays].reverse();
    const totalRecorded = reversed.reduce((sum, d) => sum + (d?.minutes || 0), 0);
    const useBaseline = totalRecorded === 0;

    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().split('T')[0];

      let dayLetter = 'W';
      let title = d.toLocaleDateString('en-US', { weekday: 'long' });
      if (i === 0) {
        dayLetter = 'T';
        title = 'Today';
      } else if (i === 1) {
        dayLetter = 'Y';
        title = 'Yesterday';
      } else {
        dayLetter = d.toLocaleDateString('en-US', { weekday: 'short' })[0].toUpperCase();
      }

      const recordedMins = reversed[i]?.minutes || 0;
      const mins = useBaseline ? DEFAULT_BASELINE_MINUTES[i] || 30 : Math.max(recordedMins, 1);
      const phases = getDiurnalPhasesForDay(iso, mins);

      list.push({
        key: `day-${i}-${iso}`,
        iso,
        dayLetter,
        title,
        totalMins: mins,
        isToday: i === 0,
        phasesMins: phases,
      });
    }

    const maxWeekMins = Math.max(...list.map((d) => d.totalMins), 1);
    return list.map((item) => ({
      ...item,
      heightPercent: Math.min(100, Math.max(16, Math.round((item.totalMins / maxWeekMins) * 100))),
      isPeak: item.totalMins === maxWeekMins,
    }));
  }, []);

  const activeDay = sevenDays[activeDayIdx] || sevenDays[0];
  const maxPhaseMins = Math.max(...activeDay.phasesMins, 1);

  // Identify peak phase
  let peakIdx = 0;
  let peakVal = 0;
  let activePhaseCount = 0;
  activeDay.phasesMins.forEach((m, idx) => {
    if (m > peakVal) {
      peakVal = m;
      peakIdx = idx;
    }
    if (m > 0) activePhaseCount++;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-[#030406] text-white flex flex-col overflow-y-auto overflow-x-hidden select-none"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* Top Navigation Bar */}
      <header
        className="w-full h-16 px-6 sm:px-10 flex items-center justify-between border-b border-white/[0.08] bg-[#030406]/90 backdrop-blur-md sticky top-0 z-40"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        <div className="flex items-center gap-3 text-sm font-bold tracking-[0.14em] uppercase">
          <span className="text-[#38bdf8]">◈</span>
          <span>
            Sarwar C You <span className="text-[#64748b] font-normal text-xs">// Diurnal Telemetry</span>
          </span>
        </div>

        <button
          onClick={() => {
            hapticMedium();
            onClose();
          }}
          className="px-4 py-2 bg-white/[0.04] border border-white/[0.12] text-[#cbd5e1] text-xs font-bold tracking-[0.12em] uppercase hover:bg-[#38bdf8] hover:text-black hover:border-[#38bdf8] hover:shadow-[0_0_14px_rgba(56,189,248,0.5)] transition-all cursor-pointer flex items-center gap-2"
          style={{ borderRadius: 0, outline: 'none' }}
        >
          <span>←</span>
          <span>Return to Archive</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1240px] w-full mx-auto px-6 sm:px-10 py-8 flex flex-col gap-8 flex-1">
        {/* Title Header */}
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#38bdf8] mb-1">
            Temporal Telemetry Engine // 24-Hour Cycle
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[0.06em] uppercase text-white">
            Diurnal Phase Breakdown
          </h1>
        </div>

        {/* 1. Rolling 7-Day Day Selector Rail */}
        <section
          className="bg-[#07090e] border border-white/[0.08] p-5 sm:p-6 flex flex-col gap-4"
          style={{ borderRadius: 0, outline: 'none' }}
        >
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold tracking-[0.14em] uppercase text-[#cbd5e1]">
              Select Day to Inspect (Rolling 7 Days)
            </span>
            <span className="text-[10px] font-bold text-[#38bdf8] tracking-[0.1em] uppercase">
              ● Live Sync
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2.5 sm:gap-3.5">
            {sevenDays.map((day, idx) => {
              const isActive = idx === activeDayIdx;
              return (
                <div
                  key={day.key}
                  onClick={() => {
                    hapticMedium();
                    setActiveDayIdx(idx);
                  }}
                  className={`p-3 sm:p-4 flex flex-col items-center gap-2.5 sm:gap-3 cursor-pointer transition-all relative border ${
                    isActive
                      ? 'bg-[#38bdf8]/10 border-[#38bdf8] shadow-[0_0_16px_rgba(56,189,248,0.25)]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.2]'
                  }`}
                  style={{ borderRadius: 0, outline: 'none' }}
                >
                  <span
                    className={`text-xs sm:text-sm font-bold tracking-wider ${
                      isActive ? 'text-white' : 'text-[#94a3b8]'
                    }`}
                    style={{ fontFamily: "'Ubuntu', sans-serif" }}
                  >
                    {day.dayLetter}
                  </span>

                  <div
                    className="w-2 sm:w-2.5 h-12 bg-white/[0.06] flex items-end relative overflow-hidden"
                    style={{ borderRadius: 0, outline: 'none' }}
                  >
                    <div
                      className={`w-full transition-all duration-300 ${
                        isActive || day.isPeak
                          ? 'bg-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                          : day.isToday
                          ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                          : 'bg-[#64748b]'
                      }`}
                      style={{
                        height: `${day.heightPercent}%`,
                        borderRadius: 0,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <span
                    className="text-[10px] sm:text-[11px] font-bold text-[#cbd5e1] tracking-tight whitespace-nowrap"
                    style={{ fontFamily: "'Ubuntu', sans-serif" }}
                  >
                    {formatTime(day.totalMins)}
                  </span>

                  {isActive && (
                    <div
                      className="absolute bottom-0 left-0 w-full h-[3px] bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]"
                      style={{ borderRadius: 0 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. The 8 Diurnal Phases Monolith Matrix */}
        <section
          className="bg-[#07090e] border border-white/[0.08] p-6 sm:p-8 flex flex-col gap-6"
          style={{ borderRadius: 0, outline: 'none' }}
        >
          {/* Summary Row */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-white/[0.06]">
            <div>
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#38bdf8] mb-1">
                {activeDay.title.toUpperCase()} // {activeDay.isToday ? 'ACTIVE TELEMETRY' : 'RECORDED ARCHIVE'}
              </div>
              <div
                className="text-2xl sm:text-3xl font-extrabold text-white tracking-[0.04em]"
                style={{ fontFamily: "'Ubuntu', sans-serif" }}
              >
                {formatTime(activeDay.totalMins)} TOTAL TIME
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6 flex-wrap">
              <div
                className="bg-white/[0.03] border border-white/[0.07] px-4 py-2 flex flex-col gap-1"
                style={{ borderRadius: 0 }}
              >
                <span className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-[#64748b]">
                  Peak Phase
                </span>
                <span className="text-sm sm:text-base font-extrabold text-[#38bdf8] tracking-wide">
                  {DIURNAL_PHASES_DEF[peakIdx].name.toUpperCase()} ({formatTime(peakVal)})
                </span>
              </div>

              <div
                className="bg-white/[0.03] border border-white/[0.07] px-4 py-2 flex flex-col gap-1"
                style={{ borderRadius: 0 }}
              >
                <span className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-[#64748b]">
                  Active Phases
                </span>
                <span className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                  {activePhaseCount} of 8
                </span>
              </div>

              <div
                className="bg-white/[0.03] border border-white/[0.07] px-4 py-2 flex flex-col gap-1"
                style={{ borderRadius: 0 }}
              >
                <span className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-[#64748b]">
                  Primary Concentration
                </span>
                <span className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                  {DIURNAL_PHASES_DEF[peakIdx].name.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* 8 Monolith Columns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-end min-h-[300px] pt-4">
            {DIURNAL_PHASES_DEF.map((def, idx) => {
              const mins = activeDay.phasesMins[idx] || 0;
              const heightPct =
                mins > 0 ? Math.max(16, Math.round((mins / maxPhaseMins) * 100)) : 6;
              const isPeak = idx === peakIdx && mins > 0;

              const barColor =
                mins === 0
                  ? 'bg-white/[0.08]'
                  : isPeak
                  ? 'bg-[#38bdf8] shadow-[0_0_14px_rgba(56,189,248,0.7)]'
                  : activeDay.isToday
                  ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]'
                  : 'bg-[#475569]';

              const textColor =
                mins === 0
                  ? 'text-[#475569]'
                  : isPeak
                  ? 'text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                  : activeDay.isToday
                  ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                  : 'text-[#94a3b8]';

              return (
                <div
                  key={def.id}
                  className="flex flex-col items-center gap-4 h-full justify-end p-2 hover:bg-white/[0.02] transition-colors cursor-default"
                  style={{ borderRadius: 0 }}
                  title={`${def.name}: ${formatTime(mins)} (${def.window})`}
                >
                  {/* Rotated Time + Monolith Bar */}
                  <div
                    className="flex items-end gap-2 h-[200px] sm:h-[220px] w-full justify-center relative"
                    style={{ borderRadius: 0 }}
                  >
                    <div
                      className="w-4 h-[200px] sm:h-[220px] flex items-center justify-center relative pointer-events-none"
                      style={{ borderRadius: 0 }}
                    >
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold tracking-tight whitespace-nowrap leading-none transition-colors duration-150 ${textColor}`}
                        style={{
                          fontFamily: "'Ubuntu', sans-serif",
                          transform: 'rotate(-90deg)',
                          transformOrigin: 'center center',
                          borderRadius: 0,
                        }}
                      >
                        {formatTime(mins)}
                      </span>
                    </div>

                    <div
                      className="w-4 sm:w-5 h-[200px] sm:h-[220px] bg-white/[0.04] flex items-end relative overflow-hidden"
                      style={{ borderRadius: 0 }}
                    >
                      <div
                        className={`w-full transition-all duration-300 ${barColor}`}
                        style={{
                          height: `${heightPct}%`,
                          borderRadius: 0,
                        }}
                      />
                    </div>
                  </div>

                  {/* Phase Label & Time Window */}
                  <div className="flex flex-col items-center text-center gap-1 w-full">
                    <span
                      className={`text-[11px] font-bold tracking-wider uppercase leading-tight ${
                        isPeak ? 'text-[#38bdf8]' : 'text-white'
                      }`}
                    >
                      {def.name}
                    </span>
                    <span className="text-[9px] font-medium text-[#64748b] tracking-tight whitespace-nowrap">
                      {def.window}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Continuous 24-Hour Chrono-Spectrum Ribbon */}
        <section
          className="bg-[#07090e] border border-white/[0.08] p-5 sm:p-6 flex flex-col gap-3.5"
          style={{ borderRadius: 0, outline: 'none' }}
        >
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold tracking-[0.14em] uppercase text-[#cbd5e1]">
              24-Hour Continuous Spectrum Ribbon
            </span>
            <span className="text-[10px] font-bold text-[#64748b] tracking-wider">
              12:00 AM ➔ 11:59 PM
            </span>
          </div>

          <div
            className="w-full h-6 flex bg-white/[0.04] overflow-hidden"
            style={{ borderRadius: 0 }}
          >
            {DIURNAL_PHASES_DEF.map((def, idx) => {
              const mins = activeDay.phasesMins[idx] || 0;
              const widthPct = (def.hours / 24) * 100;
              const isPeak = idx === peakIdx && mins > 0;
              const intensity =
                mins > 0
                  ? Math.min(1, 0.35 + (mins / (def.hours * 60)) * 0.65)
                  : 0.08;
              const bg = isPeak
                ? '#38bdf8'
                : activeDay.isToday
                ? '#ffffff'
                : '#64748b';

              return (
                <div
                  key={def.id}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: bg,
                    opacity: intensity,
                    borderRadius: 0,
                  }}
                  className="h-full transition-all duration-300 hover:brightness-125 cursor-help"
                  title={`${def.name} (${def.window}): ${formatTime(mins)}`}
                />
              );
            })}
          </div>

          <div className="flex justify-between text-[#64748b] text-[9.5px] font-bold tracking-wider uppercase px-1 overflow-x-auto">
            <span>00:00 (Midnight)</span>
            <span>04:00 (Dawn)</span>
            <span>06:00 (Early AM)</span>
            <span>09:00 (Morning)</span>
            <span>12:00 (Noon)</span>
            <span>15:00 (Afternoon)</span>
            <span>18:00 (Evening)</span>
            <span>20:00 (Night)</span>
            <span>24:00</span>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DeepDiurnalTelemetryView;
