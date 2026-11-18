import React, { useState, useEffect, useCallback } from 'react';
import {
  initBatteryMonitor,
  subscribeBatteryNotification,
  subscribeBatteryState,
  subscribeUnsupportedBatteryReminder,
} from '../../utils/batteryManager';
import type { BatteryMilestone } from '../../utils/batteryManager';

interface ActiveToast {
  id: number;
  type: 'milestone' | 'unsupported';
  milestone?: BatteryMilestone;
  level?: number;
}

export const BatteryStatusDialog: React.FC = () => {
  const [activeToast, setActiveToast] = useState<ActiveToast | null>(null);

  // Initialize hardware monitoring on mount
  useEffect(() => {
    initBatteryMonitor();

    // Listen to threshold milestone breaches
    const unsubNotify = subscribeBatteryNotification((milestone, state) => {
      setActiveToast({
        id: Date.now(),
        type: 'milestone',
        milestone,
        level: state.level,
      });
    });

    // Listen to 3-hour battery reminder for unsupported devices
    const unsubUnsupported = subscribeUnsupportedBatteryReminder(() => {
      setActiveToast({
        id: Date.now(),
        type: 'unsupported',
      });
    });

    // Dismiss active battery toast if device is plugged into AC power
    const unsubState = subscribeBatteryState((state) => {
      if (state.charging) {
        setActiveToast(null);
      }
    });

    return () => {
      unsubNotify();
      unsubUnsupported();
      unsubState();
    };
  }, []);

  // Auto-dismiss non-critical alerts after timeout
  useEffect(() => {
    if (!activeToast) return;
    if (activeToast.type === 'unsupported' || (activeToast.milestone && activeToast.milestone >= 15)) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, activeToast.type === 'unsupported' ? 8000 : 6000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const handleDismiss = useCallback(() => {
    setActiveToast(null);
  }, []);

  if (!activeToast) return null;

  if (activeToast.type === 'unsupported') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[10002] max-w-sm w-[calc(100vw-2rem)] select-none pointer-events-auto"
        style={{ borderRadius: 0, outline: 'none' }}
      >
        <div
          className="relative w-full bg-[#090c12] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.95)] border border-white/10 text-white flex flex-col gap-3 animate-fade-in"
          style={{ borderRadius: 0, outline: 'none' }}
        >
          <h3
            className="text-xs sm:text-sm font-bold font-mono tracking-tight uppercase flex items-center gap-2 text-[#f59e0b]"
          >
            <span className="w-2.5 h-2.5 bg-[#f59e0b] inline-block flex-shrink-0" />
            // BATTERY STATUS UNKNOWN
          </h3>

          <p className="text-xs text-neutral-300 font-sans leading-relaxed">
            Your device or browser does not expose battery telemetry. If running on battery power, please check your device's charge level to ensure uninterrupted media playback and prevent sudden shutdown.
          </p>

          <div className="bg-[#030406] p-2 text-[11px] font-mono text-neutral-400 select-text flex items-center justify-between border border-white/5">
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>TELEMETRY // BLOCKED</span>
            <span className="text-neutral-500">3-HOUR REMINDER</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="py-1.5 px-4 font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer bg-[#f59e0b] text-black hover:bg-white"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { milestone = 100, level = 100 } = activeToast;
  const isCritical = milestone <= 10;
  const isWarning = milestone > 10 && milestone <= 25;

  let title = `// BATTERY POWER // ${milestone}% REMAINING`;
  let desc = `Your device is running on battery power without AC adapter connection. Connecting your charger is recommended for continuous, uninterrupted media streaming.`;
  let badgeColor = '#38bdf8';
  let badgeStatus = `BATTERY // ${level}%`;
  let btnColor = 'bg-[#38bdf8] text-black hover:bg-white';

  if (milestone <= 5) {
    title = `// CRITICAL POWER BRAKE // ${milestone}%`;
    desc = `Device power has dropped below 5%. High-bitrate video and shorts playback have been locked to prevent sudden system crash and data loss.`;
    badgeColor = '#ef4444';
    badgeStatus = `CRITICAL // ${level}%`;
    btnColor = 'bg-[#ef4444] text-white hover:bg-white hover:text-black';
  } else if (isCritical) {
    title = `// EMERGENCY BATTERY COUNTDOWN // ${milestone}%`;
    desc = `Rapid cell discharge detected at ${milestone}%. Your device will deplete imminently. Connect power cord immediately to prevent sudden shutdown.`;
    badgeColor = '#ef4444';
    badgeStatus = `COUNTDOWN // ${level}%`;
    btnColor = 'bg-[#ef4444] text-white hover:bg-white hover:text-black';
  } else if (isWarning) {
    title = `// LOW BATTERY WARNING // ${milestone}%`;
    desc = `Your device power has dropped to ${milestone}%. Consider connecting to AC electricity to maintain smooth streaming.`;
    badgeColor = '#f59e0b';
    badgeStatus = `LOW POWER // ${level}%`;
    btnColor = 'bg-[#f59e0b] text-black hover:bg-white';
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[10002] max-w-sm w-[calc(100vw-2rem)] select-none pointer-events-auto"
      style={{ borderRadius: 0, outline: 'none' }}
    >
      <div
        className="relative w-full bg-[#090c12] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.95)] border border-white/10 text-white flex flex-col gap-3 animate-fade-in"
        style={{ borderRadius: 0, outline: 'none' }}
      >
        <h3
          className="text-xs sm:text-sm font-bold font-mono tracking-tight uppercase flex items-center gap-2"
          style={{ color: badgeColor }}
        >
          {isCritical ? (
            <span className="w-2.5 h-2.5 bg-[#ef4444] animate-ping inline-block flex-shrink-0" />
          ) : isWarning ? (
            <span className="w-2.5 h-2.5 bg-[#f59e0b] inline-block flex-shrink-0" />
          ) : (
            <span className="w-2.5 h-2.5 bg-[#38bdf8] inline-block flex-shrink-0" />
          )}
          {title}
        </h3>

        <p className="text-xs text-neutral-300 font-sans leading-relaxed">
          {desc}
        </p>

        <div className="bg-[#030406] p-2 text-[11px] font-mono text-neutral-400 select-text flex items-center justify-between border border-white/5">
          <span style={{ color: badgeColor, fontWeight: 700 }}>{badgeStatus}</span>
          <span className="text-neutral-500">DISCHARGING &bull; AC OFFLINE</span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            className={`py-1.5 px-4 font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${btnColor}`}
            style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          >
            {isCritical ? 'Acknowledge' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
};
