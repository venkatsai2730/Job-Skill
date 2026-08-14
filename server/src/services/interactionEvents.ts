// ═══════════════════════════════════════════════════════════════
// Interaction event validation — PURE. No I/O, no imports with
// side effects.
//
// Kept in its own module (rather than alongside the insert in
// interactionService.ts) specifically so tests can import it without
// pulling in config/supabase.js, which constructs a Supabase client at
// module load and therefore requires env vars to be present.
// ═══════════════════════════════════════════════════════════════

export type InteractionEvent = "impression" | "click" | "save" | "apply" | "dismiss";

const VALID_EVENTS = new Set<string>(["impression", "click", "save", "apply", "dismiss"]);
const VALID_POOLS = new Set<string>(["primary", "cross_domain"]);

/** Hard cap per request so a single caller cannot flood the table. */
export const MAX_BATCH = 200;

export interface NormalizedInteraction {
    user_id: string;
    job_id: string;
    event: InteractionEvent;
    position: number | null;
    pool: "primary" | "cross_domain" | null;
    score: number | null;
}

/**
 * Turn untrusted request input into rows that are safe to insert.
 *
 * Invalid entries are DROPPED rather than throwing: a bad telemetry row
 * must never fail a user's request.
 */
export function normalizeEvents(userId: string, raw: unknown): NormalizedInteraction[] {
    if (!userId || !userId.trim()) return [];
    if (!Array.isArray(raw)) return [];

    const out: NormalizedInteraction[] = [];

    for (const entry of raw.slice(0, MAX_BATCH)) {
        if (!entry || typeof entry !== "object") continue;

        const e = entry as Record<string, unknown>;
        const jobId = typeof e.job_id === "string" ? e.job_id.trim() : "";
        const event = typeof e.event === "string" ? e.event : "";

        if (!jobId) continue;
        if (!VALID_EVENTS.has(event)) continue;

        const position = e.position !== null && e.position !== undefined && Number.isFinite(Number(e.position))
            ? Math.trunc(Number(e.position))
            : null;
        const score = e.score !== null && e.score !== undefined && Number.isFinite(Number(e.score))
            ? Number(e.score)
            : null;
        const pool = typeof e.pool === "string" && VALID_POOLS.has(e.pool)
            ? (e.pool as "primary" | "cross_domain")
            : null;

        out.push({
            user_id: userId,
            job_id: jobId,
            event: event as InteractionEvent,
            position,
            pool,
            score,
        });
    }

    return out;
}
