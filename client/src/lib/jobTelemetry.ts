// ═══════════════════════════════════════════════════════════════
// Job telemetry — records which recommendations were shown and what
// the user did with them.
//
// Impressions fire once per visible card, so they are buffered and
// flushed as one request rather than one request per job. Deliberate
// actions (click / save / apply / dismiss) flush immediately.
//
// Every send is fire-and-forget: a telemetry failure must never
// surface in the UI.
// ═══════════════════════════════════════════════════════════════

import { api } from "./api";

type Pool = "primary" | "cross_domain";

interface PendingEvent {
    job_id: string;
    event: string;
    position?: number;
    pool?: string;
    score?: number;
}

let buffer: PendingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_DELAY_MS = 2000;
const MAX_BUFFER = 200;   // matches MAX_BATCH server-side

function flush(): void {
    if (buffer.length === 0) return;

    const events = buffer;
    buffer = [];
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    api.post("/api/job-interactions", { events }).catch(() => {
        // Intentionally ignored — telemetry must never disturb the UI.
    });
}

function enqueue(event: PendingEvent): void {
    buffer.push(event);

    if (buffer.length >= MAX_BUFFER) {
        flush();
        return;
    }
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Log one impression per job in a rendered feed section. */
export function logImpressions(
    jobs: { id: string; relevance_score?: number }[],
    pool: Pool,
    offset = 0,
): void {
    jobs.forEach((job, i) => {
        if (!job?.id) return;
        enqueue({
            job_id: job.id,
            event: "impression",
            position: offset + i,
            pool,
            score: job.relevance_score,
        });
    });
}

/** Log a single deliberate user action. Flushed immediately. */
export function logJobEvent(
    event: "click" | "save" | "apply" | "dismiss",
    jobId: string,
    opts: { position?: number; pool?: string; score?: number } = {},
): void {
    if (!jobId) return;
    enqueue({ job_id: jobId, event, ...opts });
    flush();
}
