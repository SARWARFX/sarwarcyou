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
    bgGradient: ['#050608', '#0d1016', '#030406'],
    fogColor: 'rgba(38, 46, 58, ',
    particleColor: 'rgba(175, 185, 200, ',
    particleSpeed: 0.38,
    particleCount: 55,
    glowAccent: 'rgba(90, 115, 140, 0.07)',
    vignetteColor: 'rgba(3, 4, 6, 0.90)',
  },
  'dark-shadows': {
    id: 'dark-shadows',
    name: 'Dark Shadows Gothic',
    bgGradient: ['#03040b', '#080d1e', '#020307'],
    fogColor: 'rgba(20, 38, 78, ',
    particleColor: 'rgba(150, 190, 255, ',
    particleSpeed: 0.32,
    particleCount: 48,
    glowAccent: 'rgba(70, 110, 190, 0.09)',
    vignetteColor: 'rgba(2, 3, 7, 0.92)',
  },
  'wick-noir': {
    id: 'wick-noir',
    name: 'Wick Underworld Noir',
    bgGradient: ['#020203', '#08080a', '#010102'],
    fogColor: 'rgba(50, 38, 18, ',
    particleColor: 'rgba(245, 190, 85, ',
    particleSpeed: 0.45,
    particleCount: 42,
    glowAccent: 'rgba(220, 150, 45, 0.08)',
    vignetteColor: 'rgba(1, 1, 2, 0.95)',
  },
};

const THEME_KEYS: Array<keyof typeof CINEMATIC_THEMES> = ['silent-hill', 'dark-shadows', 'wick-noir'];

export function getRandomCinematicTheme(): CinematicTheme {
  const randomIndex = Math.floor(Math.random() * THEME_KEYS.length);
  const key = THEME_KEYS[randomIndex];
  return CINEMATIC_THEMES[key];
}
