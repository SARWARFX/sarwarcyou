/**
 * Acid Avant-Garde / High-Fashion Biennale Theme
 *
 * Palette Specifications:
 * - Base solid color: #050505 (Deep Obsidian Canvas).
 * - Architectural grid & exhibition matrix.
 * - Ambient spotlight: Subtle Electric Acid Lime volumetric glow (rgba(204, 255, 0, 0.032)).
 * - Minimalist gallery dust motes: Warm white / lime shimmer (rgba(255, 255, 255, 0.25)).
 * - Deep obsidian vignette edge falloff: #050505.
 */

export interface CinematicTheme {
  id: string;
  name: string;
  bgGradient: [string, string, string];
  fogColor: string;
  particleColor: string;
  particleSpeed: number;
  particleCount: number;
  glowAccent: string;
  vignetteColor: string;
}

export const BIENNALE_AVANT_GARDE_THEME: CinematicTheme = {
  id: 'biennale-avant-garde',
  name: 'Acid Avant-Garde Biennale',
  bgGradient: ['#050505', '#080808', '#030303'],
  fogColor: 'rgba(20, 24, 10, ',
  particleColor: 'rgba(204, 255, 0, ',
  particleSpeed: 0.18,
  particleCount: 35,
  glowAccent: 'rgba(204, 255, 0, 0.035)',
  vignetteColor: '#050505',
};

// Aliased for backward compatibility across existing references
export const MIDNIGHT_OBSIDIAN_THEME = BIENNALE_AVANT_GARDE_THEME;

export function getMidnightObsidianTheme(): CinematicTheme {
  return BIENNALE_AVANT_GARDE_THEME;
}

// Fallback alias for legacy theme callers
export function getRandomCinematicTheme(): CinematicTheme {
  return BIENNALE_AVANT_GARDE_THEME;
}
