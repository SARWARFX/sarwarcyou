import React, { useState, useEffect, useCallback } from 'react';
import {
  initBatteryMonitor,
  subscribeBatteryNotification,
  subscribeUnsupportedBatteryReminder,
  getBatteryAlertColor,
  getBatteryAlertContent,
  requestUrgentPlayback,
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

    return () => {
      unsubNotify();
      unsubUnsupported();
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setActiveToast(null);
  }, []);

  const handleUrgentPlay = useCallback(() => {
    requestUrgentPlayback();
    setActiveToast(null);
  }, []);

  if (!activeToast) return null;

  // Unsupported Browser / OS (iOS Safari, Firefox, macOS Safari)
  if (activeToast.type === 'unsupported') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none pointer-events-auto animate-fade-in"
        style={{ borderRadius: 0 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleDismiss();
        }}
      >
        <div
          className="relative w-full max-w-md bg-[#090c12] p-6 sm:p-7 shadow-[0_30px_90px_rgba(0,0,0,0.98)] border border-[#f59e0b]/40 text-white flex flex-col gap-4 animate-scale-in"
          style={{ borderRadius: 0, outline: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight uppercase flex items-center gap-2 text-[#f59e0b]">
              <span className="w-2.5 h-2.5 bg-[#f59e0b] inline-block shrink-0 shadow-sm" />
              // BATTERY STATUS UNKNOWN
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-black/60 border border-white/10 text-[#f59e0b]">
              3-HR NOTICE
            </span>
          </div>

          <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
            Your device or browser does not expose battery telemetry. If running on battery power, please check your device's charge level to ensure uninterrupted media playback and prevent sudden shutdown.
          </p>

          <div className="bg-[#030406] p-2.5 text-[11px] font-mono text-neutral-400 flex items-center justify-between border border-white/5">
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>TELEMETRY // BLOCKED</span>
            <span className="text-neutral-500">AC / BATTERY UNVERIFIED</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="py-2 px-5 font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer bg-[#f59e0b] text-black hover:bg-white"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { milestone = 100, level = milestone } = activeToast;
  const colorTheme = getBatteryAlertColor(level);
  const content = getBatteryAlertContent(level);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none pointer-events-auto animate-fade-in"
      style={{ borderRadius: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          // If critical (< 5%), require explicit button click
          if (level < 5) return;
          handleDismiss();
        }
      }}
    >
      <div
        className="relative w-full max-w-md bg-[#090c12] p-6 sm:p-7 shadow-[0_30px_90px_rgba(0,0,0,0.98)] border border-white/15 text-white flex flex-col gap-4 animate-scale-in"
        style={{ borderRadius: 0, outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Color Indicator Dot & Hex Value */}
        <div className="flex items-center justify-between">
          <h3
            className="text-xs sm:text-sm font-bold font-mono tracking-tight uppercase flex items-center gap-2.5"
            style={{ color: colorTheme.textColor }}
          >
            <span
              className={`w-2.5 h-2.5 inline-block shrink-0 shadow-sm ${level < 5 ? 'animate-ping' : ''}`}
              style={{ backgroundColor: colorTheme.hex, boxShadow: `0 0 8px ${colorTheme.shadow}` }}
            />
            {content.title}
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-black/60 border border-white/10 text-neutral-400">
            {colorTheme.hex.toUpperCase()}
          </span>
        </div>

        {/* Simplified Description */}
        <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
          {content.desc}
        </p>

        {/* Status Strip */}
        <div className="bg-[#030406] p-2.5 text-[11px] font-mono text-neutral-400 flex items-center justify-between border border-white/5">
          <span style={{ color: colorTheme.hex, fontWeight: 700 }}>{content.status}</span>
          <span className="text-neutral-500">{content.subStatus}</span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          {/* 'Play as Urgent' button: ONLY visible when battery is less than 5% */}
          {content.showUrgent && (
            <button
              type="button"
              onClick={handleUrgentPlay}
              className="py-2 px-4 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border flex items-center gap-1.5 hover:bg-red-500/10"
              style={{
                borderRadius: 0,
                borderColor: colorTheme.urgentBorder,
                color: colorTheme.urgentText,
                boxShadow: '0 0 12px rgba(255, 0, 34, 0.35)',
              }}
            >
              <span>⚡</span>
              <span>Play as Urgent</span>
            </button>
          )}

          {/* Dismiss or Acknowledge button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="py-2 px-5 font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer hover:bg-white hover:text-black"
            style={{
              borderRadius: 0,
              backgroundColor: colorTheme.btnBg,
              color: colorTheme.btnText,
              border: 'none',
            }}
          >
            {content.dismissBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
