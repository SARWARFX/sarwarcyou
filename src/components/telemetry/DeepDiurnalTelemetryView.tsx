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

// 8 Diurnal Time Windows (with short window for mobile columns)
const DIURNAL_WINDOWS_24 = [
  { id: 'w1', window24: '00:00 – 04:00', shortWindow: '00-04' },
  { id: 'w2', window24: '04:00 – 06:00', shortWindow: '04-06' },
  { id: 'w3', window24: '06:00 – 09:00', shortWindow: '06-09' },
  { id: 'w4', window24: '09:00 – 12:00', shortWindow: '09-12' },
  { id: 'w5', window24: '12:00 – 15:00', shortWindow: '12-15' },
  { id: 'w6', window24: '15:00 – 18:00', shortWindow: '15-18' },
  { id: 'w7', window24: '18:00 – 20:00', shortWindow: '18-20' },
  { id: 'w8', window24: '20:00 – 24:00', shortWindow: '20-24' },
];

/**
 * Clean & Minimalist 24-Hour Diurnal Telemetry Modal
 * - Displays clicked day from mini graph
 * - Each column: Time count at top -> Pillar Bar -> Time-to-time at bottom
 * - Zero word labels, zero day switcher buttons, zero redundant close button (backdrop click & Esc close)
 * - Proportional bar height on mobile (95px), tablet (150px), and desktop (200px)
 * - All Science Gothic typography, zero rounded corners, zero outlines
 */
export const DeepDiurnalTelemetryView: React.FC<DeepDiurnalTelemetryViewProps> = ({
  onClose,
  initialDayIndex = 0,
}) => {
  const activeDayIndex = initialDayIndex ?? 0;
  const [isClosing, setIsClosing] = useState<boolean>(false);

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
      className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none cursor-pointer overflow-hidden ${
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
        className={`diurnal-modal-box w-full max-w-4xl max-h-[96dvh] bg-[#06080e]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col relative overflow-y-auto no-scrollbar cursor-default ${
          isClosing ? 'animate-holo-beam-close' : 'animate-holo-beam-open'
        }`}
        style={{
          borderRadius: 0,
          outline: 'none',
          border: 'none',
          fontFamily: "'Science Gothic', sans-serif",
        }}
      >
        {/* Sleek Minimalist Header: Day Title + Total Time (Zero close button, click outside to close) */}
        <div className="diurnal-header flex items-center justify-between w-full mb-3 sm:mb-5 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] sm:text-xs md:text-sm font-bold tracking-[0.14em] sm:tracking-[0.2em] uppercase text-[#38bdf8]"
              style={{
                fontFamily: "'Science Gothic', sans-serif",
                textShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
              }}
            >
              {activeDay?.dayFullName} // 24-HOUR DIURNAL BREAKDOWN
            </span>
          </div>

          <span
            className="text-[10px] sm:text-xs md:text-sm font-bold tracking-wider text-white/90 whitespace-nowrap"
            style={{ fontFamily: "'Science Gothic', sans-serif" }}
          >
            {formatTime(activeDay?.totalMins || 0)} TOTAL
          </span>
        </div>

        {/* 8 Columns: Time on top -> Pillar Bar -> Time-to-Time Window at Bottom */}
        <div className="diurnal-grid grid grid-cols-8 gap-1 sm:gap-2.5 md:gap-3.5 items-end w-full pb-0.5">
          {DIURNAL_WINDOWS_24.map((cat, idx) => {
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

            const bottomTextColor =
              mins === 0
                ? 'text-[#475569]'
                : isPeak
                ? 'text-[#38bdf8] font-bold'
                : activeDay?.isToday
                ? 'text-white/80 font-medium'
                : 'text-[#64748b] font-medium';

            return (
              <div
                key={cat.id}
                className="flex flex-col items-center gap-1 sm:gap-2 cursor-default p-0.5 transition-transform duration-200 hover:scale-[1.03]"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
                title={`${cat.window24}: ${formatTime(mins)}`}
              >
                {/* 1. Time Count At Top of the Bar */}
                <span
                  className={`text-[7.5px] sm:text-[9.5px] md:text-[11px] font-bold leading-none tracking-tight whitespace-nowrap transition-colors duration-150 ${textColor}`}
                  style={{ fontFamily: "'Science Gothic', sans-serif" }}
                >
                  {formatTime(mins)}
                </span>

                {/* 2. Vertical Pillar Bar (Responsive: 95px mobile, 150px tablet, 200px desktop) */}
                <div
                  className="diurnal-bar-container w-3 sm:w-4.5 md:w-6 bg-white/[0.04] flex items-end relative overflow-hidden"
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

                {/* 3. Time-to-Time Window at Bottom of the Bar (Clean 00-04 on mobile, 00:00 - 04:00 on sm+) */}
                <span
                  className={`text-[7px] sm:text-[8.5px] md:text-[9.5px] tracking-tight whitespace-nowrap leading-none ${bottomTextColor}`}
                  style={{ fontFamily: "'Science Gothic', sans-serif" }}
                >
                  <span className="sm:hidden">{cat.shortWindow}</span>
                  <span className="hidden sm:inline">{cat.window24}</span>
                </span>
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

        /* Proportional bar & container heights (Taller detailed graph for any screen) */
        .diurnal-bar-container {
          height: 135px;
        }

        .diurnal-modal-box {
          padding: 14px 16px;
        }

        @media (min-width: 640px) and (min-height: 521px) {
          .diurnal-bar-container {
            height: 200px;
          }
          .diurnal-modal-box {
            padding: 20px 26px;
          }
        }

        @media (min-width: 1024px) and (min-height: 701px) {
          .diurnal-bar-container {
            height: 265px;
          }
          .diurnal-modal-box {
            padding: 26px 34px;
          }
        }
      `}</style>
    </div>
  );
};

export default DeepDiurnalTelemetryView;
