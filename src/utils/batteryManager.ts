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

/**
 * Check if high-bitrate media playback (videos, shorts) is locked
 * Strict condition: Battery API supported, NOT charging, and battery < 5%
 */
export function isPlayerPlaybackLocked(): boolean {
  return batteryState.isSupported && !batteryState.charging && batteryState.level < 5;
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
