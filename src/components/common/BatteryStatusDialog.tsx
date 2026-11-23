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
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[10px] select-none pointer-events-auto animate-fade-in"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleDismiss();
        }}
      >
        <div
          className="relative w-full max-w-md p-6 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.75)] text-white flex flex-col gap-4 animate-scale-in"
          style={{
            borderRadius: 0,
            outline: 'none',
            border: 'none',
            background: 'rgba(10, 14, 23, 0.58)',
            backdropFilter: 'blur(32px) saturate(190%)',
            WebkitBackdropFilter: 'blur(32px) saturate(190%)',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.2) inset',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Title and Top-Right Close Button */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight uppercase flex items-center gap-2 text-[#f59e0b]">
              <span className="w-2.5 h-2.5 bg-[#f59e0b] inline-block shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              // BATTERY REMINDER
            </h3>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-base font-mono p-0"
              style={{ borderRadius: 0, outline: 'none', border: 'none', background: 'transparent' }}
              title="Close Notification"
            >
              ✕
            </button>
          </div>

          <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
            Your device or browser does not expose battery telemetry. If running on battery power, please check your device's charge level to ensure uninterrupted media playback and prevent sudden shutdown.
          </p>

          <div className="bg-[#030508]/45 p-2.5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>STATUS // UNVERIFIED</span>
            <span className="text-neutral-500">3-HR REMINDER</span>
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
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[10px] select-none pointer-events-auto animate-fade-in"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          // If critical (< 5%), require explicit action or close button
          if (level < 5) return;
          handleDismiss();
        }
      }}
    >
      <div
        className="relative w-full max-w-md p-6 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.75)] text-white flex flex-col gap-4 animate-scale-in"
        style={{
          borderRadius: 0,
          outline: 'none',
          border: 'none',
          background: 'rgba(10, 14, 23, 0.58)',
          backdropFilter: 'blur(32px) saturate(190%)',
          WebkitBackdropFilter: 'blur(32px) saturate(190%)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.2) inset',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Color Indicator Dot & Title + Top-Right Close Button (NO HEX TEXT) */}
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
          <button
            type="button"
            onClick={handleDismiss}
            className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-base font-mono p-0"
            style={{ borderRadius: 0, outline: 'none', border: 'none', background: 'transparent' }}
            title="Close Notification"
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
          {content.desc}
        </p>

        {/* Status Strip */}
        <div className="bg-[#030508]/45 p-2.5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
          <span style={{ color: colorTheme.hex, fontWeight: 700 }}>{content.status}</span>
          <span className="text-neutral-500">{content.subStatus}</span>
        </div>

        {/* 'Play as Urgent' Emergency Button: ONLY visible when battery is less than 5% */}
        {content.showUrgent && (
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={handleUrgentPlay}
              className="py-2 px-4 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 hover:bg-white hover:text-black"
              style={{
                borderRadius: 0,
                outline: 'none',
                border: 'none',
                backgroundColor: '#ff0022',
                color: '#ffffff',
                boxShadow: '0 0 16px rgba(255, 0, 34, 0.45)',
              }}
            >
              <span>⚡</span>
              <span>Play as Urgent</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
