export interface DailyUsage {
  date: string; // YYYY-MM-DD
  label: string; // "TODAY", "YEST", "NOV 08", etc.
  count: number; // media items opened or events recorded
}

const STORAGE_KEY = 'sarwarcyou_usage_telemetry_v1';

/**
 * Record a user activity event (e.g. media item opened, playlist streamed)
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
 * Retrieve rolling 7-day usage statistics relative to current calendar dates
 */
export const getRolling7DayUsage = (): {
  days: DailyUsage[];
  todayTotal: number;
  maxVal: number;
} => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const history: Record<string, number> = raw ? JSON.parse(raw) : {};

    const days: DailyUsage[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const val = history[iso] || 0;

      let label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
      if (i === 0) label = 'TODAY';
      else if (i === 1) label = 'YEST';

      days.push({ date: iso, label, count: val });
    }

    const maxVal = Math.max(...days.map((d) => d.count), 1); // Avoid division by zero
    const todayTotal = days[days.length - 1].count;

    return { days, todayTotal, maxVal };
  } catch (e) {
    console.warn('Telemetry read failed', e);
    return {
      days: [],
      todayTotal: 0,
      maxVal: 1,
    };
  }
};
