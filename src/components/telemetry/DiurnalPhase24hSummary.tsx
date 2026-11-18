import React, { useMemo } from 'react';
import { getRolling7DayUsage, getDiurnalPhasesForDay, getLocalDateKey } from '../../utils/usageTelemetry';

export interface DiurnalPhase24hSummaryProps {
  dayIndex?: number; // 0 = Today, 1 = Yesterday, 2 = S, etc.
  className?: string;
}

const DEFAULT_BASELINE_MINUTES = [112, 48, 24, 75, 125, 38, 62];

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}H ${String(m).padStart(2, '0')}M`;
}

interface DiurnalCategory24 {
  id: string;
  name: string;
  shortName: string;
  window24: string;
  shortWindow: string;
}

const DIURNAL_CATEGORIES_24: DiurnalCategory24[] = [
  { id: 'midnight', name: 'MIDNIGHT', shortName: 'MID', window24: '00:00 – 04:00', shortWindow: '00-04' },
  { id: 'dawn', name: 'DAWN', shortName: 'DAWN', window24: '04:00 – 06:00', shortWindow: '04-06' },
  { id: 'early_morning', name: 'EARLY MORNING', shortName: 'E.MORN', window24: '06:00 – 09:00', shortWindow: '06-09' },
  { id: 'morning', name: 'MORNING', shortName: 'MORN', window24: '09:00 – 12:00', shortWindow: '09-12' },
  { id: 'noon', name: 'NOON', shortName: 'NOON', window24: '12:00 – 15:00', shortWindow: '12-15' },
  { id: 'afternoon', name: 'AFTERNOON', shortName: 'AFT', window24: '15:00 – 18:00', shortWindow: '15-18' },
  { id: 'evening', name: 'EVENING', shortName: 'EVE', window24: '18:00 – 20:00', shortWindow: '18-20' },
  { id: 'early_night', name: 'EARLY NIGHT', shortName: 'NIGHT', window24: '20:00 – 24:00', shortWindow: '20-24' },
];

export const DiurnalPhase24hSummary: React.FC<DiurnalPhase24hSummaryProps> = ({
  dayIndex = 0,
  className = '',
}) => {
  const dayData = useMemo(() => {
    const now = new Date();
    const d = new Date();
    d.setDate(now.getDate() - dayIndex);
    const iso = getLocalDateKey(d);

    const usage = getRolling7DayUsage();
    const storedDays = usage.days || [];
    const reversed = [...storedDays].reverse();
    const totalRecorded = reversed.reduce((sum, item) => sum + (item?.minutes || 0), 0);
    const useBaseline = totalRecorded === 0;

    const recordedMins = reversed[dayIndex]?.minutes || 0;
    const mins = useBaseline ? DEFAULT_BASELINE_MINUTES[dayIndex] || 30 : Math.max(recordedMins, 1);
    const phases = getDiurnalPhasesForDay(iso, mins);

    let dayTitle = 'TODAY';
    if (dayIndex === 1) dayTitle = 'YESTERDAY';
    else if (dayIndex > 1) {
      dayTitle = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    }

    const maxPhase = Math.max(...phases, 1);
    let peakIdx = 0;
    let peakVal = 0;
    phases.forEach((m, idx) => {
      if (m > peakVal) {
        peakVal = m;
        peakIdx = idx;
      }
    });

    return {
      iso,
      dayTitle,
      totalMins: mins,
      timeFormatted: formatTime(mins),
      phases,
      maxPhase,
      peakIdx,
      isToday: dayIndex === 0,
    };
  }, [dayIndex]);

  return (
    <div
      className={`w-full flex flex-col items-center justify-center select-none bg-transparent ${className}`}
      style={{
        borderRadius: 0,
        outline: 'none',
        border: 'none',
        fontFamily: "'Science Gothic', sans-serif",
      }}
    >
      {/* Sleek Sub-Header with Selected Day & Total Time */}
      <div className="w-full max-w-xl sm:max-w-2xl flex items-center justify-between px-2 mb-2 sm:mb-3">
        <span
          className="text-[10.5px] sm:text-[12px] font-bold tracking-[0.16em] uppercase text-[#38bdf8]"
          style={{ textShadow: '0 0 8px rgba(56, 189, 248, 0.5)' }}
        >
          {dayData.dayTitle} // 24-HOUR STATISTIC
        </span>
        <span className="text-[10.5px] sm:text-[12px] font-bold tracking-wider text-white/90">
          {dayData.timeFormatted} TOTAL
        </span>
      </div>

      {/* 8 Columns: 24h Diurnal Categories */}
      <div
        className="w-full max-w-xl sm:max-w-2xl grid grid-cols-8 gap-1.5 sm:gap-2.5 items-end px-2"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {DIURNAL_CATEGORIES_24.map((cat, idx) => {
          const mins = dayData.phases[idx] || 0;
          const heightPct = mins > 0 ? Math.max(16, Math.round((mins / dayData.maxPhase) * 100)) : 6;
          const isPeak = idx === dayData.peakIdx && mins > 0;

          const barColor =
            mins === 0
              ? 'bg-transparent'
              : isPeak
              ? 'bg-[#38bdf8]'
              : dayData.isToday
              ? 'bg-white'
              : 'bg-[#64748b]';

          const textColor =
            mins === 0
              ? 'text-[#475569]'
              : isPeak
              ? 'text-[#38bdf8]'
              : dayData.isToday
              ? 'text-white'
              : 'text-[#94a3b8]';

          return (
            <div
              key={cat.id}
              className="flex flex-col items-center gap-1.5 cursor-default relative w-full"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              title={`${cat.name}: ${formatTime(mins)} (${cat.window24})`}
            >
              {/* Time count on top */}
              <span
                className={`text-[9px] sm:text-[10.5px] font-bold leading-none tracking-tight whitespace-nowrap transition-colors duration-150 ${textColor}`}
                style={{
                  fontFamily: "'Science Gothic', sans-serif",
                  textShadow: isPeak
                    ? '0 0 6px rgba(56, 189, 248, 0.6)'
                    : dayData.isToday
                    ? '0 0 6px rgba(255, 255, 255, 0.5)'
                    : 'none',
                }}
              >
                {formatTime(mins)}
              </span>

              {/* Monolith Bar */}
              <div
                className="w-3 sm:w-3.5 h-[68px] sm:h-[80px] bg-white/[0.05] flex items-end relative overflow-hidden"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              >
                <div
                  className={`w-full transition-all duration-300 ${barColor}`}
                  style={{
                    height: `${heightPct}%`,
                    boxShadow: isPeak
                      ? '0 0 8px rgba(56, 189, 248, 0.6)'
                      : dayData.isToday
                      ? '0 0 8px rgba(255, 255, 255, 0.6)'
                      : 'none',
                    borderRadius: 0,
                    outline: 'none',
                    border: 'none',
                  }}
                />
              </div>

              {/* Short Label & Window */}
              <div className="flex flex-col items-center text-center leading-none mt-1">
                <span
                  className={`text-[8.5px] sm:text-[9.5px] font-bold tracking-tight uppercase ${
                    isPeak ? 'text-[#38bdf8]' : 'text-white/80'
                  }`}
                  style={{ fontFamily: "'Science Gothic', sans-serif" }}
                >
                  {cat.shortName}
                </span>
                <span
                  className="text-[7.5px] sm:text-[8px] text-[#64748b] tracking-tighter whitespace-nowrap mt-0.5"
                  style={{ fontFamily: "'Science Gothic', sans-serif" }}
                >
                  {cat.shortWindow}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DiurnalPhase24hSummary;
