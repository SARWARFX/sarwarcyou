import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getRolling7DayUsage,
  getDiurnalPhasesForDay,
  getLocalDateKey,
} from '../../utils/usageTelemetry';
import { hapticMedium } from '../../utils/hapticsManager';

export interface DeepDiurnalTelemetryViewProps {
  onClose: () => void;
  initialDayIndex?: number | null;
}

const DEFAULT_BASELINE_MINUTES = [112, 48, 24, 75, 125, 38, 62];

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}H ${String(m).padStart(2, '0')}M`;
}

// 8 Diurnal Categories with 24-hour time format
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

/**
 * Distraction-Free 24-Hour Diurnal Telemetry Modal
 * - Supports landscape phones, tablets, and desktop displays
 * - Dynamic height scaling on rotated phone screens to eliminate clipping
 * - Direct 7-day quick switcher tabs right inside the modal
 * - Dedicated Cyber Close Button with Esc & backdrop-tap support
 * - All Science Gothic typography, zero rounded corners, zero outlines
 */
export const DeepDiurnalTelemetryView: React.FC<DeepDiurnalTelemetryViewProps> = ({
  onClose,
  initialDayIndex = 0,
}) => {
  const [activeDayIndex, setActiveDayIndex] = useState<number>(initialDayIndex ?? 0);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  useEffect(() => {
    if (initialDayIndex !== undefined && initialDayIndex !== null) {
      setActiveDayIndex(initialDayIndex);
    }
  }, [initialDayIndex]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    hapticMedium();
    setTimeout(() => {
      onClose();
    }, 240);
  }, [isClosing, onClose]);

  // Keyboard shortcut: ESC closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

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
      const iso = getLocalDateKey(d);

      let dayLetter = 'W';
      let dayFullName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      if (i === 0) {
        dayLetter = 'T';
        dayFullName = 'TODAY';
      } else if (i === 1) {
        dayLetter = 'Y';
        dayFullName = 'YESTERDAY';
      } else {
        dayLetter = d.toLocaleDateString('en-US', { weekday: 'short' })[0].toUpperCase();
        dayFullName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      }

      const recordedMins = reversed[i]?.minutes || 0;
      const mins = useBaseline ? DEFAULT_BASELINE_MINUTES[i] || 30 : Math.max(recordedMins, 1);
      const phases = getDiurnalPhasesForDay(iso, mins);
      const timeFormatted = formatTime(mins);

      list.push({
        key: `day-${i}-${iso}`,
        iso,
        dayLetter,
        dayFullName,
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

  const activeDay = sevenDays[activeDayIndex] || sevenDays[0];
  const maxPhaseMins = activeDay ? Math.max(...activeDay.phasesMins, 1) : 1;

  let peakCategoryIdx = 0;
  let peakCategoryVal = 0;
  if (activeDay) {
    activeDay.phasesMins.forEach((m, idx) => {
      if (m > peakCategoryVal) {
        peakCategoryVal = m;
        peakCategoryIdx = idx;
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 select-none cursor-pointer overflow-hidden ${
        isClosing ? 'animate-holo-backdrop-out' : 'animate-holo-backdrop-in'
      }`}
      style={{
        borderRadius: 0,
        outline: 'none',
        border: 'none',
        WebkitBackdropFilter: 'blur(16px)',
        backdropFilter: 'blur(16px)',
      }}
      title="Click outside graph to close"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`diurnal-modal-box w-full max-w-4xl max-h-[96dvh] bg-[#06080e]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col p-3 sm:p-6 md:p-8 relative overflow-y-auto no-scrollbar cursor-default ${
          isClosing ? 'animate-holo-beam-close' : 'animate-holo-beam-open'
        }`}
        style={{
          borderRadius: 0,
          outline: 'none',
          border: 'none',
          fontFamily: "'Science Gothic', sans-serif",
        }}
      >
        {/* Sleek Cyber Header: Day Title + 7-Day Quick-Switcher + Total Time + Cyber Close Button */}
        <div className="diurnal-header flex flex-col gap-2 sm:gap-2.5 w-full mb-3 sm:mb-5 shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] sm:text-xs md:text-sm font-bold tracking-[0.16em] sm:tracking-[0.2em] uppercase text-[#38bdf8]"
                style={{
                  fontFamily: "'Science Gothic', sans-serif",
                  textShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
                }}
              >
                {activeDay?.dayFullName} // 24-HOUR DIURNAL BREAKDOWN
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span
                className="text-[10px] sm:text-xs md:text-sm font-bold tracking-wider text-white/90 whitespace-nowrap"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                {formatTime(activeDay?.totalMins || 0)} TOTAL
              </span>

              {/* Dedicated Square Cyber Close Button */}
              <button
                type="button"
                onClick={handleClose}
                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-white/[0.06] hover:bg-[#38bdf8]/20 border border-white/20 hover:border-[#38bdf8] text-white/70 hover:text-[#38bdf8] transition-colors cursor-pointer shrink-0"
                style={{ borderRadius: 0, outline: 'none' }}
                title="Close (Esc)"
                aria-label="Close telemetry modal"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="square"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* 7-Day Quick-Selector Strip */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {sevenDays.map((d, idx) => {
              const isSelected = idx === activeDayIndex;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setActiveDayIndex(idx);
                  }}
                  className={`px-2 py-0.5 sm:py-1 text-[8.5px] sm:text-[9.5px] md:text-[10.5px] font-bold tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-[#38bdf8] text-black shadow-[0_0_10px_rgba(56,189,248,0.6)] font-black'
                      : 'bg-white/[0.05] text-[#94a3b8] hover:text-white hover:bg-white/[0.1] border border-white/[0.08]'
                  }`}
                  style={{ borderRadius: 0, outline: 'none' }}
                >
                  {d.dayFullName.slice(0, 3)} <span className="text-[7.5px] sm:text-[8.5px] opacity-80">({d.timeFormatted})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 8 Columns: Time on top -> Monolith Bar -> Category Name & 24h Window Below */}
        <div className="diurnal-grid grid grid-cols-4 sm:grid-cols-8 gap-1.5 sm:gap-3 items-end w-full pb-1">
          {DIURNAL_CATEGORIES_24.map((cat, idx) => {
            const mins = activeDay?.phasesMins[idx] || 0;
            const heightPct =
              mins > 0 ? Math.max(16, Math.round((mins / maxPhaseMins) * 100)) : 6;
            const isPeak = idx === peakCategoryIdx && mins > 0;

            const barColor =
              mins === 0
                ? 'bg-white/[0.06]'
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
                key={cat.id}
                className="flex flex-col items-center gap-1 sm:gap-2 cursor-default p-0.5 sm:p-1 transition-transform duration-200 hover:scale-[1.03]"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
                title={`${cat.name}: ${formatTime(mins)} (${cat.window24})`}
              >
                {/* Time Count At Top of the Bar */}
                <span
                  className={`text-[8px] sm:text-[9.5px] md:text-[11px] font-bold leading-none tracking-tight whitespace-nowrap transition-colors duration-150 ${textColor}`}
                  style={{ fontFamily: "'Science Gothic', sans-serif" }}
                >
                  {formatTime(mins)}
                </span>

                {/* Vertical Monolith Bar (Responsive Height via media queries) */}
                <div
                  className="diurnal-bar-container w-3 sm:w-4 md:w-5.5 bg-white/[0.04] flex items-end relative overflow-hidden"
                  style={{ borderRadius: 0, outline: 'none', border: 'none' }}
                >
                  <div
                    className={`w-full transition-all duration-300 ${barColor}`}
                    style={{
                      height: `${heightPct}%`,
                      borderRadius: 0,
                      outline: 'none',
                      border: 'none',
                    }}
                  />
                </div>

                {/* Category Name & 24h Window Underneath */}
                <div className="flex flex-col items-center text-center gap-0.5 sm:gap-1 w-full">
                  <span
                    className={`text-[8px] sm:text-[9px] md:text-[10px] font-bold tracking-wider uppercase leading-tight ${
                      isPeak ? 'text-[#38bdf8]' : 'text-white'
                    }`}
                    style={{ fontFamily: "'Science Gothic', sans-serif" }}
                  >
                    {cat.name}
                  </span>
                  <span
                    className="text-[6.5px] sm:text-[7.5px] md:text-[8.5px] font-medium text-[#64748b] tracking-tight whitespace-nowrap"
                    style={{ fontFamily: "'Science Gothic', sans-serif" }}
                  >
                    {cat.window24}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes holoBeamModalOpen {
          0% {
            opacity: 0;
            transform: scale(1, 0.005);
            filter: brightness(3) drop-shadow(0 0 24px rgba(0, 242, 254, 0.9));
          }
          40% {
            opacity: 1;
            transform: scale(1, 0.005);
          }
          100% {
            opacity: 1;
            transform: scale(1, 1);
            filter: brightness(1) drop-shadow(0 0 0px transparent);
          }
        }

        @keyframes holoBeamModalClose {
          0% {
            opacity: 1;
            transform: scale(1, 1);
            filter: brightness(1);
          }
          60% {
            opacity: 1;
            transform: scale(1, 0.005);
            filter: brightness(3) drop-shadow(0 0 24px rgba(0, 242, 254, 0.9));
          }
          100% {
            opacity: 0;
            transform: scale(1, 0.005);
            filter: brightness(3) drop-shadow(0 0 24px rgba(0, 242, 254, 0.9));
          }
        }

        .animate-holo-backdrop-in {
          animation: fadeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-holo-backdrop-out {
          animation: fadeOut 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-holo-beam-open {
          animation: holoBeamModalOpen 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-holo-beam-close {
          animation: holoBeamModalClose 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Responsive bar & container heights */
        .diurnal-bar-container {
          height: 240px;
        }

        @media (max-height: 520px) {
          .diurnal-bar-container {
            height: 90px !important;
          }
          .diurnal-modal-box {
            padding: 8px 12px !important;
          }
          .diurnal-header {
            margin-bottom: 4px !important;
            gap: 4px !important;
          }
        }

        @media (orientation: landscape) and (max-height: 520px) {
          .diurnal-grid {
            grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
          }
        }

        @media (min-height: 521px) and (max-height: 700px) {
          .diurnal-bar-container {
            height: 150px !important;
          }
          .diurnal-modal-box {
            padding: 16px 20px !important;
          }
          .diurnal-header {
            margin-bottom: 12px !important;
          }
        }

        @media (min-height: 701px) {
          .diurnal-bar-container {
            height: 240px;
          }
        }
      `}</style>
    </div>
  );
};

export default DeepDiurnalTelemetryView;
