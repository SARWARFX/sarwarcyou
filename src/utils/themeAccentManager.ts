import { useState, useEffect } from 'react';
import { hapticSelection } from './hapticsManager';

export interface ThemeAccent {
  id: string;
  name: string;
  color: string;
  rgb: string;
  glow: string;
}

export const THEME_ACCENTS: ThemeAccent[] = [
  {
    id: 'cyan',
    name: 'Electric Sky',
    color: '#38bdf8',
    rgb: '56, 189, 248',
    glow: 'rgba(56, 189, 248, 0.5)',
  },
  {
    id: 'emerald',
    name: 'Cyber Emerald',
    color: '#10b981',
    rgb: '16, 185, 129',
    glow: 'rgba(16, 185, 129, 0.5)',
  },
  {
    id: 'violet',
    name: 'Amethyst Neon',
    color: '#a855f7',
    rgb: '168, 85, 247',
    glow: 'rgba(168, 85, 247, 0.5)',
  },
  {
    id: 'amber',
    name: 'Solar Amber',
    color: '#f59e0b',
    rgb: '245, 158, 11',
    glow: 'rgba(245, 158, 11, 0.5)',
  },
];

const STORAGE_KEY = 'streamvault_theme_accent';
const EVENT_KEY = 'streamvault_accent_changed';

export function getActiveAccent(): ThemeAccent {
  if (typeof window === 'undefined') return THEME_ACCENTS[0];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEME_ACCENTS.find((a) => a.id === saved) || THEME_ACCENTS[0];
  } catch (_) {
    return THEME_ACCENTS[0];
  }
}

export function applyAccentToDom(accent: ThemeAccent) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--accent-color', accent.color);
  root.style.setProperty('--accent-rgb', accent.rgb);
  root.style.setProperty('--accent-glow', accent.glow);
}

export function setAccent(accentId: string) {
  const target = THEME_ACCENTS.find((a) => a.id === accentId) || THEME_ACCENTS[0];
  try {
    localStorage.setItem(STORAGE_KEY, target.id);
    applyAccentToDom(target);
    hapticSelection();
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: target }));
  } catch (_) {}
}

export const setThemeAccent = setAccent;

export function useThemeAccent() {
  const [current, setCurrent] = useState<ThemeAccent>(getActiveAccent());

  useEffect(() => {
    applyAccentToDom(current);

    const handler = (e: Event) => {
      const custom = e as CustomEvent<ThemeAccent>;
      setCurrent(custom.detail || getActiveAccent());
    };

    window.addEventListener(EVENT_KEY, handler);
    return () => window.removeEventListener(EVENT_KEY, handler);
  }, [current]);

  return {
    accent: current,
    accents: THEME_ACCENTS,
    setAccent,
  };
}
