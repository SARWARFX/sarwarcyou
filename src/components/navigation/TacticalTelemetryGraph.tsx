import React, { useState, useEffect, useMemo } from 'react';
import { getRolling7DayUsage, addSessionMinutes, getLocalDateKey } from '../../utils/usageTelemetry';

export interface DayTelemetryData {
  key: string;
  dayLetter: string;
  timeFormatted: string;
  minutes: number;
  heightPercent: number;
  isToday: boolean;
  isPeak: boolean;
}

// Fallback baseline telemetry when visitor is new / fresh session
const DEFAULT_BASELINE_MINUTES = [112, 48, 24, 75, 125, 38, 62]; // 1H 52M, 0H 48M, 0H 24M, 1H 15M, 2H 05M, 0H 38M, 1H 02M

export interface TacticalTelemetryGraphProps {
  onClick?: () => void;
  onSelectDay?: (dayIndex: number, dayData: DayTelemetryData) => void;
  selectedDayIndex?: number;
  className?: string;
  size?: 'normal' | 'large';
}

export const TacticalTelemetryGraph: React.FC<TacticalTelemetryGraphProps> = ({
  onClick,
  onSelectDay,
  selectedDayIndex,
  className = '',
  size = 'normal',
}) => {
  const [sessionTick, setSessionTick] = useState(0);

  // Periodically increment session time (1 minute intervals) and update state
  useEffect(() => {
    const timer = setInterval(() => {
      addSessionMinutes(1);
      setSessionTick((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const daysData: DayTelemetryData[] = useMemo(() => {
    // Generate 7 days: T (Today) at left (index 0), followed by Y (Yesterday) and past days
    const now = new Date();
    const usage = getRolling7DayUsage();
    const storedDays = usage.days || []; // Oldest (index 0) to Today (index 6)

    // Reverse so Today is at the far left (index 0), Y is index 1, etc.
    const reversed = [...storedDays].reverse();

    // Check if we have recorded minutes or should use baseline
    const totalRecorded = reversed.reduce((sum, d) => sum + (d?.minutes || 0), 0);
    const useBaseline = totalRecorded === 0;

    const rawList = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);

      let dayLetter = 'W';
      if (i === 0) dayLetter = 'T'; // Today
      else if (i === 1) dayLetter = 'Y'; // Yesterday
      else {
        // Single letter initial of day of week
        const dayInitial = d.toLocaleDateString('en-US', { weekday: 'short' })[0].toUpperCase();
        dayLetter = dayInitial;
      }

      const recordedMins = reversed[i]?.minutes || 0;
      const mins = useBaseline ? DEFAULT_BASELINE_MINUTES[i] || 30 : Math.max(recordedMins, 1);

      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      const timeFormatted = `${hrs}H ${String(remMins).padStart(2, '0')}M`;

      rawList.push({
        key: `day-${i}-${getLocalDateKey(d)}`,
        dayLetter,
        timeFormatted,
        minutes: mins,
        isToday: i === 0,
      });
    }

    const maxMinutes = Math.max(...rawList.map((d) => d.minutes), 1);

    return rawList.map((item) => ({
      ...item,
      heightPercent: Math.min(100, Math.max(18, Math.round((item.minutes / maxMinutes) * 100))),
      isPeak: item.minutes === maxMinutes,
    }));
  }, [sessionTick]);

  const isLarge = size === 'large';

  return (
    <aside
      aria-label="Daily screen time graph"
      onClick={!onSelectDay ? onClick : undefined}
      className={`flex items-end ${isLarge ? 'gap-3 sm:gap-4.5' : 'gap-2.5 sm:gap-3.5'} select-none bg-transparent ${
        onClick || onSelectDay ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''
      } ${className}`}
      title={onClick || onSelectDay ? 'Click any day to inspect 24-hour diurnal phase breakdown' : undefined}
      style={{
        borderRadius: 0,
        outline: 'none',
        border: 'none',
      }}
    >
      {daysData.map((day, idx) => {
        const isSelected = selectedDayIndex !== undefined && selectedDayIndex === idx;
        return (
          <div
            key={day.key}
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectDay) {
                onSelectDay(idx, day);
              } else if (onClick) {
                onClick();
              }
            }}
            className="group flex flex-col items-center gap-1.5 sm:gap-2 cursor-pointer relative"
            style={{
              borderRadius: 0,
              outline: 'none',
              border: 'none',
            }}
            title={`${day.isToday ? 'Today' : day.dayLetter}: ${day.timeFormatted} (Click to inspect 24h statistic)`}
          >
          {/* Row containing: [Rotated 90° Anti-Clockwise Time (Left)] + [Solid Pillar Bar (Right)] */}
          <div
            className={`flex items-end gap-1 sm:gap-1.5 ${
              isLarge ? 'h-[82px] sm:h-[92px]' : 'h-[62px] sm:h-[70px]'
            } relative`}
            style={{
              borderRadius: 0,
              outline: 'none',
              border: 'none',
            }}
          >
            {/* Rotated time text on the left side of the bar */}
            <div
              className={`${
                isLarge ? 'w-4 sm:w-5 h-[82px] sm:h-[92px]' : 'w-3.5 sm:w-4 h-[62px] sm:h-[70px]'
              } flex items-center justify-center relative pointer-events-none`}
              style={{
                borderRadius: 0,
                outline: 'none',
                border: 'none',
              }}
            >
              <span
                className={`font-firjar ${
                  isLarge ? 'text-[10px] sm:text-[11.5px]' : 'text-[9px] sm:text-[10px]'
                } font-bold tracking-tight whitespace-nowrap leading-none transition-colors duration-150 ${
                  day.isPeak
                    ? 'text-[#38bdf8]'
                    : day.isToday
                    ? 'text-white'
                    : 'text-[#94a3b8] group-hover:text-white'
                }`}
                style={{
                  fontFamily: "'Firjar', 'Science Gothic', sans-serif !important",
                  transform: 'rotate(-90deg)',
                  transformOrigin: 'center center',
                  textShadow: day.isPeak
                    ? '0 0 8px rgba(56, 189, 248, 0.6)'
                    : day.isToday
                    ? '0 0 8px rgba(255, 255, 255, 0.7)'
                    : 'none',
                  borderRadius: 0,
                  outline: 'none',
                  border: 'none',
                }}
              >
                {day.timeFormatted}
              </span>
            </div>

            {/* Solid vertical pillar bar on the right side of the text */}
            <div
              className={`${
                isLarge ? 'w-3 sm:w-3.5 h-[82px] sm:h-[92px]' : 'w-2.5 sm:w-[11px] h-[62px] sm:h-[70px]'
              } bg-white/[0.05] flex items-end relative overflow-hidden`}
              style={{
                borderRadius: 0,
                outline: 'none',
                border: 'none',
              }}
            >
              <div
                className={`w-full transition-all duration-300 ${
                  day.isPeak
                    ? 'bg-[#38bdf8]'
                    : day.isToday
                    ? 'bg-white'
                    : 'bg-[#64748b] group-hover:bg-[#94a3b8]'
                }`}
                style={{
                  height: `${day.heightPercent}%`,
                  boxShadow: day.isPeak
                    ? '0 0 8px rgba(56, 189, 248, 0.6)'
                    : day.isToday
                    ? '0 0 10px rgba(255, 255, 255, 0.75)'
                    : 'none',
                  borderRadius: 0,
                  outline: 'none',
                  border: 'none',
                }}
              />
            </div>
          </div>

          {/* Single-letter day initial at bottom (T, Y, S, S, F, T, W) */}
          <div className="flex flex-col items-center gap-0.5">
            <span
              className={`font-firjar ${
                isLarge ? 'text-[11.5px] sm:text-[13px]' : 'text-[10px] sm:text-[11px]'
              } font-bold transition-colors duration-150 ${
                isSelected
                  ? 'text-[#38bdf8] font-extrabold'
                  : day.isPeak
                  ? 'text-[#38bdf8] font-extrabold'
                  : day.isToday
                  ? 'text-white font-extrabold'
                  : 'text-[#64748b] group-hover:text-white'
              }`}
              style={{
                fontFamily: "'Firjar', 'Science Gothic', sans-serif !important",
                borderRadius: 0,
                outline: 'none',
                border: 'none',
              }}
            >
              {day.dayLetter}
            </span>
            {isSelected && (
              <span
                className={`${isLarge ? 'w-2 h-2' : 'w-1.5 h-1.5'} bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]`}
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              />
            )}
          </div>
        </div>
      );
    })}
    </aside>
  );
};

export default TacticalTelemetryGraph;
