export interface BatteryState {
  isSupported: boolean;
  level: number; // Integer 0 - 100
  charging: boolean;
}

export type BatteryMilestone =
  | 50
  | 30
  | 25
  | 20
  | 15
  | 10
  | 9
  | 8
  | 7
  | 6
  | 5
  | 4
  | 3
  | 2
  | 1;

export const ALL_BATTERY_MILESTONES: BatteryMilestone[] = [
  50, 30, 25, 20, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
];

let batteryState: BatteryState = {
  isSupported: false,
  level: 100,
  charging: true,
};

const stateListeners = new Set<(state: BatteryState) => void>();
const notificationListeners = new Set<(milestone: BatteryMilestone, state: BatteryState) => void>();
const unsupportedReminderListeners = new Set<() => void>();
let lastNotifiedMilestone: number | null = null;
let isInitialized = false;

const STORAGE_KEY_LAST_BATTERY_REMINDER = 'sarwarcyou_battery_reminder_time';
const REMINDER_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

function checkUnsupportedReminder(): void {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LAST_BATTERY_REMINDER) : null;
    const lastTime = raw ? parseInt(raw, 10) : 0;
    const now = Date.now();
    if (!lastTime || isNaN(lastTime) || now - lastTime >= REMINDER_INTERVAL_MS) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_LAST_BATTERY_REMINDER, now.toString());
      }
      triggerBatteryHaptic(false);
      unsupportedReminderListeners.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.warn('[BatteryManager] Unsupported reminder error:', e);
        }
      });
    }
  } catch {}
}

function triggerBatteryHaptic(critical = false): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (critical) {
        navigator.vibrate([120, 60, 120, 60, 200]);
      } else {
        navigator.vibrate([100, 60, 100]);
      }
    } catch {}
  }
}

function notifyState(): void {
  stateListeners.forEach((cb) => {
    try {
      cb({ ...batteryState });
    } catch (e) {
      console.warn('[BatteryManager] State listener error:', e);
    }
  });
}

function dispatchMilestoneNotification(milestone: BatteryMilestone): void {
  lastNotifiedMilestone = milestone;
  triggerBatteryHaptic(milestone <= 10);
  notificationListeners.forEach((cb) => {
    try {
      cb(milestone, { ...batteryState });
    } catch (e) {
      console.warn('[BatteryManager] Notification listener error:', e);
    }
  });
}

/**
 * Given a battery percentage, determine the closest breached threshold for initial load catch-up
 * e.g. 18% -> 20%, 4% -> 4%, 82% -> null
 */
export function getClosestBreachedMilestone(level: number): BatteryMilestone | null {
  if (level > 50) return null;
  // Look for the lowest milestone that is >= level
  // Milestones in descending order: 50, 30, 25, 20, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
  for (let i = ALL_BATTERY_MILESTONES.length - 1; i >= 0; i--) {
    const m = ALL_BATTERY_MILESTONES[i];
    if (m >= level) {
      return m;
    }
  }
  return 50;
}

function evaluateBatteryTransitions(oldLevel: number, newLevel: number, charging: boolean): void {
  if (charging) {
    lastNotifiedMilestone = null;
    return;
  }

  // Only trigger on descending battery (discharging)
  if (newLevel < oldLevel) {
    for (const m of ALL_BATTERY_MILESTONES) {
      if (oldLevel > m && newLevel <= m) {
        if (lastNotifiedMilestone !== m) {
          dispatchMilestoneNotification(m);
          break; // One notification per event transition
        }
      }
    }
  }
}

/**
 * Initialize Battery Hardware Monitor via W3C Battery Status API
 */
export async function initBatteryMonitor(): Promise<void> {
  if (isInitialized) return;
  if (typeof navigator === 'undefined' || !('getBattery' in navigator)) {
    batteryState.isSupported = false;
    notifyState();
    // Initial check for unsupported devices (iOS Safari, Firefox, macOS Safari)
    setTimeout(() => {
      checkUnsupportedReminder();
    }, 4500);
    // Periodically re-check interval every 10 minutes
    setInterval(checkUnsupportedReminder, 10 * 60 * 1000);
    return;
  }

  try {
    const b = await (navigator as any).getBattery();
    isInitialized = true;

    const readState = () => {
      const prev = { ...batteryState };
      const newLvl = Math.round((b.level || 0) * 100);
      const isCharging = Boolean(b.charging);

      batteryState = {
        isSupported: true,
        level: newLvl,
        charging: isCharging,
      };

      notifyState();

      if (prev.isSupported) {
        evaluateBatteryTransitions(prev.level, newLvl, isCharging);
      } else {
        // Initial load check
        if (!isCharging && newLvl <= 50) {
          const initialMilestone = getClosestBreachedMilestone(newLvl);
          if (initialMilestone !== null) {
            // Small delay so page can finish mounting
            setTimeout(() => {
              if (!batteryState.charging) {
                dispatchMilestoneNotification(initialMilestone);
              }
            }, 800);
          }
        }
      }
    };

    b.addEventListener('levelchange', readState);
    b.addEventListener('chargingchange', readState);
    readState();
  } catch (err) {
    console.warn('[BatteryManager] API access notice:', err);
    batteryState.isSupported = false;
    notifyState();
  }
}

export function getBatteryState(): BatteryState {
  return { ...batteryState };
}

export interface BatteryColorTheme {
  hex: string;
  rgb: string;
  textColor: string;
  btnBg: string;
  btnText: string;
  shadow: string;
  urgentBorder: string;
  urgentText: string;
}

/**
 * Dynamic color interpolation:
 * - 50%: Pure Blue (#0088ff = rgb(0, 136, 255))
 * - 50% down to 10%: Linear color blend from blue to red (e.g. 30% is violet/purple)
 * - 9% down to 1%: Totally solid red (#ff0022 = rgb(255, 0, 34))
 */
export function getBatteryAlertColor(level: number): BatteryColorTheme {
  if (level <= 9) {
    return {
      hex: '#ff0022',
      rgb: 'rgb(255, 0, 34)',
      textColor: '#ff0022',
      btnBg: '#ff0022',
      btnText: '#ffffff',
      shadow: 'rgba(255, 0, 34, 0.45)',
      urgentBorder: '#ff0022',
      urgentText: '#ff4455',
    };
  }

  const clamped = Math.max(10, Math.min(50, level));
  const t = (50 - clamped) / 40; // 0.0 at 50%, 0.5 at 30%, 1.0 at 10%

  const r = Math.round(0 + t * 245);
  const g = Math.round(136 - t * 126);
  const b = Math.round(255 - t * 225);

  const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  const btnText = t > 0.4 ? '#ffffff' : '#000000';

  return {
    hex,
    rgb: `rgb(${r}, ${g}, ${b})`,
    textColor: hex,
    btnBg: hex,
    btnText,
    shadow: `rgba(${r}, ${g}, ${b}, 0.35)`,
    urgentBorder: hex,
    urgentText: hex,
  };
}

export interface BatteryAlertContent {
  title: string;
  desc: string;
  status: string;
  subStatus: string;
  dismissBtn: string;
  showUrgent: boolean;
}

/**
 * Formats notification title and text strictly per design:
 * - 'Play as Urgent' appears ONLY for level < 5
 */
export function getBatteryAlertContent(level: number): BatteryAlertContent {
  if (level < 5) {
    return {
      title: '// CRITICAL BATTERY // < 5%',
      desc: "Device is running on very low power emergency state (< 5%). Video & shorts playback is locked to prevent sudden system crash. You may choose 'Play as Urgent' for a single emergency play.",
      status: `CRITICAL // ${level}%`,
      subStatus: 'PLAYBACK LOCKED',
      dismissBtn: 'Acknowledge',
      showUrgent: true,
    };
  } else if (level === 5) {
    return {
      title: '// BATTERY // 5%',
      desc: 'Device power has reached 5%. Media playback will lock below this level. Connect AC power cord immediately to prevent sudden shutdown.',
      status: 'CRITICAL // 5%',
      subStatus: 'AC OFFLINE',
      dismissBtn: 'Acknowledge',
      showUrgent: false,
    };
  } else if (level <= 10) {
    return {
      title: '// BATTERY // < 10%',
      desc: 'Critical battery charge remaining. Connecting your charger is recommended to prevent unexpected shutdown during playback.',
      status: `COUNTDOWN // ${level}%`,
      subStatus: 'AC OFFLINE',
      dismissBtn: 'Acknowledge',
      showUrgent: false,
    };
  } else if (level <= 25) {
    return {
      title: '// BATTERY // < 25%',
      desc: 'Device power has dropped below 25%. Connecting your charger is recommended for uninterrupted media streaming.',
      status: `LOW POWER // ${level}%`,
      subStatus: 'DISCHARGING',
      dismissBtn: 'Dismiss',
      showUrgent: false,
    };
  } else if (level <= 30) {
    return {
      title: '// BATTERY // < 30%',
      desc: 'Device power has dropped to 30%. Consider connecting to AC electricity to maintain smooth streaming.',
      status: `BATTERY // ${level}%`,
      subStatus: 'DISCHARGING',
      dismissBtn: 'Dismiss',
      showUrgent: false,
    };
  } else {
    return {
      title: '// BATTERY // < 50%',
      desc: 'Device is running on battery power without AC adapter connection. Connecting your charger is recommended for continuous streaming.',
      status: `BATTERY // ${level}%`,
      subStatus: 'DISCHARGING',
      dismissBtn: 'Dismiss',
      showUrgent: false,
    };
  }
}

// Emergency Playback Session Management (< 5% Battery override)
let urgentPlaybackGranted = false;
const urgentPlayListeners = new Set<(granted: boolean) => void>();

export function requestUrgentPlayback(): void {
  urgentPlaybackGranted = true;
  urgentPlayListeners.forEach((cb) => {
    try {
      cb(true);
    } catch (e) {
      console.warn('[BatteryManager] Urgent play listener error:', e);
    }
  });
}

export function resetUrgentPlayback(): void {
  urgentPlaybackGranted = false;
  urgentPlayListeners.forEach((cb) => {
    try {
      cb(false);
    } catch (e) {
      console.warn('[BatteryManager] Urgent play listener error:', e);
    }
  });
}

export function isUrgentPlaybackActive(): boolean {
  return urgentPlaybackGranted;
}

export function subscribeUrgentPlayback(callback: (granted: boolean) => void): () => void {
  urgentPlayListeners.add(callback);
  callback(urgentPlaybackGranted);
  return () => {
    urgentPlayListeners.delete(callback);
  };
}

/**
 * Check if high-bitrate media playback (videos, shorts) is locked
 * Strict condition: Battery API supported, NOT charging, and battery < 5%, without active urgent session
 */
export function isPlayerPlaybackLocked(): boolean {
  return batteryState.isSupported && !batteryState.charging && batteryState.level < 5 && !urgentPlaybackGranted;
}

/**
 * Subscribe to hardware battery changes
 */
export function subscribeBatteryState(callback: (state: BatteryState) => void): () => void {
  stateListeners.add(callback);
  callback({ ...batteryState });
  return () => {
    stateListeners.delete(callback);
  };
}

/**
 * Subscribe to threshold milestone notifications (50%, 30%, 25%, 20%, 15%, 10%, 9%-1%)
 */
export function subscribeBatteryNotification(
  callback: (milestone: BatteryMilestone, state: BatteryState) => void
): () => void {
  notificationListeners.add(callback);
  return () => {
    notificationListeners.delete(callback);
  };
}

/**
 * Subscribe to the 3-hour reminder for unsupported devices (iOS Safari, Firefox, etc.)
 */
export function subscribeUnsupportedBatteryReminder(callback: () => void): () => void {
  unsupportedReminderListeners.add(callback);
  return () => {
    unsupportedReminderListeners.delete(callback);
  };
}
