/**
 * Navigation Shell Configuration
 *
 * Current Modes:
 * - 'AURA_FLOW': Proprietary Aura Flow 3-tier cascade streaming interface (Default)
 * - 'CASCADE': Standard cascading catalog
 * - 'SILENT_HILL': Atmospheric fog specter navigation shell
 * - 'WINXP': Windows XP Luna OS desktop navigation shell
 * - 'CLASSIC': Standard horizontal DeepSpace catalog explorer
 */
export const ACTIVE_INTERFACE: 'AURA_FLOW' | 'CASCADE' | 'SILENT_HILL' | 'WINXP' | 'CLASSIC' = 'AURA_FLOW';

// Feature Flag aliases for instant single-variable zero-risk rollback
export const ENABLE_AURA_FLOW = true;
export const ENABLE_CASCADE_SHELL = false;
export const ENABLE_SILENT_HILL_SHELL = false;
export const ENABLE_WINXP_SHELL = false;
