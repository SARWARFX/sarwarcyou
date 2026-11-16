export type ThemeMode = 'dark' | 'white' | 'default';

const THEME_STORAGE_KEY = 'sarwarcyou_theme_mode_preference';

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
    if (saved === 'dark' || saved === 'white' || saved === 'default') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'dark'; // Pure black & white default
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === 'undefined') return;

  let effectiveIsDark = true;
  if (mode === 'dark') {
    effectiveIsDark = true;
  } else if (mode === 'white') {
    effectiveIsDark = false;
  } else {
    // device default
    if (typeof window !== 'undefined' && window.matchMedia) {
      effectiveIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }

  const root = document.documentElement;
  if (effectiveIsDark) {
    root.classList.remove('theme-white');
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.add('theme-white');
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

export function saveThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  applyThemeMode(mode);
}

export function getNextThemeMode(current: ThemeMode): ThemeMode {
  if (current === 'dark') return 'white';
  if (current === 'white') return 'default';
  return 'dark';
}
