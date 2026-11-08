/**
 * Navigation Shell Configuration
 *
 * Current Modes:
 * - 'CSPR_SHOWCASE': CSPR Border-Attached Navigation and Curated Horizontal Carousel Home Page (Default)
 * - 'TRAILER_GATE': Fullscreen Pure Photography Trailer Gate with Click-Anywhere Vault
 * - 'MONOLITH_GATE': Authentic Visitor Memory Monolith Bar Gate with SARWAR.CYOU Signature
 * - 'CLASSIC': Standard horizontal DeepSpace catalog explorer
 * - 'AURA_FLOW': Proprietary Aura Flow 3-tier cascade streaming interface
 * - 'CASCADE': Standard cascading catalog
 * - 'SILENT_HILL': Atmospheric fog specter navigation shell
 * - 'WINXP': Windows XP Luna OS desktop navigation shell
 */
export const ACTIVE_INTERFACE: 'CSPR_SHOWCASE' | 'TRAILER_GATE' | 'MONOLITH_GATE' | 'CLASSIC' | 'AURA_FLOW' | 'CASCADE' | 'SILENT_HILL' | 'WINXP' = 'MONOLITH_GATE';

// Feature Flag aliases for instant single-variable zero-risk rollback
export const ENABLE_CSPR_SHOWCASE = false;
export const ENABLE_TRAILER_GATE = false;
export const ENABLE_MONOLITH_GATE = true;
export const ENABLE_AURA_FLOW = false;
export const ENABLE_CASCADE_SHELL = false;
export const ENABLE_SILENT_HILL_SHELL = false;
export const ENABLE_WINXP_SHELL = false;

// Frosted Snowy Background Engine
export const ENABLE_FROSTED_SNOW = false;
