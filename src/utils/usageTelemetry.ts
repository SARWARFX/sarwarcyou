export interface DailyUsage {
  date: string; // YYYY-MM-DD
  label: string; // "TODAY", "YEST", or day number
  weekday: string; // "Sun", "Mon", "Tue"...
  formattedDate: string; // e.g. "Nov 10"
  minutes: number; // active session minutes
  formattedMinutes: string; // e.g. "45m" or "1h 10m"
  count: number; // Backwards-compatibility alias for minutes
}

export interface TelemetrySummary {
  days: DailyUsage[];
  activeDays: DailyUsage[]; // Days with minutes > 0
  totalWeekMinutes: number;
  averageMinutes: number;
  todayMinutes: number;
  todayFormatted: string; // e.g. "48m today" or "1h 12m today"
  maxMinutes: number;
  todayTotal: number; // Backwards-compatibility alias
  maxVal: number; // Backwards-compatibility alias
}

const STORAGE_KEY = 'sarwarcyou_usage_telemetry_v1';
const TIME_STORAGE_KEY = 'sarwarcyou_time_telemetry_v1';
export const DIURNAL_STORAGE_KEY = 'sarwarcyou_diurnal_telemetry_v1';

export type DiurnalPhaseId =
  | 'midnight'
  | 'dawn'
  | 'early_morning'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'evening'
  | 'early_night';

export interface DiurnalPhaseDef {
  id: DiurnalPhaseId;
  name: string;
  window: string;
  hours: number;
  startH: number;
  endH: number;
}

export const DIURNAL_PHASES_DEF: DiurnalPhaseDef[] = [
  { id: 'midnight', name: 'Midnight', window: '12:00 AM – 4:00 AM', hours: 4, startH: 0, endH: 4 },
  { id: 'dawn', name: 'Dawn', window: '4:00 AM – 6:00 AM', hours: 2, startH: 4, endH: 6 },
  { id: 'early_morning', name: 'Early Morning', window: '6:00 AM – 9:00 AM', hours: 3, startH: 6, endH: 9 },
  { id: 'morning', name: 'Morning', window: '9:00 AM – 11:59 AM', hours: 3, startH: 9, endH: 12 },
  { id: 'noon', name: 'Noon', window: '12:00 PM – 3:00 PM', hours: 3, startH: 12, endH: 15 },
  { id: 'afternoon', name: 'Afternoon', window: '3:00 PM – 6:00 PM', hours: 3, startH: 15, endH: 18 },
  { id: 'evening', name: 'Evening', window: '6:00 PM – 8:00 PM', hours: 2, startH: 18, endH: 20 },
  { id: 'early_night', name: 'Early Night', window: '8:00 PM – 12:00 AM', hours: 4, startH: 20, endH: 24 },
];

export function getDiurnalPhaseIndex(hour: number): number {
  if (hour < 4) return 0;
  if (hour < 6) return 1;
  if (hour < 9) return 2;
  if (hour < 12) return 3;
  if (hour < 15) return 4;
  if (hour < 18) return 5;
  if (hour < 20) return 6;
  return 7;
}

// Proportional weights for baseline phase distribution when zero history exists
const BASELINE_PHASE_WEIGHTS = [0.08, 0.02, 0.06, 0.22, 0.35, 0.15, 0.08, 0.04];

export function getDiurnalPhasesForDay(dateStr: string, totalMinutes: number): number[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(DIURNAL_STORAGE_KEY) : null;
    const history: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    const recorded = history[dateStr];
    if (recorded && recorded.some((m) => m > 0)) {
      return recorded;
    }
  } catch (e) {
    console.warn('Diurnal read failed', e);
  }

  // Generate realistic proportional distribution matching totalMinutes
  if (totalMinutes <= 0) return [0, 0, 0, 0, 0, 0, 0, 0];
  let distributed = BASELINE_PHASE_WEIGHTS.map((w) => Math.round(w * totalMinutes));
  const diff = totalMinutes - distributed.reduce((a, b) => a + b, 0);
  distributed[4] = Math.max(0, distributed[4] + diff); // adjust noon
  return distributed;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatFullSpentTime(minutes: number): string {
  if (!minutes || minutes < 1) return '< 1 minute';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) {
    return `${hrs} hour${hrs > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`;
  }
  if (hrs > 0) {
    return `${hrs} hour${hrs > 1 ? 's' : ''}`;
  }
  return `${mins} minute${mins > 1 ? 's' : ''}`;
}

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

    // Record diurnal phase distribution for today
    const hour = new Date().getHours();
    const phaseIdx = getDiurnalPhaseIndex(hour);
    const rawDiurnal = typeof window !== 'undefined' ? localStorage.getItem(DIURNAL_STORAGE_KEY) : null;
    const diurnalHistory: Record<string, number[]> = rawDiurnal ? JSON.parse(rawDiurnal) : {};
    const todayPhases = diurnalHistory[todayStr] || [0, 0, 0, 0, 0, 0, 0, 0];
    todayPhases[phaseIdx] = (todayPhases[phaseIdx] || 0) + minutes;
    diurnalHistory[todayStr] = todayPhases;
    if (typeof window !== 'undefined') {
      localStorage.setItem(DIURNAL_STORAGE_KEY, JSON.stringify(diurnalHistory));
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

      const weekday = DAY_NAMES[d.getDay()];
      const formattedDate = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;

      days.push({
        date: iso,
        label,
        weekday,
        formattedDate,
        minutes: mins,
        formattedMinutes: formatShortDuration(mins),
        count: mins,
      });
    }

    const todayMinutes = days[days.length - 1].minutes;
    const activeDays = days.filter((d) => d.minutes > 0);
    const totalWeekMinutes = days.reduce((acc, d) => acc + d.minutes, 0);
    const averageMinutes = activeDays.length > 0 ? Math.round(totalWeekMinutes / activeDays.length) : 0;
    const maxMinutes = Math.max(...days.map((d) => d.minutes), 1);

    return {
      days,
      activeDays,
      totalWeekMinutes,
      averageMinutes,
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
      activeDays: [],
      totalWeekMinutes: 0,
      averageMinutes: 0,
      todayMinutes: 0,
      todayFormatted: '<1m today',
      maxMinutes: 1,
      todayTotal: 0,
      maxVal: 1,
    };
  }
};

export interface Telemetry7DayEntry {
  date: string;
  label: string;
  minutes: number;
  formattedText: string;
}

export function getRolling7DayDisplayData(): Telemetry7DayEntry[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(TIME_STORAGE_KEY) : null;
    const history: Record<string, number> = raw ? JSON.parse(raw) : {};

    const list: Telemetry7DayEntry[] = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const mins = history[iso] || 0;

      // Exclude days with no data (zero days)
      if (mins === 0 && i !== 0) continue;

      let label = FULL_DAY_NAMES[d.getDay()];
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Yesterday';

      list.push({
        date: iso,
        label,
        minutes: mins,
        formattedText: formatFullSpentTime(mins),
      });
    }

    return list;
  } catch (e) {
    console.warn('Telemetry 7-day read failed', e);
    return [
      {
        date: new Date().toISOString().split('T')[0],
        label: 'Today',
        minutes: 0,
        formattedText: '< 1 minute',
      },
    ];
  }
}

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
  } catch {}
}

/**
 * Retrieve rolling 15-day session time statistics with zero suppression
 * Days with zero data are omitted completely.
 */
export const getRolling15DayUsage = (): DailyUsage[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(TIME_STORAGE_KEY) : null;
    const history: Record<string, number> = raw ? JSON.parse(raw) : {};

    const activeDays: DailyUsage[] = [];
    const now = new Date();

    for (let i = 14; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const mins = history[iso] || 0;

      // Keep Today and Yestd always anchored; exclude days older than yesterday if zero data
      if (i > 1 && mins <= 0) continue;

      let label = DAY_NAMES[d.getDay()];
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Yestd';

      const weekday = DAY_NAMES[d.getDay()];
      const formattedDate = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;

      activeDays.push({
        date: iso,
        label,
        weekday,
        formattedDate,
        minutes: mins,
        formattedMinutes: formatShortDuration(mins),
        count: mins,
      });
    }

    return activeDays;
  } catch (e) {
    console.warn('Telemetry 15-day read failed', e);
    return [];
  }
};

if (typeof window !== 'undefined') {
  initSessionTimeTracker();
}
