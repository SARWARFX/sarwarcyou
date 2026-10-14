import { useState, useEffect, useCallback } from 'react';
import type { StageMediaItem } from '../types';

export const RECENT_HISTORY_STORAGE_KEY = 'sarwar_recently_opened';
export const MAX_RECENT_HISTORY = 15;
const RECENT_HISTORY_EVENT = 'sarwar_recent_history_updated';

function loadRecentHistory(): StageMediaItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_RECENT_HISTORY);
    }
  } catch {
    // Ignore JSON parse or storage access errors
  }
  return [];
}

export function useRecentHistory() {
  const [recentItems, setRecentItems] = useState<StageMediaItem[]>(() => loadRecentHistory());

  useEffect(() => {
    const handleSync = () => {
      setRecentItems(loadRecentHistory());
    };

    window.addEventListener(RECENT_HISTORY_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(RECENT_HISTORY_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const addToHistory = useCallback((item: StageMediaItem) => {
    if (!item || !item.url) return;
    try {
      const current = loadRecentHistory();
      // Remove any previous matching item (match by id or url)
      const cleanList = current.filter(
        (existing) =>
          existing.id !== item.id &&
          existing.url !== item.url
      );
      // Prepend newest item at index 0, clamp to max 15
      const updated = [item, ...cleanList].slice(0, MAX_RECENT_HISTORY);
      window.localStorage.setItem(RECENT_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      setRecentItems(updated);
      window.dispatchEvent(new Event(RECENT_HISTORY_EVENT));
    } catch {
      // Ignore quota exceptions
    }
  }, []);

  const clearHistory = useCallback(() => {
    try {
      window.localStorage.removeItem(RECENT_HISTORY_STORAGE_KEY);
      setRecentItems([]);
      window.dispatchEvent(new Event(RECENT_HISTORY_EVENT));
    } catch {
      // Ignore
    }
  }, []);

  return {
    recentItems,
    addToHistory,
    clearHistory,
  };
}
