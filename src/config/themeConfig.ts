/**
 * Navigation Shell Configuration
 *
 * Current Modes:
 * - 'SILENT_HILL': Atmospheric 4-directional fog specter navigation shell (Default)
 * - 'WINXP': Windows XP Luna OS desktop navigation shell
 * - 'CLASSIC': Standard horizontal DeepSpace catalog explorer
 */
export const ACTIVE_INTERFACE: 'SILENT_HILL' | 'WINXP' | 'CLASSIC' = 'SILENT_HILL';

// Feature Flag aliases for instant single-variable zero-risk rollback
export const ENABLE_SILENT_HILL_SHELL = true;
export const ENABLE_WINXP_SHELL = false;
