/**
 * Cinematic Theme Manager for Poster Landing Gate
 * Rotates dynamically between 3 distinct cinematic themes on page load:
 * 1. Silent Hill Mist (Desaturated charcoal, rolling ash fog, rusted vignette)
 * 2. Dark Shadows Gothic (Midnight indigo, spectral blue mist, gothic shadows)
 * 3. Wick Underworld Noir (Pitch obsidian, high-contrast shadows, tungsten/gold ambient edge glow)
 */

export interface CinematicTheme {
  id: 'silent-hill' | 'dark-shadows' | 'wick-noir';
  name: string;
  bgGradient: [string, string, string]; // Top, Middle, Bottom
  fogColor: string;
  particleColor: string;
  particleSpeed: number;
  particleCount: number;
  glowAccent: string;
  vignetteColor: string;
}

export const CINEMATIC_THEMES: Record<string, CinematicTheme> = {
  'silent-hill': {
    id: 'silent-hill',
    name: 'Silent Hill Mist',
    bgGradient: ['#060709', '#0e1117', '#040507'],
    fogColor: 'rgba(32, 38, 48, ',
    particleColor: 'rgba(165, 175, 190, ',
    particleSpeed: 0.4,
    particleCount: 50,
    glowAccent: 'rgba(100, 120, 140, 0.05)',
    vignetteColor: 'rgba(4, 5, 7, 0.85)',
  },
  'dark-shadows': {
    id: 'dark-shadows',
    name: 'Dark Shadows Gothic',
    bgGradient: ['#04050c', '#090e1c', '#030408'],
    fogColor: 'rgba(22, 40, 75, ',
    particleColor: 'rgba(140, 180, 240, ',
    particleSpeed: 0.3,
    particleCount: 45,
    glowAccent: 'rgba(50, 90, 160, 0.06)',
    vignetteColor: 'rgba(3, 4, 8, 0.88)',
  },
  'wick-noir': {
    id: 'wick-noir',
    name: 'Wick Underworld Noir',
    bgGradient: ['#030304', '#09090c', '#020203'],
    fogColor: 'rgba(45, 35, 20, ',
    particleColor: 'rgba(235, 185, 80, ',
    particleSpeed: 0.5,
    particleCount: 40,
    glowAccent: 'rgba(200, 140, 40, 0.07)',
    vignetteColor: 'rgba(2, 2, 3, 0.92)',
  },
};

const THEME_KEYS: Array<keyof typeof CINEMATIC_THEMES> = ['silent-hill', 'dark-shadows', 'wick-noir'];

export function getRandomCinematicTheme(): CinematicTheme {
  const randomIndex = Math.floor(Math.random() * THEME_KEYS.length);
  const key = THEME_KEYS[randomIndex];
  return CINEMATIC_THEMES[key];
}
