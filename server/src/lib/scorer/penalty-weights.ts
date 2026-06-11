// Re-exported from scoring-config for backward compatibility.
// All call sites that import PENALTY_WEIGHTS continue to work.
// New code should import DEFAULT_CONFIG from scoring-config directly.
import { DEFAULT_CONFIG } from './scoring-config.js';
export const PENALTY_WEIGHTS = DEFAULT_CONFIG.penalties;
