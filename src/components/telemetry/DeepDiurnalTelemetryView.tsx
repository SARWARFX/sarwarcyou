import React, { useState, useEffect, useMemo } from 'react';
import {
  getRolling7DayUsage,
  getDiurnalPhasesForDay,
  DIURNAL_PHASES_DEF,
} from '../../utils/usageTelemetry';
import { hapticMedium } from '../../utils/hapticsManager';
import { LaserCloseIcon } from '../brand/LaserIcons';

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
 * Semi-Transparent Telemetry Window
 * - Layered over the website's own page with backdrop blur
 * - State 1 (Initial): Enlarged 7-day usage graph with tall monolith bars and Ubuntu typography
 * - State 2 (On Day Click): Detailed 24-hour breakdown showing counts for the 8 diurnal categories
 * - Strict 0px border-radius, zero outlines, zero borders
 */
export const DeepDiurnalTelemetryView: React.FC<DeepDiurnalTelemetryViewProps> = ({ onClose }) => {
  // null = Enlarged 7-day graph view; number = day index to inspect 8 categories
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

  // Keyboard shortcut: ESC closes modal or returns to enlarged graph
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedDayIdx !== null) {
          setSelectedDayIdx(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDayIdx, onClose]);

  // Compute 7 rolling days of telemetry
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
      const timeFormatted = formatTime(mins);

      list.push({
        key: `day-${i}-${iso}`,
        iso,
        dayLetter,
        title,
        totalMins: mins,
        timeFormatted,
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

  // Aggregate 7-day stats
  const totalWeekMins = useMemo(
    () => sevenDays.reduce((acc, d) => acc + d.totalMins, 0),
    [sevenDays]
  );
  const avgDailyMins = Math.round(totalWeekMins / sevenDays.length);
  const peakDayItem = useMemo(
    () => sevenDays.find((d) => d.isPeak) || sevenDays[0],
    [sevenDays]
  );

  // Active day details for 8 categories inspection
  const activeDay = selectedDayIdx !== null ? sevenDays[selectedDayIdx] : null;
  const maxPhaseMins = activeDay ? Math.max(...activeDay.phasesMins, 1) : 1;

  let peakIdx = 0;
  let peakVal = 0;
  let activePhaseCount = 0;
  if (activeDay) {
    activeDay.phasesMins.forEach((m, idx) => {
      if (m > peakVal) {
        peakVal = m;
        peakIdx = idx;
      }
      if (m > 0) activePhaseCount++;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          hapticMedium();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none animate-backdrop-fade"
      style={{
        borderRadius: 0,
        outline: 'none',
        border: 'none',
        WebkitBackdropFilter: 'blur(16px)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div
        className="w-full max-w-4xl bg-[#06080e]/92 backdrop-blur-2xl border border-white/[0.12] shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col p-5 sm:p-8 relative max-h-[92vh] overflow-y-auto scrollbar-none"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {/* Top Header of Window */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[#38bdf8] text-base">◈</span>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-bold tracking-[0.16em] uppercase text-white">
                Telemetry Matrix // 7-Day Engine
              </span>
              <span className="text-[10px] text-[#94a3b8] tracking-wider uppercase">
                {selectedDayIdx === null
                  ? 'Click any day to inspect 8 diurnal phases'
                  : `${activeDay?.title.toUpperCase()} // 8 DIURNAL CATEGORIES`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onClose();
            }}
            className="text-white/70 hover:text-white transition-colors cursor-pointer p-1 bg-transparent border-0"
            style={{ borderRadius: 0, outline: 'none' }}
            title="Close (Esc)"
          >
            <LaserCloseIcon size={22} />
          </button>
        </div>

        {/* VIEW 1: ENLARGED 7-DAY GRAPH (Initial State) */}
        {selectedDayIdx === null ? (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-end flex-wrap gap-2">
              <div>
                <div className="text-[10.5px] font-bold tracking-[0.2em] uppercase text-[#38bdf8] mb-1">
                  Enlarged View // Interactive Columns
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-wide uppercase text-white">
                  7-Day Screen Time
                </h2>
              </div>
              <span className="text-[10.5px] text-[#94a3b8] tracking-wider uppercase bg-white/[0.04] px-3 py-1 border border-white/[0.08]">
                Select day to see diurnal counts
              </span>
            </div>

            {/* The 7 Enlarged Columns */}
            <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-4 pb-4 bg-white/[0.015] border border-white/[0.06] p-3 sm:p-5">
              {sevenDays.map((day, idx) => (
                <div
                  key={day.key}
                  onClick={() => {
                    hapticMedium();
                    setSelectedDayIdx(idx);
                  }}
                  className="group flex flex-col items-center gap-3 cursor-pointer p-2 sm:p-3 transition-all relative border border-transparent hover:border-white/[0.15] hover:bg-white/[0.04]"
                  style={{ borderRadius: 0, outline: 'none' }}
                  title={`Click to inspect ${day.title} (${day.timeFormatted})`}
                >
                  {/* Rotated Time + Enlarged Monolith Bar */}
                  <div className="flex items-end gap-1.5 sm:gap-2 h-[220px] sm:h-[260px] relative w-full justify-center">
                    {/* Rotated time text on left of bar */}
                    <div className="w-4 h-[220px] sm:h-[260px] flex items-center justify-center relative pointer-events-none">
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold tracking-tight whitespace-nowrap leading-none transition-colors duration-150 ${
                          day.isPeak
                            ? 'text-[#38bdf8]'
                            : day.isToday
                            ? 'text-white'
                            : 'text-[#94a3b8] group-hover:text-white'
                        }`}
                        style={{
                          fontFamily: "'Ubuntu', sans-serif",
                          transform: 'rotate(-90deg)',
                          transformOrigin: 'center center',
                          textShadow: day.isPeak
                            ? '0 0 10px rgba(56, 189, 248, 0.7)'
                            : day.isToday
                            ? '0 0 10px rgba(255, 255, 255, 0.8)'
                            : 'none',
                        }}
                      >
                        {day.timeFormatted}
                      </span>
                    </div>

                    {/* Solid monolith vertical bar */}
                    <div
                      className="w-4 sm:w-6 h-[220px] sm:h-[260px] bg-white/[0.05] flex items-end relative overflow-hidden"
                      style={{ borderRadius: 0, outline: 'none' }}
                    >
                      <div
                        className={`w-full transition-all duration-300 ${
                          day.isPeak
                            ? 'bg-[#38bdf8] shadow-[0_0_14px_rgba(56,189,248,0.7)]'
                            : day.isToday
                            ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.75)]'
                            : 'bg-[#64748b] group-hover:bg-[#94a3b8]'
                        }`}
                        style={{
                          height: `${day.heightPercent}%`,
                          borderRadius: 0,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Day Letter initial + Full day subtext on hover */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className={`text-sm sm:text-base font-bold transition-colors ${
                        day.isPeak
                          ? 'text-[#38bdf8] font-extrabold'
                          : day.isToday
                          ? 'text-white font-extrabold'
                          : 'text-[#94a3b8] group-hover:text-white'
                      }`}
                      style={{ fontFamily: "'Ubuntu', sans-serif" }}
                    >
                      {day.dayLetter}
                    </span>
                    <span className="text-[9px] font-medium tracking-tight text-[#64748b] group-hover:text-[#38bdf8] transition-colors whitespace-nowrap uppercase">
                      {day.isToday ? 'Today' : day.title.slice(0, 3)}
                    </span>
                  </div>

                  <span className="text-[8.5px] font-bold tracking-widest text-[#38bdf8] uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                    Inspect ➔
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Stats Summary Footer Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div
                className="bg-white/[0.03] border border-white/[0.08] p-3 flex flex-col gap-1"
                style={{ borderRadius: 0 }}
              >
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#64748b]">
                  Rolling 7-Day Total
                </span>
                <span
                  className="text-lg sm:text-xl font-extrabold text-white"
                  style={{ fontFamily: "'Ubuntu', sans-serif" }}
                >
                  {formatTime(totalWeekMins)}
                </span>
              </div>

              <div
                className="bg-white/[0.03] border border-white/[0.08] p-3 flex flex-col gap-1"
                style={{ borderRadius: 0 }}
              >
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#64748b]">
                  Daily Average
                </span>
                <span
                  className="text-lg sm:text-xl font-extrabold text-[#cbd5e1]"
                  style={{ fontFamily: "'Ubuntu', sans-serif" }}
                >
                  {formatTime(avgDailyMins)}
                </span>
              </div>

              <div
                className="bg-white/[0.03] border border-white/[0.08] p-3 flex flex-col gap-1"
                style={{ borderRadius: 0 }}
              >
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#64748b]">
                  Peak Day Record
                </span>
                <span
                  className="text-lg sm:text-xl font-extrabold text-[#38bdf8]"
                  style={{ fontFamily: "'Ubuntu', sans-serif" }}
                >
                  {peakDayItem.title.toUpperCase()} ({formatTime(peakDayItem.totalMins)})
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: DETAILED 8 CATEGORIES VIEW FOR CLICKED DAY */
          <div className="flex flex-col gap-6">
            {/* Header with Back button and Active Day Title */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  setSelectedDayIdx(null);
                }}
                className="px-3.5 py-1.5 bg-white/[0.05] border border-white/[0.12] text-xs font-bold tracking-wider uppercase text-white hover:bg-[#38bdf8] hover:text-black hover:border-[#38bdf8] transition-all cursor-pointer flex items-center gap-2"
                style={{ borderRadius: 0, outline: 'none' }}
              >
                <span>←</span>
                <span>Back to 7-Day Graph</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#64748b] tracking-wider uppercase">
                  Switch Day:
                </span>
                <div className="flex gap-1">
                  {sevenDays.map((d, idx) => (
                    <button
                      key={d.key}
                      onClick={() => {
                        hapticMedium();
                        setSelectedDayIdx(idx);
                      }}
                      className={`w-7 h-7 text-xs font-bold cursor-pointer transition-all border ${
                        idx === selectedDayIdx
                          ? 'bg-[#38bdf8] text-black border-[#38bdf8] shadow-[0_0_8px_#38bdf8]'
                          : 'bg-white/[0.03] text-[#94a3b8] border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
                      }`}
                      style={{
                        fontFamily: "'Ubuntu', sans-serif",
                        borderRadius: 0,
                        outline: 'none',
                      }}
                      title={d.title}
                    >
                      {d.dayLetter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Day Summary Badge */}
            <div
              className="bg-[#07090e] border border-white/[0.08] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4"
              style={{ borderRadius: 0 }}
            >
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#38bdf8] block mb-0.5">
                  {activeDay?.title.toUpperCase()} // DIURNAL PHASES BREAKDOWN
                </span>
                <div
                  className="text-xl sm:text-2xl font-extrabold text-white tracking-wide"
                  style={{ fontFamily: "'Ubuntu', sans-serif" }}
                >
                  {formatTime(activeDay?.totalMins || 0)} TOTAL RECORDED
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4 flex-wrap">
                <div
                  className="bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 flex flex-col"
                  style={{ borderRadius: 0 }}
                >
                  <span className="text-[9px] font-bold uppercase text-[#64748b]">Peak Phase</span>
                  <span className="text-xs sm:text-sm font-extrabold text-[#38bdf8]">
                    {DIURNAL_PHASES_DEF[peakIdx]?.name.toUpperCase()} ({formatTime(peakVal)})
                  </span>
                </div>
                <div
                  className="bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 flex flex-col"
                  style={{ borderRadius: 0 }}
                >
                  <span className="text-[9px] font-bold uppercase text-[#64748b]">Active Phases</span>
                  <span className="text-xs sm:text-sm font-extrabold text-white">
                    {activePhaseCount} of 8
                  </span>
                </div>
              </div>
            </div>

            {/* The 8 Categories Monolith Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-3.5 items-end min-h-[260px] pt-2">
              {DIURNAL_PHASES_DEF.map((def, idx) => {
                const mins = activeDay?.phasesMins[idx] || 0;
                const heightPct =
                  mins > 0 ? Math.max(16, Math.round((mins / maxPhaseMins) * 100)) : 6;
                const isPeak = idx === peakIdx && mins > 0;

                const barColor =
                  mins === 0
                    ? 'bg-white/[0.08]'
                    : isPeak
                    ? 'bg-[#38bdf8] shadow-[0_0_14px_rgba(56,189,248,0.7)]'
                    : activeDay?.isToday
                    ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]'
                    : 'bg-[#475569]';

                const textColor =
                  mins === 0
                    ? 'text-[#475569]'
                    : isPeak
                    ? 'text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                    : activeDay?.isToday
                    ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                    : 'text-[#94a3b8]';

                return (
                  <div
                    key={def.id}
                    className="flex flex-col items-center gap-3 h-full justify-end p-2 bg-white/[0.015] hover:bg-white/[0.04] transition-colors cursor-default border border-transparent hover:border-white/[0.08]"
                    style={{ borderRadius: 0 }}
                    title={`${def.name}: ${formatTime(mins)} (${def.window})`}
                  >
                    {/* Rotated Time + Monolith Bar */}
                    <div
                      className="flex items-end gap-1.5 h-[170px] sm:h-[190px] w-full justify-center relative"
                      style={{ borderRadius: 0 }}
                    >
                      <div
                        className="w-3.5 h-[170px] sm:h-[190px] flex items-center justify-center relative pointer-events-none"
                        style={{ borderRadius: 0 }}
                      >
                        <span
                          className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight whitespace-nowrap leading-none transition-colors duration-150 ${textColor}`}
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
                        className="w-3.5 sm:w-4 h-[170px] sm:h-[190px] bg-white/[0.04] flex items-end relative overflow-hidden"
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
                    <div className="flex flex-col items-center text-center gap-0.5 w-full">
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold tracking-wider uppercase leading-tight ${
                          isPeak ? 'text-[#38bdf8]' : 'text-white'
                        }`}
                      >
                        {def.name}
                      </span>
                      <span className="text-[8.5px] font-medium text-[#64748b] tracking-tight whitespace-nowrap">
                        {def.window}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Continuous 24-Hour Chrono-Spectrum Ribbon */}
            <div
              className="bg-[#07090e] border border-white/[0.08] p-4 flex flex-col gap-2.5"
              style={{ borderRadius: 0 }}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold tracking-[0.14em] uppercase text-[#cbd5e1]">
                  24-Hour Diurnal Spectrum
                </span>
                <span className="text-[9.5px] font-bold text-[#64748b] tracking-wider uppercase">
                  12:00 AM ➔ 11:59 PM
                </span>
              </div>

              <div
                className="w-full h-5 flex bg-white/[0.04] overflow-hidden"
                style={{ borderRadius: 0 }}
              >
                {DIURNAL_PHASES_DEF.map((def, idx) => {
                  const mins = activeDay?.phasesMins[idx] || 0;
                  const widthPct = (def.hours / 24) * 100;
                  const isPeak = idx === peakIdx && mins > 0;
                  const intensity =
                    mins > 0 ? Math.min(1, 0.35 + (mins / (def.hours * 60)) * 0.65) : 0.08;
                  const bg = isPeak ? '#38bdf8' : activeDay?.isToday ? '#ffffff' : '#64748b';

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

              <div className="flex justify-between text-[#64748b] text-[8.5px] font-bold tracking-wider uppercase px-0.5 overflow-x-auto">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeepDiurnalTelemetryView;
