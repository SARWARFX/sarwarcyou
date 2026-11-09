import { useState, useEffect } from 'react';
import type { StageMediaItem } from '../types';
import { hapticSuccess, hapticLight } from './hapticsManager';

const STORAGE_KEY = 'streamvault_favorites_v1';
const EVENT_KEY = 'streamvault_favorites_changed';

function getStoredFavorites(): StageMediaItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveFavorites(favorites: StageMediaItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: favorites }));
  } catch (_) {}
}

export function isItemFavorite(item: StageMediaItem | null | undefined): boolean {
  if (!item) return false;
  const favorites = getStoredFavorites();
  const id = item.id || item.url || item.name;
  return favorites.some((f) => (f.id || f.url || f.name) === id);
}

export function toggleFavorite(item: StageMediaItem): boolean {
  const favorites = getStoredFavorites();
  const id = item.id || item.url || item.name;
  const existingIdx = favorites.findIndex((f) => (f.id || f.url || f.name) === id);

  if (existingIdx !== -1) {
    favorites.splice(existingIdx, 1);
    saveFavorites(favorites);
    hapticLight();
    return false;
  } else {
    favorites.unshift(item);
    saveFavorites(favorites);
    hapticSuccess();
    return true;
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<StageMediaItem[]>(getStoredFavorites());

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<StageMediaItem[]>;
      setFavorites(custom.detail || getStoredFavorites());
    };

    window.addEventListener(EVENT_KEY, handler);
    return () => window.removeEventListener(EVENT_KEY, handler);
  }, []);

  return favorites;
}
