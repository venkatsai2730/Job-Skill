# Job recommendation precision — design

**Date:** 2026-08-14
**Status:** Approved — implementation started
**Problem:** Junk in the job feed — jobs appear that the user would never consider.

---

## 1. Why the feed contains junk

Two independent causes, both mechanical. Neither is a tuning problem.

### 1.1 Constraints are averaged, so nothing can veto

`relevanceScorer.computeRelevanceScore` blends five signals into one scalar:

```
domain 0.32 + skills 0.26 + title 0.12 + location 0.20 + recency 0.10 = 1.0
MIN_PRIMARY_RELEVANCE = 0.20
```

A job in the wrong country scores `locationMatch = 0` and still reaches `0.80` — 4× the
primary-pool threshold. Location can discourage, never exclude. Same for seniority: nothing
stops a Principal Engineer role reaching a fresher.

A weighted sum cannot express "never". Every past attempt to fix this by moving a weight
was reverted, because moving a weight is the wrong instrument:

- `bb1b021 fix: filter non-tech/wrong-country jobs`
- `418dcbe fix: revert broken skills.ov filter + remove over-aggressive country filter`
- `15e4462 fix: bypass DB location filter for domain-aware users`

### 1.2 The relevance floor has an unconditional escape hatch

`server/src/routes/jobListings.ts:469-475`:

```js
let primaryFiltered = scoredPrimary.filter(j => (j.relevance_score || 0) >= MIN_PRIMARY_RELEVANCE); // 0.20
if (primaryFiltered.length < MIN_PRIMARY_JOBS) {                    // 50
    primaryFiltered = scoredPrimary.filter(j => (j.relevance_score || 0) >= RELAXED_PRIMARY_RELEVANCE); // 0.10
}
if (primaryFiltered.length < MIN_PRIMARY_JOBS) {
    primaryFiltered = scoredPrimary;        // floor abandoned entirely
}
```

When fewer than 50 jobs clear the relaxed `0.10` floor, the filter is dropped and **every**
scored job enters the primary feed. This fires hardest for niche domains and smaller cities —
the users most harmed by junk.

### 1.3 What is *not* the problem

There is no interaction/label data, so no model can be trained and no accuracy figure can be
measured. "100% accurate ranking" is therefore not just unreachable but unfalsifiable: the
ground truth (*would this user have applied, and been shortlisted?*) depends on facts absent
from the data — whether the req was filled, whether a referral existed.

What *can* be 100% correct is **constraint satisfaction**: never showing a job the user is
ineligible for or has ruled out. That is deterministic and testable without labels. This design
maximises that, and makes the remaining ranking transparent instead of falsely precise.

---

## 2. Architecture

One blended score becomes a four-stage pipeline. Each stage has a single responsibility and is
independently testable.

```
GET /api/job-listings
  │
  ├─ 1. candidate generation      (existing: searchJobs + MCP supplement)
  │
  ├─ 2. ELIGIBILITY GATE          ← NEW, deterministic, pre-scoring
  │      eligibilityGate.ts       hard vetoes; no thresholds, no scores
  │      ↓ eligible jobs only     vetoed jobs are counted, never ranked
  │
  ├─ 3. PREFERENCE RANKING        (relevanceScorer, constraints removed)
  │      soft signals only        → score + human-readable reasons
  │
  └─ 4. response                  primary / cross-domain / exclusion summary
```

### 2.1 Stage 2 — `server/src/services/eligibilityGate.ts` (new)

Pure function. No I/O, no thresholds, no relaxation logic.

```ts
export type VetoCode =
  | "location_ineligible"
  | "seniority_too_high"
  | "seniority_too_low"
  | "domain_mismatch"
  | "requirement_unmet";

export interface Veto {
  code: VetoCode;
  detail: string;        // user-facing: "Requires 10+ yrs; you have 2"
}

export interface EligibilityResult {
  eligible: boolean;
  vetoes: Veto[];        // all failures, not just the first
}

export function checkEligibility(
  profile: GateProfile,
  job: GateJob,
): EligibilityResult;
```

Returning **all** vetoes rather than short-circuiting is deliberate: the exclusion summary in
§2.4 and the eval harness in §5 both need the full reason set.

#### The four vetoes

| Veto | Rule | Inputs |
|---|---|---|
| **Location** | Job country ∉ user's eligible countries **and** job is not remote-and-remote-acceptable. Relocation willingness widens the eligible set. | `work_mode_pref`, `eligible_countries`, `will_relocate`, `preferred_locations` |
| **Seniority** | Veto if job level > user level + 1, or job level < user level − 1. Bands from `SENIORITY_ORDER` in `shortlistingChance.ts`. | `seniority_level`, `experience_years` |
| **Domain** | Veto only when the classifier is **confident** the job is a different domain and not adjacent (`getRelatedDomains`). Low confidence → no veto, demote in stage 3. | `classifyJobDomain` (extended, §2.2) |
| **Requirement** | Veto on categorical bars parsed from the JD: doctorate required, security clearance, years-required exceeding user's by > 3, sponsorship unavailable when needed. Only fires on high-confidence regex hits. | JD text, `experience_years`, `education`, `needs_sponsorship` |

Seniority uses ±1 rather than an absolute floor so a fresher still sees "mid" roles they can
stretch into, while Principal roles are excluded.

### 2.2 Prerequisite — `classifyJobDomain` must report confidence

The domain veto is unimplementable against today's signature:

```ts
export function classifyJobDomain(title, description, skills): JobDomain
```

Two problems:

1. **No confidence.** A veto needs to distinguish a title-pattern match (`Step 1`, reliable)
   from a keyword-count tiebreak (`Step 2`, weak). Vetoing on the latter would silently hide
   good jobs.
2. **`generic-fresher` is overloaded.** It is returned both for a non-tech role
   (`jobDomainClassifier.ts:209`, the tech-title gate) and for a genuine general/fresher tech
   role (`JOB_DOMAIN_LABELS`). These need opposite treatment: the first is a hard veto, the
   second must never be vetoed.

Change the return type, keeping the current function as a thin wrapper so existing callers
(`jobListings.ts`, `relevanceScorer`) keep compiling:

```ts
export interface DomainClassification {
  domain: JobDomain;
  confidence: "high" | "low";   // high = title pattern; low = keyword inference
  isTech: boolean;              // false = failed the tech-title gate
}
export function classifyJobDomainDetailed(title, description, skills): DomainClassification;
```

Veto rule: `isTech === false` → veto. `confidence === "high"` and domain not in
`{user domain} ∪ getRelatedDomains(user domain)` → veto. Otherwise no veto.

### 2.3 Stage 2 inputs — preference intake

The gate needs four facts `user_profiles` does not store. Migration
`supabase/migrations/20260814000000_user_job_preferences.sql`:

| Column | Type | Feeds |
|---|---|---|
| `work_mode_pref` | `TEXT[]` — `onsite` / `hybrid` / `remote` | Location veto |
| `eligible_countries` | `TEXT[]` — ISO codes, default `{IN}` | Location veto |
| `will_relocate` | `BOOLEAN DEFAULT false` | Location veto |
| `needs_sponsorship` | `BOOLEAN DEFAULT false` | Requirement veto |

Collected by a step in the existing onboarding flow — six questions, each mapped to exactly one
veto. No question is added that does not drive a filter.

Because six questions is real signup friction, the step is **skippable**, and every column has a
safe default that makes its veto inert rather than aggressive (`eligible_countries = {IN}` from
the résumé's inferred country; `will_relocate = false` only narrows once `eligible_countries`
is known). A skipped intake degrades to today's behaviour minus the escape hatch — never to an
empty feed.

Existing columns already cover the rest: `skills`, `experience_years`, `education`,
`current_role`, `target_roles`, `preferred_locations`, `seniority_level`.

### 2.4 Stage 3 — ranking, with constraints removed

`relevanceScorer` keeps its weighted-sum shape but scores only *preferences*. `location` and
`domain` stop being weights and become gate concerns; their weight redistributes:

| Signal | Was | Now | Why |
|---|---|---|---|
| `skills` | 0.26 | 0.40 | Primary preference signal once constraints are gated |
| `title` | 0.12 | 0.25 | Proximity to `target_roles` / `current_role` |
| `recency` | 0.10 | 0.20 | Fresh postings are actionable |
| `domain` | 0.32 | 0.15 | Adjacent-domain and low-confidence demotion only |
| `location` | 0.20 | — | Moved entirely to the gate |

The four remaining weights sum to `1.00`, preserving the invariant asserted in
`RELEVANCE_WEIGHTS`. City preference does **not** re-enter as a weight: once the gate has
established the country is eligible, a same-city match applies as a final tiebreak between jobs
of equal score, outside the weighted sum.

These values are a starting point, to be moved only with §5 evidence.

**`selection_chance` becomes a band, not a percentage.** `estimateShortlistingChance` currently
emits `1–99%` from five hand-chosen constants and the Jobs page presents it as a probability.
That is an unsupportable claim to put in front of a job seeker making real decisions, and it is
the single highest-risk output in the product. Replace the number with the existing
`ShortlistBand` plus concrete reasons:

> **Strong match** — 4 of 6 required skills · your city · posted 2 days ago
> Missing: Kubernetes, Terraform

The `chance` field is removed from the API response, not merely hidden in the UI.

### 2.5 Stage 4 — thin-feed policy

Vetoes will sometimes leave few jobs. Order of response:

1. **Widen supply first.** Under 10 eligible jobs → targeted MCP scrape for the user's domain
   and city, then re-gate. Extends the existing stage-3 supplement
   (`jobListings.ts:215-270`) with an eligibility-aware trigger.
2. **Still thin → tell the truth.** Show the honest set with an exclusion breakdown:
   *"7 roles match. 340 excluded: 210 wrong country · 90 too senior · 40 requirements unmet"* —
   each row a one-tap toggle to relax that specific veto for this session.
3. **Never silently relax.** The `primaryFiltered = scoredPrimary` escape hatch is deleted.

Relaxation becomes an explicit user action instead of a hidden server fallback. This is the
difference between the old country filter and this design: the old one was reverted because
users saw an empty feed with no explanation and no recourse.

---

## 3. Data flow

```
profile + résumé ──┐
                   ├─▶ candidate pool (DB + MCP supplement)
job_listings ──────┘            │
                                ▼
                    checkEligibility(profile, job)  ── vetoed ──▶ exclusion counters
                                │ eligible                            │
                                ▼                                     │
                    computeRelevanceScore (soft signals)              │
                                │                                     │
                                ▼                                     ▼
                    primary / cross-domain split       meta.exclusions { code: count }
```

Response shape adds `meta.exclusions`; `primary_jobs` / `cross_domain_jobs` are unchanged, so
the Jobs page keeps working before its exclusion panel ships.

---

## 4. Error handling

| Failure | Behaviour |
|---|---|
| Profile missing / empty | Gate is inert (no vetoes) — anonymous and new users see today's behaviour. Never an empty feed from absent data. |
| Job missing `country` / `seniority_level` / `job_domain` | Missing field cannot veto. Absence of data is never evidence of ineligibility. |
| Classifier low confidence | No veto; stage-3 demotion only. |
| JD requirement regex ambiguous | No veto. Requirement veto fires only on high-confidence matches. |
| Scrape widening fails | Fall through to §2.5 step 2 with whatever is eligible. |

The rule throughout: **uncertainty demotes, it never excludes.** A wrong veto is invisible to
the user and destroys trust silently; a wrong ranking is visible and recoverable.

---

## 5. Evaluation harness — the part that stops the revert cycle

Without this, every future weight change is another guess, and the `skills.ov` revert repeats.

`server/src/__tests__/fixtures/judgments.json` — ~50 hand-labelled tuples:

```json
{
  "profile": { "domain": "data-science-ml", "seniority": "entry",
               "experience_years": 1.5, "eligible_countries": ["IN"],
               "skills": ["python", "pandas", "sql"] },
  "job": { "title": "Principal ML Engineer", "country": "DE", "seniority_level": "lead" },
  "verdict": "must_not_show",
  "because": "wrong country + 3 levels too senior"
}
```

Verdicts: `must_show` / `may_show` / `must_not_show`.

Two test suites:

- **`eligibilityGate.test.ts`** — every `must_not_show` case IS vetoed, every `must_show` case is
  NOT vetoed, with the expected `VetoCode`. This is a correctness assertion, so it must be
  **100% green** — the one place the "100%" goal is real and enforceable.
- **`ranking.test.ts`** — reports precision@10 over `may_show` orderings. A *scoreboard*, not a
  pass/fail gate; weight changes must not regress it.

Building the 50 fixtures is the main manual cost of this design and the highest-leverage hour
in it. Cases must include the reverted regressions (wrong country, wrong field, over-senior) so
they can never silently return.

**Prerequisite:** the test suite is currently deleted from the working tree (7 spec files,
`vitest.config.ts`, and both `test` scripts). Restoring vitest is step 0 — none of this is
verifiable otherwise.

---

## 5a. Interaction instrumentation — so satisfaction becomes measurable

Everything above is verifiable against *our own* judgment. None of it answers "are users
satisfied," because nothing in the app records what users do with a recommendation.

`user_activity` is a **display log**, not an interaction log: it stores `resume_upload`,
`ats_score`, `job_search` to render the dashboard feed. No row anywhere says *"job X was shown
to user Y, and they clicked / saved / applied / ignored it."*

New table, `supabase/migrations/20260814000100_job_interactions.sql`:

```sql
CREATE TABLE IF NOT EXISTS job_interactions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     TEXT NOT NULL,
    job_id      TEXT NOT NULL,
    event       TEXT NOT NULL,     -- 'impression' | 'click' | 'save' | 'apply' | 'dismiss'
    position    INT,               -- rank in the feed when shown (impression/click)
    pool        TEXT,              -- 'primary' | 'cross_domain'
    score       NUMERIC,           -- relevance_score at serve time
    created_at  TIMESTAMP DEFAULT now()
);
```

Impressions batch from the client on feed render (one row per visible job, not per fetch) to
avoid write amplification. `dismiss` needs a UI affordance — a per-card "not for me" control —
which doubles as the fastest honest signal of junk.

This unlocks three things nothing else can:

1. **A real junk-rate metric** — dismiss and zero-click rates per veto category, replacing our
   guess about which failure mode dominates.
2. **A/B capability** — serve the gate to half of users and compare click/apply rates, rather
   than asserting the gate is better.
3. **The labels every `TODO` assumes** — `(user, job, outcome)` tuples. At current traffic,
   8–12 weeks of logging makes the LightGBM ranker in §7 trainable and, more importantly,
   *provable*.

**Privacy:** this is behavioural data about identifiable users under the DPDP Act. Store
`user_id` only (never résumé content or contact fields in this table), include it in the
retention policy, and expose it to account deletion. No third-party analytics for these events.

## 5b. Baseline validation — before building the gate

The premise of this design — that junk dominates — is inferred from the commit log and a
one-line diagnosis. It has never been measured. Measuring it is half a day and determines
whether the gate is worth eight steps.

Take 10 real user profiles, pull each one's current feed, hand-label the top 20 jobs
*would apply / would not apply*. Record the junk rate.

| Result | Reading |
|---|---|
| ≥ 50% junk | Precision is the binding constraint. Build the gate as specified. |
| ~25–50% | Build the gate, but expect supply work to matter as much. |
| ≤ 10% | Dissatisfaction is coming from recall/supply or ordering. **Stop and re-scope** — the gate would buy very little. |

Record the number in this document when known; it is also the before-figure the gate is measured
against.

**Known risk this exposes:** the gate shrinks the feed by construction. A user going from ~200
noisy jobs to ~12 clean ones may read that as "this app has no jobs" and churn. Precision and
perceived value can move in opposite directions, which is why §2.5's supply widening ships
alongside the gate rather than after it.

## 6. Build sequence

Each step ships independently and leaves the app working.

Instrumentation goes first: it is cheap, it starts accumulating labels immediately, and every
later step's value is judged with it. The baseline measurement follows, because it can veto the
rest of the plan.

| # | Step | Verification |
|---|---|---|
| 0 | Restore vitest + the deleted test suite | `npm test` runs green |
| 1 | `job_interactions` table + logging (impression/click/save/apply/dismiss) + dismiss control | Rows land for a real feed render and a click |
| 2 | **Baseline junk-rate measurement** (§5b, 10 profiles × top 20) | Number recorded in §5b; **decision gate — a result ≤ 10% stops the plan** |
| 3 | `classifyJobDomainDetailed` — confidence + `isTech`; old fn becomes a wrapper | Existing classifier tests still pass |
| 4 | Judgment fixtures (~50 cases) | Reviewed by hand |
| 5 | `eligibilityGate.ts` + `eligibilityGate.test.ts` | Gate suite 100% green |
| 6 | Preference migration + onboarding step | Settings round-trip persists all 4 columns |
| 7 | Wire gate into `jobListings.ts`; **delete the escape hatch** | Feed contains zero `must_not_show` fixtures |
| 8 | §2.5 supply widening + exclusion summary panel + per-veto relax toggles | Thin-feed case shows counts, not an empty page |
| 9 | Re-weight `relevanceScorer`; `ranking.test.ts` baseline | precision@10 recorded |
| 10 | Replace `chance` % with band + reasons (API + Jobs page) | No `chance` field in response |

Steps 0–2 make the problem measurable and can change the plan. Steps 3–7 deliver the precision
win. Steps 8–10 keep the feed usable and honest once it is smaller.

Step 8 ships with step 7, not after it — the gate must not reach users without the supply
widening and exclusion messaging that make a thinner feed legible.

---

## 7. What this explicitly does not do

- **No ML model, no embeddings, no training data.** Existing signals, reorganised. The gate is
  rules; the ranker stays a weighted sum.
- **No claim of accuracy.** Constraint correctness is asserted and tested; ranking quality is
  measured relatively against a fixed scoreboard and never expressed as a probability.
- **No candidate-generation rewrite.** Scraping and `searchJobs` are unchanged apart from the
  eligibility-aware widening trigger in §2.5.

The eval harness is what makes a learned ranker viable later: once tracked applications
accumulate labels, a LightGBM ranker can replace `computeRelevanceScore` behind the same
signature and be *proven* better against the same scoreboard — which is what the existing
`TODO` comments assume but cannot currently do.
