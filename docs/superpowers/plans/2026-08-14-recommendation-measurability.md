# Recommendation Measurability Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the test suite, start logging what users actually do with job recommendations, and measure the feed's junk rate — so the eligibility gate is justified by a number instead of a hunch.

**Architecture:** Three layers, in order. (1) Restore vitest so any later claim is verifiable. (2) A new `job_interactions` table plus a thin service and route, written to from the Jobs page on feed render and card interaction — the app currently has no record of which job was shown to whom. (3) A one-off measurement script that samples real feeds so the junk rate can be recorded in the spec.

**Tech Stack:** Express + TypeScript (ESM, `.js` import specifiers), Supabase Postgres via `supabaseAdmin`, vitest, React + Vite client.

**Spec:** [`docs/superpowers/specs/2026-08-14-job-recommendation-precision-design.md`](../specs/2026-08-14-job-recommendation-precision-design.md) — this plan implements build-sequence steps 0–2 (§6), covering §5a and §5b.

## Progress (2026-08-14)

| Task | State |
|---|---|
| 1 — Restore server tests | **Done.** 144/144 passed on restore; no triage needed |
| 2 — Restore client tests | **Done.** 27/27 passed |
| 3 — `job_interactions` + service | **Done**, 10 new unit tests. Migration written but **not applied** (no `server/.env`) |
| 4 — `POST /api/job-interactions` | **Done.** Verified 401 unauth / `202 {"accepted":1}` with a minted token, invalid events dropped |
| 5 — Client logging + dismiss | **Code complete**, tsc + build clean. **Browser/DB verification outstanding** — needs real Supabase credentials |
| 6 — Baseline junk-rate | **Not started.** Requires real profiles + human labelling |

**Deviation from this plan (Task 3):** `normalizeEvents` was moved into its own module,
`server/src/services/interactionEvents.ts`. Keeping it in `interactionService.ts` made the test
import `config/supabase.js` transitively, which constructs a Supabase client at module load and
fails with `supabaseUrl is required`. The plan's claim that the pure half is testable without
mocking only holds once the modules are separate. `interactionService.ts` re-exports it, so
consumers are unaffected.

**Unrelated fix made along the way:** `server/src/routes/resume.ts:13` had
`keyGenerator: req => req.user?.userId || req.ip`, which express-rate-limit v8 rejects at boot
with `ERR_ERL_KEY_GEN_IPV6` — an IPv6 client could rotate addresses within its /64 to bypass the
AI rate limit. Now wrapped in `ipKeyGenerator()`.

## Global Constraints

- Server is ESM: **every relative import must end in `.js`**, even when the target is a `.ts` file (`import { x } from "./foo.js"`).
- Server tests live in `server/src/__tests__/**/*.test.ts` — this glob is hardcoded in `vitest.config.ts`.
- Interaction logging is **never fatal**: a logging failure must never fail the user's request. Follow the `logActivity` pattern in `server/src/services/activityService.ts` — catch, `console.warn`, return.
- `job_interactions` stores **behavioural data about identifiable users under the DPDP Act**. Store `user_id` only. Never write résumé content, email, phone, or any contact field into this table. No third-party analytics for these events.
- Migrations are idempotent and named `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`. See `supabase/migrations/README.md`.
- Do not change `relevanceScorer` weights, `eligibilityGate`, or any ranking behaviour in this plan. Plan 1 only observes; it must not alter what users see, apart from adding a dismiss control.

## Why this plan stops at the measurement

Task 6 produces a number that decides whether Plans 2–3 get written at all. Per spec §5b: a junk rate of **≤ 10% stops the plan** — dissatisfaction would be coming from supply or ordering, and the gate would buy very little. Do not start the eligibility gate before Task 6 is recorded.

---

## File Structure

| File | Responsibility |
|---|---|
| `server/vitest.config.ts` | Restored — vitest config, `src/__tests__` glob |
| `server/src/__tests__/*.test.ts` | Restored — 7 existing scorer/classifier suites |
| `supabase/migrations/20260814000100_job_interactions.sql` | Create — `job_interactions` table, indexes, RLS deny-by-default |
| `server/src/services/interactionService.ts` | Create — pure event validation + non-fatal batch insert |
| `server/src/__tests__/interactionService.test.ts` | Create — unit tests for the pure validation half |
| `server/src/routes/jobInteractions.ts` | Create — `POST /api/job-interactions` batch endpoint |
| `server/src/index.ts` | Modify — mount the new route |
| `client/src/lib/jobTelemetry.ts` | Create — client-side impression batching + event send |
| `client/src/pages/Jobs.tsx` | Modify — impression/click/dismiss wiring, dismiss control |
| `server/src/scripts/measureJunkRate.ts` | Create — one-off baseline sampling script |

`interactionService.ts` splits deliberately into a pure `normalizeEvents()` (fully unit-testable, no I/O) and a thin `recordInteractions()` (one Supabase call). This is what makes it testable without mocking Supabase.

---

## Task 1: Restore the server test suite

Nothing in this plan or the spec is verifiable until `npm test` runs. All 7 suites plus `vitest.config.ts` were deleted from the working tree but remain in `HEAD`.

**Files:**
- Restore: `server/vitest.config.ts`, `server/src/__tests__/` (7 suites + 1 snapshot)
- Modify: `server/package.json`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` in `server/`; every later task depends on it

- [ ] **Step 1: Restore the deleted files from HEAD**

```bash
cd server
git checkout HEAD -- vitest.config.ts src/__tests__
ls src/__tests__
```

Expected: 7 `.test.ts` files plus `__snapshots__/phase1.test.ts.snap`.

- [ ] **Step 2: Restore the test script and vitest devDependency**

In `server/package.json`, add the `test` script back to `scripts`:

```json
"scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
}
```

Then install vitest as a devDependency:

```bash
cd server && npm install --save-dev vitest@^4.1.7
```

- [ ] **Step 3: Run the suite to see the real starting state**

```bash
cd server && npm test
```

Expected: the suites execute. They may not all pass — `phase1`/`phase2`/`phase3` and `relevanceScorer` were written before the scorer changes in commits `bb1b021`…`15e4462`, so some assertions may now be stale.

- [ ] **Step 4: Record and triage failures — do not "fix" tests by deleting assertions**

For each failure decide, and write the decision into the commit message:

- **Test is stale** (asserts an old weight or threshold that was intentionally changed) → update the expected value, and note which commit changed the behaviour.
- **Test found a real bug** → leave it failing, add `.fails` or `it.skip` with a `// BUG:` comment referencing it, and report it. Do not silently change production code in this task.

If a suite cannot be salvaged, `it.skip` the individual cases with a reason. Never delete a test file.

- [ ] **Step 5: Confirm green (or explicitly skipped) and type-check**

```bash
cd server && npm test && npx tsc --noEmit
```

Expected: `Test Files  N passed`, zero unexplained failures, tsc silent.

- [ ] **Step 6: Commit**

```bash
git add server/vitest.config.ts server/src/__tests__ server/package.json server/package-lock.json
git commit -m "test: restore deleted server test suite and vitest config"
```

---

## Task 2: Restore client test wiring

The client's test *files* are still on disk (`client/src/features/resume/__tests__/`, 3 suites) and `client/vitest.config.ts` exists — but `client/package.json` had its `test` scripts and all four test dependencies stripped, so they cannot run.

**Files:**
- Modify: `client/package.json`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` in `client/`

- [ ] **Step 1: Restore the scripts**

In `client/package.json`, add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Reinstall the four stripped devDependencies**

```bash
cd client && npm install --save-dev vitest@^3.2.4 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.6.0 jsdom@^20.0.3
```

- [ ] **Step 3: Run the suite**

```bash
cd client && npm test
```

Expected: the 3 resume-editor suites execute. Triage failures exactly as in Task 1 Step 4.

- [ ] **Step 4: Commit**

```bash
git add client/package.json client/package-lock.json
git commit -m "test: restore client vitest wiring for existing resume-editor suites"
```

---

## Task 3: `job_interactions` table + interaction service

**Files:**
- Create: `supabase/migrations/20260814000100_job_interactions.sql`
- Create: `server/src/services/interactionService.ts`
- Test: `server/src/__tests__/interactionService.test.ts`
- Modify: `supabase/migrations/README.md` (add the row to the version table)

**Interfaces:**
- Consumes: `supabaseAdmin` from `../config/supabase.js`
- Produces:
  - `type InteractionEvent = "impression" | "click" | "save" | "apply" | "dismiss"`
  - `interface NormalizedInteraction { user_id: string; job_id: string; event: InteractionEvent; position: number | null; pool: "primary" | "cross_domain" | null; score: number | null }`
  - `function normalizeEvents(userId: string, raw: unknown): NormalizedInteraction[]`
  - `function recordInteractions(rows: NormalizedInteraction[]): Promise<void>`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260814000100_job_interactions.sql`:

```sql
-- ═══════════════════════════════════════════════════════════════
-- Job interaction log — what users actually do with recommendations.
--
-- Distinct from user_activity, which is a human-readable DISPLAY feed
-- for the dashboard. This table is the machine-readable interaction
-- log: which job was shown to whom, at what rank, and what happened.
-- It is the source of the (user, job, outcome) labels that the ranking
-- TODOs in relevanceScorer/shortlistingChance depend on.
--
-- DPDP note: behavioural data about identifiable users. user_id only —
-- never résumé content or contact fields. Must be covered by the
-- retention policy and deleted with the account.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_interactions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     TEXT NOT NULL,
    job_id      TEXT NOT NULL,
    event       TEXT NOT NULL,   -- impression | click | save | apply | dismiss
    position    INT,             -- rank in the feed when shown
    pool        TEXT,            -- primary | cross_domain
    score       NUMERIC,         -- relevance_score at serve time
    created_at  TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_interactions_user    ON job_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_job_interactions_job     ON job_interactions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_interactions_event   ON job_interactions(event);
CREATE INDEX IF NOT EXISTS idx_job_interactions_created ON job_interactions(created_at DESC);

-- All access is server-side via the service-role key, which bypasses
-- RLS. Enable RLS with no policies so a leaked anon key cannot read
-- users' browsing behaviour.
ALTER TABLE job_interactions ENABLE ROW LEVEL SECURITY;
```

Add to the table in `supabase/migrations/README.md`:

```markdown
| `20260814000100` | `job_interactions` | Interaction log (impression/click/save/apply/dismiss) |
```

- [ ] **Step 2: Write the failing test**

Create `server/src/__tests__/interactionService.test.ts`. These test `normalizeEvents` only — it is pure, so no Supabase mock is needed.

```ts
import { describe, it, expect } from "vitest";
import { normalizeEvents } from "../services/interactionService.js";

describe("normalizeEvents", () => {
    it("accepts a valid impression batch", () => {
        const out = normalizeEvents("user-1", [
            { job_id: "job-a", event: "impression", position: 0, pool: "primary", score: 0.82 },
            { job_id: "job-b", event: "impression", position: 1, pool: "cross_domain", score: 0.41 },
        ]);
        expect(out).toHaveLength(2);
        expect(out[0]).toEqual({
            user_id: "user-1", job_id: "job-a", event: "impression",
            position: 0, pool: "primary", score: 0.82,
        });
    });

    it("drops events with an unknown event name", () => {
        const out = normalizeEvents("user-1", [
            { job_id: "job-a", event: "hover" },
            { job_id: "job-b", event: "click" },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].event).toBe("click");
    });

    it("drops events with a missing or blank job_id", () => {
        const out = normalizeEvents("user-1", [
            { job_id: "", event: "click" },
            { event: "click" },
            { job_id: "job-ok", event: "click" },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].job_id).toBe("job-ok");
    });

    it("nulls optional fields that are absent or unusable", () => {
        const out = normalizeEvents("user-1", [{ job_id: "job-a", event: "dismiss" }]);
        expect(out[0]).toMatchObject({ position: null, pool: null, score: null });
    });

    it("rejects an unknown pool value rather than storing it", () => {
        const out = normalizeEvents("user-1", [
            { job_id: "job-a", event: "impression", pool: "sponsored" },
        ]);
        expect(out[0].pool).toBeNull();
    });

    it("returns an empty array for non-array input", () => {
        expect(normalizeEvents("user-1", null)).toEqual([]);
        expect(normalizeEvents("user-1", { job_id: "x", event: "click" })).toEqual([]);
        expect(normalizeEvents("user-1", "click")).toEqual([]);
    });

    it("caps a batch at 200 rows so one request cannot flood the table", () => {
        const many = Array.from({ length: 500 }, (_, i) => ({ job_id: `job-${i}`, event: "impression" }));
        expect(normalizeEvents("user-1", many)).toHaveLength(200);
    });

    it("returns an empty array when userId is blank", () => {
        expect(normalizeEvents("", [{ job_id: "job-a", event: "click" }])).toEqual([]);
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd server && npx vitest run src/__tests__/interactionService.test.ts
```

Expected: FAIL — `Failed to resolve import "../services/interactionService.js"`.

- [ ] **Step 4: Write the implementation**

Create `server/src/services/interactionService.ts`:

```ts
import { supabaseAdmin } from "../config/supabase.js";

// ── Types ────────────────────────────────────────────────────
export type InteractionEvent = "impression" | "click" | "save" | "apply" | "dismiss";

const VALID_EVENTS = new Set<string>(["impression", "click", "save", "apply", "dismiss"]);
const VALID_POOLS  = new Set<string>(["primary", "cross_domain"]);

/** Hard cap per request so a single caller cannot flood the table. */
const MAX_BATCH = 200;

export interface NormalizedInteraction {
    user_id: string;
    job_id: string;
    event: InteractionEvent;
    position: number | null;
    pool: "primary" | "cross_domain" | null;
    score: number | null;
}

// ── Pure validation ──────────────────────────────────────────
/**
 * Turn untrusted request input into rows safe to insert.
 *
 * Pure and side-effect free so it can be unit tested without a
 * database. Invalid entries are DROPPED rather than throwing: a bad
 * telemetry row must never fail a user's request.
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

        const position = Number.isFinite(Number(e.position)) && e.position !== null && e.position !== undefined
            ? Math.trunc(Number(e.position))
            : null;
        const score = Number.isFinite(Number(e.score)) && e.score !== null && e.score !== undefined
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

// ── Insert ───────────────────────────────────────────────────
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
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd server && npx vitest run src/__tests__/interactionService.test.ts && npx tsc --noEmit
```

Expected: `8 passed`, tsc silent.

- [ ] **Step 6: Apply the migration**

```bash
cd supabase && supabase db push
```

Expected: `20260814000100_job_interactions` applied. If the CLI is not configured, run the file's SQL in the Supabase SQL editor — it is idempotent and safe to re-run.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260814000100_job_interactions.sql supabase/migrations/README.md \
        server/src/services/interactionService.ts server/src/__tests__/interactionService.test.ts
git commit -m "feat: add job_interactions log and interaction service"
```

---

## Task 4: `POST /api/job-interactions`

**Files:**
- Create: `server/src/routes/jobInteractions.ts`
- Modify: `server/src/index.ts` (import + mount)

**Interfaces:**
- Consumes: `normalizeEvents`, `recordInteractions` from Task 3; `authenticateToken`, `AuthRequest` from `../middleware/auth.js`
- Produces: `POST /api/job-interactions` accepting a JSON body `{ events: unknown[] }` — each entry shaped `{ job_id, event, position?, pool?, score? }` and validated by `normalizeEvents`; responds `202 { accepted: number }`

- [ ] **Step 1: Write the route**

Create `server/src/routes/jobInteractions.ts`:

```ts
import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { normalizeEvents, recordInteractions } from "../services/interactionService.js";

const router = Router();

router.use(authenticateToken);

// Impressions batch on every feed render, so this is the highest-volume
// write path in the app. Cap it well above normal browsing.
const telemetryLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many telemetry requests." },
});

// ── POST /api/job-interactions ───────────────────────────────
// Fire-and-forget. Always 202 on a well-formed request: telemetry must
// never surface an error to the user, and the client must not retry.
router.post("/", telemetryLimiter, async (req: AuthRequest, res: Response) => {
    const rows = normalizeEvents(req.user!.userId, req.body?.events);

    res.status(202).json({ accepted: rows.length });

    // Insert after responding — the user's UI never waits on telemetry.
    void recordInteractions(rows);
});

export default router;
```

- [ ] **Step 2: Mount it**

In `server/src/index.ts`, add the import alongside the other route imports:

```ts
import jobInteractionsRoutes from "./routes/jobInteractions.js";
```

and mount it with the others:

```ts
app.use("/api/job-interactions", jobInteractionsRoutes);
```

Note: mount **before** the `app.use("/api", …)` JSON 404 handler — that handler catches everything unmatched, so a route mounted after it is unreachable.

- [ ] **Step 3: Verify it responds**

Start the server, then:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{"events":[]}' \
  http://localhost:3001/api/job-interactions
```

Expected: `401` without a token (route present, auth required). With a valid `Authorization: Bearer <token>`, expect `202` and `{"accepted":0}`.

- [ ] **Step 4: Verify a real row lands**

```bash
curl -s -X POST -H "Authorization: Bearer $ARIA_AUTH_TOKEN" -H 'Content-Type: application/json' \
  -d '{"events":[{"job_id":"test-job-1","event":"click","position":3,"pool":"primary","score":0.77}]}' \
  http://localhost:3001/api/job-interactions
```

Expected: `{"accepted":1}`. Confirm in Supabase: `select * from job_interactions where job_id = 'test-job-1';` returns one row. Delete it afterwards.

- [ ] **Step 5: Type-check and commit**

```bash
cd server && npx tsc --noEmit
git add server/src/routes/jobInteractions.ts server/src/index.ts
git commit -m "feat: add POST /api/job-interactions telemetry endpoint"
```

---

## Task 5: Client logging + dismiss control

**Files:**
- Create: `client/src/lib/jobTelemetry.ts`
- Modify: `client/src/pages/Jobs.tsx` (`JobCard` at line 297, feed render at lines 832/900/939)

**Interfaces:**
- Consumes: `POST /api/job-interactions` from Task 4; `api` from `client/src/lib/api.ts`
- Produces:
  - `function logImpressions(jobs: {id: string; relevance_score?: number}[], pool: "primary" | "cross_domain", offset?: number): void`
  - `function logJobEvent(event: "click" | "save" | "apply" | "dismiss", jobId: string, opts?: { position?: number; pool?: string; score?: number }): void`

- [ ] **Step 1: Write the telemetry helper**

Create `client/src/lib/jobTelemetry.ts`:

```ts
import { api } from "./api";

type Pool = "primary" | "cross_domain";

interface PendingEvent {
    job_id: string;
    event: string;
    position?: number;
    pool?: string;
    score?: number;
}

// Impressions arrive one-per-visible-card, so buffer and flush once
// rather than firing a request per job.
let buffer: PendingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_DELAY_MS = 2000;
const MAX_BUFFER = 200;   // matches MAX_BATCH server-side

function flush(): void {
    if (buffer.length === 0) return;

    const events = buffer;
    buffer = [];
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }

    // Fire-and-forget: telemetry failure must never disturb the UI.
    api.post("/api/job-interactions", { events }).catch(() => { /* ignored */ });
}

function enqueue(event: PendingEvent): void {
    buffer.push(event);

    if (buffer.length >= MAX_BUFFER) { flush(); return; }
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
        enqueue({ job_id: job.id, event: "impression", position: offset + i, pool, score: job.relevance_score });
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
```

- [ ] **Step 2: Log impressions when the feed renders**

In `client/src/pages/Jobs.tsx`, import the helper:

```ts
import { logImpressions, logJobEvent } from "@/lib/jobTelemetry";
```

Add an effect that fires when either pool changes. Place it after the `setPrimaryJobs`/`setCrossDomainJobs` state declarations:

```ts
  // Log one impression per job whenever a feed result set changes.
  // Keyed on the joined id list so a re-render with identical results
  // does not double-count.
  const primaryKey = primaryJobs.map(j => j.id).join(",");
  useEffect(() => {
    if (primaryJobs.length > 0) logImpressions(primaryJobs, "primary");
  }, [primaryKey]);

  const crossKey = crossDomainJobs.map(j => j.id).join(",");
  useEffect(() => {
    if (crossDomainJobs.length > 0) logImpressions(crossDomainJobs, "cross_domain");
  }, [crossKey]);
```

- [ ] **Step 3: Log click, save, and apply**

`JobCard` (line 297) already receives `onSave` and `onMatch`. Add an `onDismiss` prop and log inside the existing handlers.

Change the `JobCard` signature:

```tsx
export function JobCard({ job, userSkills, onSave, onMatch, onDismiss, userDomain, userDomainLabel }: {
  job: JobListing;
  userSkills: string[];
  onSave: (j: JobListing) => void;
  onMatch: (j: JobListing) => void;
  onDismiss?: (j: JobListing) => void;
  userDomain?: string;
  userDomainLabel?: string;
}) {
```

In the page-level handlers, log alongside the existing behaviour:

```ts
  const saveToTracked = async (job: JobListing) => {
    logJobEvent("save", job.id, { score: job.relevance_score });
    // …existing save logic unchanged…
  };
```

For the apply link — wherever `job.job_url` is opened — add:

```tsx
onClick={() => logJobEvent("apply", job.id, { score: job.relevance_score })}
```

`apply` here means "followed the link out", not a confirmed application. Do not rename it later without migrating the stored rows.

- [ ] **Step 4: Add the dismiss control**

This is the fastest honest signal of junk (spec §5a), so it must be a real affordance, not hidden. In `JobCard`, next to the existing save button (line 363):

```tsx
{onDismiss && (
  <button
    onClick={() => onDismiss(job)}
    className="text-gray-600 hover:text-red-500 transition-colors flex items-center justify-center p-2 rounded-lg hover:bg-red-500/10 outline-none"
    title="Not for me — hide this job"
    aria-label="Not for me"
  >
    ✕
  </button>
)}
```

Wire it at each of the three `JobCard` usages (lines 832, 900, 939):

```tsx
onDismiss={dismissJob}
```

And add the handler, which logs and hides locally:

```ts
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const dismissJob = (job: JobListing) => {
    logJobEvent("dismiss", job.id, { score: job.relevance_score });
    setDismissedIds(prev => new Set(prev).add(job.id));
  };
```

Filter dismissed jobs out at render: `.filter(j => !dismissedIds.has(j.id))` on each pool before mapping. Dismissal is session-local in this plan — persisting it is a Plan 3 concern and must not be added here.

- [ ] **Step 5: Verify in a browser**

```bash
cd server && npm run dev     # terminal 1
cd client && npm run dev     # terminal 2
```

Log in, open the Jobs page, then check:

1. DevTools Network → one `POST /api/job-interactions` about 2s after the feed renders, with an `events` array roughly the length of the visible job count. Response `202`.
2. Click a card's ✕ → the card disappears and a second request fires containing `{"event":"dismiss"}`.
3. Supabase: `select event, count(*) from job_interactions group by event;` → rows for `impression` and `dismiss`.
4. Console: no errors.

- [ ] **Step 6: Type-check, lint, and commit**

```bash
cd client && npx tsc --noEmit && npm run lint
git add client/src/lib/jobTelemetry.ts client/src/pages/Jobs.tsx
git commit -m "feat: log job impressions and interactions; add dismiss control"
```

---

## Task 6: Baseline junk-rate measurement — DECISION GATE

Produces the number that decides whether Plans 2–3 are worth writing. Per spec §5b.

**Files:**
- Create: `server/src/scripts/measureJunkRate.ts`
- Modify: `docs/superpowers/specs/2026-08-14-job-recommendation-precision-design.md` (record the result in §5b)

**Interfaces:**
- Consumes: `searchJobs` / the `/api/job-listings` route; `supabaseAdmin`
- Produces: a CSV for hand-labelling, and a recorded junk-rate figure

- [ ] **Step 1: Write the sampling script**

Create `server/src/scripts/measureJunkRate.ts`. It samples 10 real profiles, fetches each feed, and emits a CSV for hand-labelling — it does **not** judge relevance itself. A model labelling its own feed would just re-measure its own bias.

```ts
import "dotenv/config";
import "../config/validateEnv.js";
import { supabaseAdmin } from "../config/supabase.js";
import { writeFileSync } from "fs";

const API = process.env.ARIA_API_URL || "http://localhost:3001";
const TOKEN = process.env.ARIA_AUTH_TOKEN;   // a service/admin token
const PROFILES = 10;
const TOP_N = 20;

async function main() {
    const { data: profiles, error } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, skills, experience_years, seniority_level, preferred_locations")
        .not("skills", "eq", "{}")
        .limit(PROFILES);

    if (error) throw new Error(`Profile fetch failed: ${error.message}`);
    if (!profiles?.length) throw new Error("No profiles with skills found — cannot measure.");

    const rows: string[] = ["profile_idx,user_id,rank,pool,job_id,title,company,location,seniority,relevance,verdict"];

    for (const [idx, p] of profiles.entries()) {
        const res = await fetch(`${API}/api/job-listings?limit=${TOP_N}`, {
            headers: { Authorization: `Bearer ${TOKEN}` },
        });
        if (!res.ok) { console.warn(`profile ${idx}: HTTP ${res.status}`); continue; }

        const body: any = await res.json();
        const jobs = (body.primary_jobs || body.jobs || []).slice(0, TOP_N);

        jobs.forEach((j: any, rank: number) => {
            const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
            rows.push([
                idx, esc(p.user_id), rank, "primary", esc(j.id), esc(j.title),
                esc(j.company), esc(j.location), esc(j.seniority_level),
                j.relevance_score ?? "", "",     // verdict left BLANK for a human
            ].join(","));
        });
        console.log(`profile ${idx}: ${jobs.length} jobs`);
    }

    writeFileSync("junk-rate-sample.csv", rows.join("\n"), "utf-8");
    console.log(`\nWrote junk-rate-sample.csv — ${rows.length - 1} rows.`);
    console.log("Fill the `verdict` column with: apply | maybe | junk");
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run it**

```bash
cd server && npx tsx src/scripts/measureJunkRate.ts
```

Expected: `junk-rate-sample.csv` with up to 200 rows and a blank `verdict` column.

**Note:** the script fetches each feed with one admin token, so every row reflects that token's profile rather than each sampled user's. If per-user feeds are needed, either mint a token per sampled user or call the ranking services directly with each profile. Record which approach was used — it changes how the number should be read.

- [ ] **Step 3: Hand-label the sample**

A human fills `verdict` for every row: `apply` / `maybe` / `junk`. Judge as the *user in that profile* would, not as an engineer. Do not let a model fill this in — the whole point is an outside signal.

- [ ] **Step 4: Compute the junk rate**

```bash
cd server && node -e "
const rows = require('fs').readFileSync('junk-rate-sample.csv','utf8').trim().split('\n').slice(1);
const v = rows.map(r => r.split(',').pop().replace(/\"/g,'').trim()).filter(Boolean);
const junk = v.filter(x => x === 'junk').length;
console.log('labelled:', v.length, ' junk:', junk, ' rate:', (100*junk/v.length).toFixed(1) + '%');
"
```

- [ ] **Step 5: Record the result and apply the decision gate**

Write the figure into spec §5b, replacing "Record the number in this document when known", with the date, sample size, and the per-profile caveat from Step 2.

Then apply the gate:

| Junk rate | Action |
|---|---|
| **≥ 50%** | Precision confirmed as the binding constraint. Proceed — request Plan 2 (eligibility gate). |
| **25–50%** | Proceed with Plan 2, but scope supply work alongside it. |
| **≤ 10%** | **STOP.** Report to the user that the gate is not the right investment and that supply/ordering should be re-scoped. Do not start Plan 2. |

- [ ] **Step 6: Commit**

```bash
git add server/src/scripts/measureJunkRate.ts \
        docs/superpowers/specs/2026-08-14-job-recommendation-precision-design.md
git commit -m "feat: add junk-rate baseline script and record measurement"
```

Do not commit `junk-rate-sample.csv` — it contains `user_id` values. Add it to `.gitignore`.

---

## Definition of done

- [ ] `cd server && npm test` runs, with every failure either fixed or explicitly skipped with a reason
- [ ] `cd client && npm test` runs the 3 resume-editor suites
- [ ] `npx tsc --noEmit` clean in both packages
- [ ] `job_interactions` exists, has RLS enabled, and receives rows for `impression`, `dismiss`, `save`, and `apply` from real browser use
- [ ] The dismiss control is visible on every job card and hides the card
- [ ] The junk rate is measured and recorded in spec §5b
- [ ] The §5b decision gate has been applied and reported to the user

## Follow-on plans

- **Plan 2** — eligibility gate: spec steps 3–7 (`classifyJobDomainDetailed`, judgment fixtures, `eligibilityGate.ts`, preference migration + onboarding, wiring the gate and deleting the escape hatch). Write only after Task 6 clears the gate.
- **Plan 3** — feed honesty and ranking: spec steps 8–10 (supply widening, exclusion panel with per-veto relax toggles, `relevanceScorer` re-weighting, replacing the `chance` percentage with a band).
