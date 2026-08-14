// ═══════════════════════════════════════════════════════════════
// Interaction Service — records what users do with recommendations.
//
// This module owns the database write only. Validation of untrusted
// input lives in interactionEvents.ts, which is pure and has no
// side-effecting imports so it can be unit tested without env vars.
//
// Distinct from activityService: that writes the human-readable
// dashboard feed. This writes the machine-readable interaction log
// that the junk-rate metric and future ranking labels are built on.
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../config/supabase.js";
import type { NormalizedInteraction } from "./interactionEvents.js";

export { normalizeEvents, MAX_BATCH } from "./interactionEvents.js";
export type { InteractionEvent, NormalizedInteraction } from "./interactionEvents.js";

/**
 * Insert normalized rows. Non-fatal by contract — mirrors
 * activityService.logActivity: a telemetry failure is warned, never
 * thrown, so it cannot break the calling route.
 */
export async function recordInteractions(rows: NormalizedInteraction[]): Promise<void> {
    if (rows.length === 0) return;

    try {
        const { error } = await supabaseAdmin.from("job_interactions").insert(rows);
        if (error) {
            console.warn("[Interactions] Insert failed:", error.message);
        }
    } catch (err: any) {
        console.warn("[Interactions] Exception on insert:", err?.message);
    }
}
