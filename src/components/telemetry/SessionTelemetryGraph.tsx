import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'sarwar_daily_ledger_v1';

interface DayStat {
  dateKey: string;      // YYYY-MM-DD
  label: string;        // e.g., "NOV 02", "TODAY"
  hoursFormatted: string; // e.g. "1.25", "0.45", "0.00"
  minutes: number;
  isToday: boolean;
}

export const SessionTelemetryGraph: React.FC<{ className?: string }> = ({ className = '' }) => {
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

    // Build the 7 chronological days
    const computeStats = () => {
      const ledger = readLedger();
      const now = new Date();
      const stats: DayStat[] = [];

      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() - i);
        const key = toDateKey(targetDate);
        const isToday = i === 0;

        const minutes = ledger[key] || 0;

        let label = '';
        if (isToday) {
          label = 'TODAY';
        } else {
          label = targetDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
        }

        stats.push({
          dateKey: key,
          label,
          hoursFormatted: formatDuration(minutes),
          minutes,
          isToday,
        });
      }

      setDayStats(stats);
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

  return (
    <div className={`w-full h-full flex items-end select-none bg-transparent border-none p-0 shrink-0 ${className}`}>
      {/* 7-Day Monolith Historical Bar Track without outer containers or header text */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-3 w-full h-full items-end pb-0.5">
        {dayStats.map((day) => {
          // Height percentage with minimum 4% baseline tick for 0 values
          const heightPct = Math.max(day.minutes > 0 ? (day.minutes / maxMinutes) * 100 : 4, 4);

          return (
            <div key={day.dateKey} className="flex flex-col items-center h-full justify-end group">
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
                      : day.minutes > 0
                      ? 'bg-white/15 group-hover:bg-white/30 group-hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                      : 'bg-white/10 group-hover:bg-white/20'
                  }`}
                />
              </div>

              {/* Bottom: Date Label */}
              <span
                className={`mt-0.5 sm:mt-1 font-['Google_Sans'] text-[6px] xs:text-[7px] sm:text-[8px] md:text-[9px] tracking-wider uppercase text-center truncate w-full ${
                  day.isToday
                    ? 'text-white font-bold drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]'
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
