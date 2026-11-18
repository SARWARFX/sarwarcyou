import type { StageMediaItem } from '../types';

export interface RecentMediaItem extends StageMediaItem {
  openedAt: number;
}

const STORAGE_KEY = 'sarwar_recent_history';
const MAX_HISTORY = 24;

export function getRecentHistory(): RecentMediaItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && item.id);
    }
  } catch (err) {
    console.warn('Failed to parse recent history:', err);
  }
  return [];
}

export function addRecentMediaItem(item: StageMediaItem): void {
  if (typeof window === 'undefined' || !item || !item.id) return;
  try {
    const existing = getRecentHistory();
    // Filter out item if already exists to bump it to the very front
    const filtered = existing.filter(
      (entry) => entry.id !== item.id && entry.url !== item.url
    );
    const updated: RecentMediaItem = {
      ...item,
      openedAt: Date.now(),
    };
    const nextList = [updated, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('recent-history-updated'));
  } catch (err) {
    console.warn('Failed to save recent history:', err);
  }
}
