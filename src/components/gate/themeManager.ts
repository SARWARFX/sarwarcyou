/**
 * Permanent Deep Midnight Obsidian Theme
 *
 * Locked Palette Specifications:
 * - Base solid color: #03060a (Deep midnight abyss).
 * - Radial glow overlay: radial-gradient(circle at 50% 40%, rgba(8, 20, 38, 0.6) 0%, #020408 80%).
 * - Dust/mist particles: rgba(186, 230, 253, alpha) (cool cyan-white shimmer).
 * - Core pillar glow & halo: pure white (#ffffff) with cool blue-white halo (rgba(56, 189, 248, 0.25)).
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

export const MIDNIGHT_OBSIDIAN_THEME: CinematicTheme = {
  id: 'midnight-obsidian',
  name: 'Permanent Midnight Obsidian',
  bgGradient: ['#03060a', '#060e1c', '#020408'],
  fogColor: 'rgba(12, 28, 54, ',
  particleColor: 'rgba(186, 230, 253, ',
  particleSpeed: 0.32,
  particleCount: 52,
  glowAccent: 'rgba(56, 189, 248, 0.16)',
  vignetteColor: 'rgba(2, 4, 8, 0.94)',
};

export function getMidnightObsidianTheme(): CinematicTheme {
  return MIDNIGHT_OBSIDIAN_THEME;
}

// Fallback alias for legacy theme callers
export function getRandomCinematicTheme(): CinematicTheme {
  return MIDNIGHT_OBSIDIAN_THEME;
}
