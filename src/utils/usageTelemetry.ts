export interface DailyUsage {
  date: string; // YYYY-MM-DD
  label: string; // "4", "5", "YEST", "TODAY"
  minutes: number; // active session minutes
  formattedMinutes: string; // e.g. "45m" or "1h 10m"
  count: number; // Backwards-compatibility alias for minutes
}

export interface TelemetrySummary {
  days: DailyUsage[];
  todayMinutes: number;
  todayFormatted: string; // e.g. "48m today" or "1h 12m today"
  maxMinutes: number;
  todayTotal: number; // Backwards-compatibility alias
  maxVal: number; // Backwards-compatibility alias
}

const STORAGE_KEY = 'sarwarcyou_usage_telemetry_v1';
const TIME_STORAGE_KEY = 'sarwarcyou_time_telemetry_v1';

export function formatDuration(minutes: number): string {
  if (!minutes || minutes < 1) return '<1m today';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m today`;
  if (mins === 0) return `${hrs}h today`;
  return `${hrs}h ${mins}m today`;
}

export function formatShortDuration(minutes: number): string {
  if (!minutes || minutes < 1) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Record active session minutes for the current calendar date
 */
export const addSessionMinutes = (minutes: number = 1): void => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const raw = typeof window !== 'undefined' ? localStorage.getItem(TIME_STORAGE_KEY) : null;
    const history: Record<string, number> = raw ? JSON.parse(raw) : {};

    history[todayStr] = (history[todayStr] || 0) + minutes;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TIME_STORAGE_KEY, JSON.stringify(history));
    }
  } catch (e) {
    console.warn('Session time write failed', e);
  }
};

/**
 * Record user activity event (backwards compatible)
 */
export const trackActivityEvent = (amount: number = 1): void => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const history: Record<string, number> = raw ? JSON.parse(raw) : {};

    history[todayStr] = (history[todayStr] || 0) + amount;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  } catch (e) {
    console.warn('Telemetry write failed', e);
  }
};

/**
 * Retrieve rolling 7-day session time statistics relative to current calendar dates
 */
export const getRolling7DayUsage = (): TelemetrySummary => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(TIME_STORAGE_KEY) : null;
    const history: Record<string, number> = raw ? JSON.parse(raw) : {};

    const days: DailyUsage[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const mins = history[iso] || 0;

      let label = String(d.getDate());
      if (i === 0) label = 'TODAY';
      else if (i === 1) label = 'YEST';

      days.push({
        date: iso,
        label,
        minutes: mins,
        formattedMinutes: formatShortDuration(mins),
        count: mins,
      });
    }

    const todayMinutes = days[days.length - 1].minutes;
    const maxMinutes = Math.max(...days.map((d) => d.minutes), 1);

    return {
      days,
      todayMinutes,
      todayFormatted: formatDuration(todayMinutes),
      maxMinutes,
      todayTotal: todayMinutes,
      maxVal: maxMinutes,
    };
  } catch (e) {
    console.warn('Telemetry read failed', e);
    return {
      days: [],
      todayMinutes: 0,
      todayFormatted: '<1m today',
      maxMinutes: 1,
      todayTotal: 0,
      maxVal: 1,
    };
  }
};

/**
 * Lightweight active session heartbeat (records minutes while tab is active)
 */
let isTrackingInitialized = false;

export function initSessionTimeTracker(): void {
  if (typeof window === 'undefined' || isTrackingInitialized) return;
  isTrackingInitialized = true;

  let lastTick = Date.now();

  const recordTimeDelta = () => {
    if (document.visibilityState !== 'visible') {
      lastTick = Date.now();
      return;
    }

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - lastTick) / 1000);

    if (elapsedSeconds >= 30) {
      const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
      addSessionMinutes(elapsedMinutes);
      lastTick = now;
    }
  };

  // Heartbeat check every 30 seconds
  setInterval(recordTimeDelta, 30000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      lastTick = Date.now();
    } else {
      recordTimeDelta();
    }
  });

  // Ensure current day has at least a 1m active start
  const todayStr = new Date().toISOString().split('T')[0];
  try {
    const raw = localStorage.getItem(TIME_STORAGE_KEY);
    const history: Record<string, number> = raw ? JSON.parse(raw) : {};
    if (typeof history[todayStr] !== 'number' || history[todayStr] < 1) {
      history[todayStr] = 1;
      localStorage.setItem(TIME_STORAGE_KEY, JSON.stringify(history));
    }
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  initSessionTimeTracker();
}
