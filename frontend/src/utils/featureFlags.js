/**
 * AnaChat Feature Flags
 * ---------------------
 * Toggle expensive/experimental features without rebuilding.
 * Set to false to completely disable a feature gate.
 */

export const ENABLE_RELATIONSHIP_FEATURE = true;
export const ENABLE_COUPLE_MODE          = true;
export const ENABLE_CALL_MOMENTS         = true;
export const ENABLE_CALL_SUMMARY         = true;
export const ENABLE_REACTIONS            = true;
export const ENABLE_FLOATING_REACTIONS   = true;

/** Expression detection requires face-api.js models (lazy-loaded).
 *  Kept true so the UI option is present, but user must opt-in.     */
export const ENABLE_EXPRESSIONS          = true;

/** Auto-reactions default OFF – user must explicitly enable in settings. */
export const ENABLE_AUTO_REACTIONS       = false;
