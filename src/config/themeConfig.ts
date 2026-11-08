/**
 * Navigation Shell Configuration
 *
 * Current Modes:
 * - 'FREQUENCY_GATE': Encrypted Frequency & Classified Telemetry Gate (Concept 3 - Default)
 * - 'CINEMATIC_GATE': Cryptic dynamic cinematic poster landing gate with hacker text-scramble unlock
 * - 'CLASSIC': Standard horizontal DeepSpace catalog explorer
 * - 'AURA_FLOW': Proprietary Aura Flow 3-tier cascade streaming interface
 * - 'CASCADE': Standard cascading catalog
 * - 'SILENT_HILL': Atmospheric fog specter navigation shell
 * - 'WINXP': Windows XP Luna OS desktop navigation shell
 */
export const ACTIVE_INTERFACE: 'FREQUENCY_GATE' | 'CINEMATIC_GATE' | 'CLASSIC' | 'AURA_FLOW' | 'CASCADE' | 'SILENT_HILL' | 'WINXP' = 'FREQUENCY_GATE';

// Feature Flag aliases for instant single-variable zero-risk rollback
export const ENABLE_FREQUENCY_GATE = true;
export const ENABLE_CINEMATIC_GATE = false;
export const ENABLE_AURA_FLOW = false;
export const ENABLE_CASCADE_SHELL = false;
export const ENABLE_SILENT_HILL_SHELL = false;
export const ENABLE_WINXP_SHELL = false;

// Frosted Snowy Background Engine
export const ENABLE_FROSTED_SNOW = false;
