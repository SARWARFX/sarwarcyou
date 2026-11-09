import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'sarwar_daily_ledger_v1';

interface DayStat {
  dateKey: string;      // YYYY-MM-DD
  label: string;        // "TODAY", "YESTERDAY", or "NOV 07"
  hoursFormatted: string; // e.g. "1.25", "0.45"
  minutes: number;
  isToday: boolean;
  isYesterday: boolean;
}

export interface SessionTelemetryGraphProps {
  className?: string;
  variant?: 'compact' | 'dock' | 'mobile';
}

export const SessionTelemetryGraph: React.FC<SessionTelemetryGraphProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const [dayStats, setDayStats] = useState<DayStat[]>([]);

  useEffect(() => {
    // 1. Helper to format a Date into YYYY-MM-DD
    const toDateKey = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 2. Helper to format minutes as H.MM (e.g. 1.25 for 1 hr 15 mins)
    const formatDuration = (totalMinutes: number): string => {
      if (totalMinutes <= 0) return '0.00';
      const hours = Math.floor(totalMinutes / 60);
      const mins = Math.floor(totalMinutes % 60);
      return `${hours}.${mins.toString().padStart(2, '0')}`;
    };

    // 3. Read ledger from localStorage safely
    const readLedger = (): Record<string, number> => {
      if (typeof window === 'undefined') return {};
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
      } catch {
        return {};
      }
    };

    // 4. Write ledger
    const saveLedger = (ledger: Record<string, number>) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
      } catch {
        // ignore storage quota errors
      }
    };

    // Build the reverse-chronological active days ledger (Today first, then Yesterday, then older)
    const computeStats = () => {
      const ledger = readLedger();
      const now = new Date();
      const todayKey = toDateKey(now);

      // Ensure current active session for TODAY has at least an initial activity tick on mount
      if (!ledger[todayKey] || ledger[todayKey] <= 0) {
        ledger[todayKey] = 0.2; // 12 seconds initial session
        saveLedger(ledger);
      }

      const rawTelemetryDays: DayStat[] = [];

      // Scan up to the last 14 days to collect up to 7 active non-zero session days
      for (let i = 0; i < 14; i++) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() - i);
        const key = toDateKey(targetDate);
        const isToday = i === 0;
        const isYesterday = i === 1;

        const minutes = ledger[key] || 0;

        let label = '';
        if (isToday) {
          label = 'TODAY';
        } else if (isYesterday) {
          label = 'YESTERDAY';
        } else {
          label = targetDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
        }

        rawTelemetryDays.push({
          dateKey: key,
          label,
          hoursFormatted: formatDuration(minutes),
          minutes,
          isToday,
          isYesterday,
        });
      }

      // 1. Sort reverse-chronologically (newest first: Today -> Yesterday -> Older)
      // (Already generated in reverse chronological order i=0..13)
      // 2. Filter out zero-data entries strictly (duration / minutes > 0)
      const activeLedger = rawTelemetryDays
        .filter((day) => day.minutes > 0)
        .slice(0, 7);

      setDayStats(activeLedger);
    };

    computeStats();

    // 5. Active live elapsed session minutes tracker for Today
    let lastTick = Date.now();
    const interval = setInterval(() => {
      const currentTick = Date.now();
      const deltaMinutes = (currentTick - lastTick) / 60000;
      lastTick = currentTick;

      const ledger = readLedger();
      const todayKey = toDateKey(new Date());
      ledger[todayKey] = (ledger[todayKey] || 0) + deltaMinutes;
      saveLedger(ledger);

      computeStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Calculate highest minute value to scale graph bars
  const maxMinutes = Math.max(15, ...dayStats.map((d) => d.minutes));

  // If no active data exists at all
  if (dayStats.length === 0) {
    return null;
  }

  // =========================================================================
  // 1. DESKTOP DOCK VARIANT (LOCKED HOME SCREEN BOTTOM)
  // =========================================================================
  if (variant === 'dock') {
    return (
      <div className={`w-full flex flex-col justify-end flex-shrink-0 select-none ${className}`}>
        {/* Track: Active pillars distributed evenly across full dock width */}
        <div className="w-full flex justify-between items-end gap-1.5 sm:gap-2 h-[76px]">
          {dayStats.map((day) => {
            const heightPct = Math.max(day.minutes > 0 ? (day.minutes / maxMinutes) * 100 : 8, 8);

            return (
              <div key={day.dateKey} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group">
                {/* Time readout on top: Today's readout is cyan font-bold, others slate */}
                <span
                  className={`font-mono text-[10px] sm:text-[11px] transition-colors leading-none ${
                    day.isToday
                      ? 'text-[#38bdf8] font-bold drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                      : 'text-[#475569] group-hover:text-slate-300'
                  }`}
                >
                  {day.hoursFormatted}
                </span>

                {/* Slot container */}
                <div className="h-[46px] w-full max-w-[32px] sm:max-w-[36px] bg-white/[0.03] rounded flex items-end overflow-hidden my-0.5">
                  {/* Bar: Today is cyan glow gradient, others clean silver/slate gradient */}
                  <div
                    style={{
                      height: `${heightPct}%`,
                      background: day.isToday
                        ? 'linear-gradient(to top, #0284c7, #38bdf8)'
                        : 'linear-gradient(to top, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.45))',
                    }}
                    className={`w-full rounded-t-sm transition-all duration-500 ease-out ${
                      day.isToday ? 'shadow-[0_0_12px_rgba(56,189,248,0.5)]' : ''
                    }`}
                  />
                </div>

                {/* Date label below */}
                <span
                  className={`font-mono text-[8px] sm:text-[9px] uppercase tracking-wider text-center truncate w-full leading-none mt-0.5 ${
                    day.isToday
                      ? 'text-[#38bdf8] font-semibold'
                      : 'text-[#475569] group-hover:text-slate-400'
                  }`}
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. MOBILE VARIANT (SCREEN 1 BOTTOM DOCK)
  // =========================================================================
  if (variant === 'mobile') {
    return (
      <div className={`w-full flex justify-between items-end gap-2 md:gap-4 h-[82px] ${className}`}>
        {dayStats.map((day) => {
          const heightPct = Math.max(day.minutes > 0 ? (day.minutes / maxMinutes) * 100 : 8, 8);

          return (
            <div key={day.dateKey} className="flex-1 flex flex-col items-center justify-end h-full group">
              {/* Top: Duration readout */}
              <span
                className={`font-mono text-[10px] transition-colors ${
                  day.isToday
                    ? 'text-[#38bdf8] font-bold drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                    : 'text-slate-400 group-hover:text-white'
                }`}
              >
                {day.hoursFormatted}
              </span>

              {/* Middle: Slot & Bar -> height ~42px, w-full rounded */}
              <div className="h-[42px] w-full max-w-[36px] bg-white/[0.03] rounded flex items-end overflow-hidden my-0.5">
                <div
                  style={{
                    height: `${heightPct}%`,
                    background: day.isToday
                      ? 'linear-gradient(to top, #0284c7, #38bdf8)'
                      : 'linear-gradient(to top, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.45))',
                  }}
                  className={`w-full rounded-t-sm transition-all duration-500 ease-out ${
                    day.isToday ? 'shadow-[0_0_12px_rgba(56,189,248,0.5)]' : ''
                  }`}
                />
              </div>

              {/* Bottom: Date label (e.g. "TODAY", "YESTERDAY", "NOV 07") */}
              <span
                className={`font-mono text-[9px] tracking-wider uppercase mt-1.5 block whitespace-nowrap text-center ${
                  day.isToday
                    ? 'text-[#38bdf8] font-bold'
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // =========================================================================
  // 3. COMPACT / DEFAULT VARIANT
  // =========================================================================
  return (
    <div className={`w-full h-full flex items-end select-none bg-transparent border-none p-0 shrink-0 ${className}`}>
      <div className="w-full flex justify-between items-end gap-2 md:gap-4 h-full pb-0.5">
        {dayStats.map((day) => {
          const heightPct = Math.max(day.minutes > 0 ? (day.minutes / maxMinutes) * 100 : 8, 8);

          return (
            <div key={day.dateKey} className="flex-1 flex flex-col items-center h-full justify-end group">
              {/* Tip: Duration in H.MM */}
              <span
                className={`font-mono text-[7px] xs:text-[8px] sm:text-[10px] mb-0.5 sm:mb-1 transition-all ${
                  day.isToday
                    ? 'text-[#38bdf8] font-bold drop-shadow-[0_0_8px_rgba(56,189,248,0.7)] scale-105'
                    : 'text-slate-400 group-hover:text-white'
                }`}
              >
                {day.hoursFormatted}
              </span>

              {/* Monolith Pillar Bar */}
              <div className="w-full max-w-[16px] xs:max-w-[20px] sm:max-w-[30px] md:max-w-[36px] h-6 xs:h-7 sm:h-9 md:h-11 flex items-end justify-center">
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t-sm transition-all duration-500 ease-out ${
                    day.isToday
                      ? 'bg-gradient-to-t from-[#0284c7] to-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                      : 'bg-white/15 group-hover:bg-white/30 group-hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                  }`}
                />
              </div>

              {/* Bottom: Date Label */}
              <span
                className={`mt-0.5 sm:mt-1 font-['Roboto_Condensed'] font-sans text-[6px] xs:text-[7px] sm:text-[8px] md:text-[9px] tracking-wider uppercase text-center truncate w-full ${
                  day.isToday
                    ? 'text-[#38bdf8] font-bold drop-shadow-[0_0_6px_rgba(56,189,248,0.4)]'
                    : 'text-slate-500 group-hover:text-slate-300'
                }`}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SessionTelemetryGraph;
