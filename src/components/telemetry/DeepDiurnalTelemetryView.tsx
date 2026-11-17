import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getRolling7DayUsage,
  getDiurnalPhasesForDay,
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

// 8 Diurnal Categories with 24-hour time format
interface DiurnalCategory24 {
  id: string;
  name: string;
  window24: string;
}

const DIURNAL_CATEGORIES_24: DiurnalCategory24[] = [
  { id: 'midnight', name: 'MIDNIGHT', window24: '00:00 – 04:00' },
  { id: 'dawn', name: 'DAWN', window24: '04:00 – 06:00' },
  { id: 'early_morning', name: 'EARLY MORNING', window24: '06:00 – 09:00' },
  { id: 'morning', name: 'MORNING', window24: '09:00 – 12:00' },
  { id: 'noon', name: 'NOON', window24: '12:00 – 15:00' },
  { id: 'afternoon', name: 'AFTERNOON', window24: '15:00 – 18:00' },
  { id: 'evening', name: 'EVENING', window24: '18:00 – 20:00' },
  { id: 'early_night', name: 'EARLY NIGHT', window24: '20:00 – 24:00' },
];

/**
 * Distraction-Free Telemetry Modal
 * - Screen 1: Pure enlarged 7-day graph with time on top, day name below, close button at top-right
 * - Screen 2: Pure 8-diurnal categories graph with time on top, 24h format below, back at top-left, close at top-right
 * - Rendered in a semi-transparent floating window over the page
 */
export const DeepDiurnalTelemetryView: React.FC<DeepDiurnalTelemetryViewProps> = ({ onClose }) => {
  // null = Screen 1 (7-Day Graph); number = Screen 2 (Clicked Day's 8 Categories)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [screenTransition, setScreenTransition] = useState<{
    phase: 'idle' | 'exiting_to_screen2' | 'entering_screen2' | 'exiting_to_screen1' | 'entering_screen1';
  }>({ phase: 'idle' });

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    hapticMedium();
    setTimeout(() => {
      onClose();
    }, 240);
  }, [isClosing, onClose]);

  const handleSelectDay = useCallback((idx: number) => {
    if (screenTransition.phase !== 'idle') return;
    hapticMedium();
    setScreenTransition({ phase: 'exiting_to_screen2' });
    setTimeout(() => {
      setSelectedDayIdx(idx);
      setScreenTransition({ phase: 'entering_screen2' });
      setTimeout(() => {
        setScreenTransition({ phase: 'idle' });
      }, 260);
    }, 200);
  }, [screenTransition.phase]);

  const handleBack = useCallback(() => {
    if (screenTransition.phase !== 'idle') return;
    hapticMedium();
    setScreenTransition({ phase: 'exiting_to_screen1' });
    setTimeout(() => {
      setSelectedDayIdx(null);
      setScreenTransition({ phase: 'entering_screen1' });
      setTimeout(() => {
        setScreenTransition({ phase: 'idle' });
      }, 260);
    }, 200);
  }, [screenTransition.phase]);

  // Keyboard shortcut: ESC returns to Screen 1 or closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedDayIdx !== null) {
          handleBack();
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDayIdx, handleBack, handleClose]);

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
      let dayFullName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      if (i === 0) {
        dayLetter = 'T';
        dayFullName = 'TODAY';
      } else if (i === 1) {
        dayLetter = 'Y';
        dayFullName = 'YESTERDAY';
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

  const activeDay = selectedDayIdx !== null ? sevenDays[selectedDayIdx] : null;
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
      className={`fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none ${
        isClosing ? 'animate-holo-backdrop-out' : 'animate-holo-backdrop-in'
      }`}
      style={{
        borderRadius: 0,
        outline: 'none',
        border: 'none',
        WebkitBackdropFilter: 'blur(16px)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div
        className={`w-full max-w-4xl bg-[#06080e]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col p-6 sm:p-10 relative overflow-hidden ${
          isClosing ? 'animate-holo-beam-close' : 'animate-holo-beam-open'
        }`}
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {/* ============================================================ */}
        {/* SCREEN 1: ONLY THE ENLARGED 7-DAY GRAPH (First Screenshot)   */}
        {/* ============================================================ */}
        {selectedDayIdx === null ? (
          <div
            className={`flex flex-col relative w-full ${
              screenTransition.phase === 'exiting_to_screen2'
                ? 'animate-holo-drill-exit'
                : screenTransition.phase === 'entering_screen1'
                ? 'animate-holo-drill-enter'
                : ''
            }`}
          >
            {/* Top Right Corner: Close Button */}
            <div className="flex justify-end w-full mb-6 sm:mb-8">
              <button
                type="button"
                onClick={handleClose}
                className="text-white/70 hover:text-white transition-colors cursor-pointer p-1 bg-transparent border-0"
                style={{ borderRadius: 0, outline: 'none' }}
                title="Close (Esc)"
              >
                <LaserCloseIcon size={24} />
              </button>
            </div>

            {/* 7 Columns: Time on top -> Monolith Bar -> Day Name at Bottom */}
            <div className="grid grid-cols-7 gap-2 sm:gap-6 items-end w-full pb-4">
              {sevenDays.map((day, idx) => (
                <div
                  key={day.key}
                  onClick={() => handleSelectDay(idx)}
                  className="group flex flex-col items-center gap-2.5 sm:gap-3 cursor-pointer p-1 sm:p-2 transition-transform duration-200 hover:scale-[1.03]"
                  style={{ borderRadius: 0, outline: 'none' }}
                  title={`Click to inspect ${day.dayFullName} (${day.timeFormatted})`}
                >
                  {/* Time Count At Top of the Bar */}
                  <span
                    className={`text-[10px] sm:text-xs font-bold leading-none tracking-tight whitespace-nowrap transition-colors duration-150 ${
                      day.isPeak
                        ? 'text-[#38bdf8]'
                        : day.isToday
                        ? 'text-white'
                        : 'text-[#94a3b8] group-hover:text-white'
                    }`}
                    style={{
                      fontFamily: "'Ubuntu', sans-serif",
                      textShadow: day.isPeak
                        ? '0 0 10px rgba(56, 189, 248, 0.7)'
                        : day.isToday
                        ? '0 0 10px rgba(255, 255, 255, 0.8)'
                        : 'none',
                    }}
                  >
                    {day.timeFormatted}
                  </span>

                  {/* Tall Vertical Monolith Bar */}
                  <div
                    className="w-5 sm:w-7 md:w-8 h-[240px] sm:h-[300px] bg-white/[0.05] flex items-end relative overflow-hidden"
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

                  {/* Day Initial + Full Day Name Underneath */}
                  <div className="flex flex-col items-center gap-1">
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
                    <span
                      className={`text-[9px] sm:text-[10px] font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
                        day.isPeak
                          ? 'text-[#38bdf8]'
                          : day.isToday
                          ? 'text-white'
                          : 'text-[#64748b] group-hover:text-white'
                      }`}
                      style={{ fontFamily: "'Ubuntu', sans-serif" }}
                    >
                      {day.dayFullName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* SCREEN 2: ONLY THE 8 DIURNAL CATEGORIES (Second Screenshot)  */
          /* ============================================================ */
          <div
            className={`flex flex-col relative w-full ${
              screenTransition.phase === 'exiting_to_screen1'
                ? 'animate-holo-drill-exit'
                : screenTransition.phase === 'entering_screen2'
                ? 'animate-holo-drill-enter'
                : ''
            }`}
          >
            {/* Top Bar: Back Button (Left) and Close Button (Right) */}
            <div className="flex items-center justify-between w-full mb-6 sm:mb-8">
              <button
                type="button"
                onClick={handleBack}
                className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.12] text-xs font-bold tracking-wider uppercase text-white hover:bg-[#38bdf8] hover:text-black hover:border-[#38bdf8] transition-all cursor-pointer flex items-center gap-2"
                style={{ borderRadius: 0, outline: 'none' }}
                title="Back to 7-Day Graph"
              >
                <span>←</span>
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="text-white/70 hover:text-white transition-colors cursor-pointer p-1 bg-transparent border-0"
                style={{ borderRadius: 0, outline: 'none' }}
                title="Close (Esc)"
              >
                <LaserCloseIcon size={24} />
              </button>
            </div>

            {/* 8 Columns: Time on top -> Monolith Bar -> Category Name & 24h Window Below */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3.5 items-end w-full pb-4">
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
                    className="flex flex-col items-center gap-2.5 sm:gap-3 cursor-default p-1 transition-transform duration-200 hover:scale-[1.03]"
                    style={{ borderRadius: 0 }}
                    title={`${cat.name}: ${formatTime(mins)} (${cat.window24})`}
                  >
                    {/* Time Count At Top of the Bar */}
                    <span
                      className={`text-[9.5px] sm:text-[11px] font-bold leading-none tracking-tight whitespace-nowrap transition-colors duration-150 ${textColor}`}
                      style={{ fontFamily: "'Ubuntu', sans-serif" }}
                    >
                      {formatTime(mins)}
                    </span>

                    {/* Tall Vertical Monolith Bar */}
                    <div
                      className="w-4 sm:w-5 md:w-6 h-[220px] sm:h-[280px] bg-white/[0.04] flex items-end relative overflow-hidden"
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

                    {/* Category Name & 24h Window Underneath */}
                    <div className="flex flex-col items-center text-center gap-1 w-full">
                      <span
                        className={`text-[9.5px] sm:text-[10.5px] font-bold tracking-wider uppercase leading-tight ${
                          isPeak ? 'text-[#38bdf8]' : 'text-white'
                        }`}
                        style={{ fontFamily: "'Ubuntu', sans-serif" }}
                      >
                        {cat.name}
                      </span>
                      <span
                        className="text-[8px] sm:text-[9px] font-medium text-[#64748b] tracking-tight whitespace-nowrap"
                        style={{ fontFamily: "'Ubuntu', sans-serif" }}
                      >
                        {cat.window24}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
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
            transform: scale(0, 0.005);
            filter: brightness(4);
          }
        }

        @keyframes holoBackdropIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes holoBackdropOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes holoDrillExit {
          0% { opacity: 1; }
          50% { opacity: 0.5; filter: invert(0.5); transform: translateY(-4px); }
          100% { opacity: 0; transform: translateY(-10px); }
        }

        @keyframes holoDrillEnter {
          0% { opacity: 0; transform: translateY(15px); filter: contrast(1.5) drop-shadow(0 0 10px #00f2fe); }
          100% { opacity: 1; transform: translateY(0); filter: contrast(1); }
        }

        .animate-holo-beam-open {
          animation: holoBeamModalOpen 0.34s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-holo-beam-close {
          animation: holoBeamModalClose 0.24s ease forwards;
        }

        .animate-holo-backdrop-in {
          animation: holoBackdropIn 0.3s ease forwards;
        }

        .animate-holo-backdrop-out {
          animation: holoBackdropOut 0.24s ease forwards;
        }

        .animate-holo-drill-exit {
          animation: holoDrillExit 0.2s steps(3) forwards;
        }

        .animate-holo-drill-enter {
          animation: holoDrillEnter 0.26s ease forwards;
        }
      `}</style>
    </div>
  );
};

export default DeepDiurnalTelemetryView;
