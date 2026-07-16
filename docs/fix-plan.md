# Audit Fix Plan — JobSkill AI (Aria)

## Global Constraints

- Working directory: `C:/Users/21bec/OneDrive/Desktop/Job_skill_dark`
- Branch: `fix/audit-findings`
- TypeScript strict: preserve existing TS patterns; no `any` widening without reason
- No new dependencies unless strictly necessary (exception: rate-limit already installed)
- Do NOT break anonymous job browsing — jobListings route must work without a token
- Do NOT break existing API response shapes for the frontend
- Each task must commit its changes with a clear message
- Test coverage: run existing vitest suites after each task; do not break passing tests

## MERGE_BASE
8eac965

---

## Task 1 — Security: IDOR on job-listings + Logout bugs + Client JWT decode

**Files:**
- `server/src/routes/jobListings.ts`
- `server/src/routes/auth.ts`
- `server/src/middleware/auth.ts`
- `client/src/pages/Jobs.tsx`

**What to do:**

### 1a. Optional auth middleware
Add an `optionalAuthToken` middleware in `server/src/middleware/auth.ts`:
```typescript
export const optionalAuthToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) { next(); return; }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };
        req.user = decoded;
    } catch { /* invalid token — treat as anonymous */ }
    next();
};
```

### 1b. jobListings.ts — use JWT identity, not query param
- Apply `optionalAuthToken` middleware to the GET `/` route (not the whole router)
- Replace `req.query.user_id` with `req.user?.userId` everywhere in the route handler
- Remove `user_id` from the query destructure
- The `hasUser` check becomes `!!req.user?.userId`
- Keep all other logic identical — authenticated users still get personalized results, anonymous still get generic

### 1c. auth.ts — scope logout to requesting user
Replace the logout handler body:
```typescript
router.post("/logout", async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
                await supabaseAdmin.auth.admin.signOut(decoded.userId);
            } catch { /* invalid token — still respond success */ }
        }
        res.json({ message: "Signed out successfully" });
    } catch (error: any) {
        console.error("Logout error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
```

### 1d. client Jobs.tsx — read userId from useAuth
- Import `useAuth` from `@/contexts/AuthContext`
- Replace the `getUserId()` function with `const { user } = useAuth();` at the top of the component
- Replace every `getUserId()` call with `user?.id`
- Remove the `getUserId` function entirely

**Commit message:** `fix(security): scope job-listings to JWT identity, fix global logout`

---

## Task 2 — Data Loss: Resume DELETE + ai-edit + PUT/sections update wrong rows

**Files:**
- `server/src/routes/resume.ts`

**What to do:**

### 2a. DELETE /api/resume — delete only the fetched row
Current code fetches `.limit(1).single()` to get `storage_path` but then deletes `.eq("user_id", ...)` (all rows).

Fix: change the DB delete to use `id`:
```typescript
// existing select — add id to the select:
const { data: existing, error: fetchError } = await supabaseAdmin
    .from("resumes")
    .select("id, storage_path")
    .eq("user_id", req.user!.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
// ...
// change delete to:
const { error: dbError } = await supabaseAdmin
    .from("resumes")
    .delete()
    .eq("id", existing.id);
```

### 2b. POST /ai-edit — update only the latest row, not all
Find this block (around line 1279):
```typescript
const { data: row } = await supabaseAdmin
    .from("resumes")
    .select("parsed_data")
    .eq("user_id", req.user!.userId)
    .limit(1)
    .single();
```
Change to also select `id`, and use it in the update:
```typescript
const { data: row } = await supabaseAdmin
    .from("resumes")
    .select("id, parsed_data")
    .eq("user_id", req.user!.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
```
Then change the update at the bottom of the try block:
```typescript
await supabaseAdmin
    .from("resumes")
    .update({ parsed_data: { ... } })
    .eq("id", row.id);   // ← was .eq("user_id", req.user!.userId)
```

### 2c. PUT /sections — same fix
Find the sections save block (around line 1318):
```typescript
const { data: row } = await supabaseAdmin
    .from("resumes")
    .select("parsed_data")
    .eq("user_id", req.user!.userId)
    .limit(1)
    .single();
```
Add `id` to select, add `.order("created_at", { ascending: false })`, change update to `.eq("id", row.id)`.

Also fix the storage cleanup: when DELETE removes the row by id, any other resume rows for the user are NOT deleted, so old files in storage orphan. Add a note comment but do NOT attempt a full cleanup sweep in this task (out of scope).

**Commit message:** `fix(data): delete/update resumes by id to preserve history`

---

## Task 3 — Data Loss: preferred_locations stores company name

**Files:**
- `server/src/routes/resume.ts` (the `upsertUserProfileFromResume` function, around line 667)

**What to do:**

The current code:
```typescript
const preferredLocations = sections.experience?.[0]?.company
    ? [sections.experience?.[0]?.company]
    : [];
```

Replace with:
```typescript
// Use resume's location field (from contact header) as preferred location
const preferredLocations = sections.location
    ? [sections.location]
    : [];
```

**Commit message:** `fix(profile): store resume contact location as preferred_location, not company`

---

## Task 4 — Logic: TypeScript duplicate property key in chatService.ts

**Files:**
- `server/src/services/chatService.ts`

**What to do:**

At line 319, there is a duplicate property key in an object literal. Read the file around that area to find the duplicate key and remove or rename the second occurrence. The fix must preserve the intended value (keep the more complete/correct version of the property).

Run `npx tsc --noEmit` in the server directory after the fix to confirm the error is gone.

**Commit message:** `fix(types): remove duplicate property key in chatService system prompts`

---

## Task 5 — Logic: PDF Parse using wrong constructor API

**Files:**
- `server/src/routes/resume.ts` (around line 869)

**What to do:**

Current (wrong):
```typescript
import { PDFParse } from "pdf-parse";
// ...
const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
const textResult = await parser.getText();
const rawText = textResult.text || "";
```

`pdf-parse` exports a default function, not a class. The correct usage is:
```typescript
import pdfParse from "pdf-parse";
// ...
const pdfResult = await pdfParse(fileBuffer);
const rawText = pdfResult.text || "";
```

Check the current import at the top of the file. If it currently imports `{ PDFParse }`, change it to `import pdfParse from "pdf-parse"`. If it already imports both ways, remove the wrong one.

After the fix, verify the surrounding try/catch still works — the `pdfResult` replaces both the `parser` construction and the `parser.getText()` call.

**Commit message:** `fix(resume): use correct pdf-parse function API instead of class constructor`

---

## Task 6 — Logic: Deduplicate computeTitleSimilarity across services

**Files:**
- `server/src/services/jobRankingService.ts`
- `server/src/services/relevanceScorer.ts`

**What to do:**

`computeTitleSimilarity` exists in both files with different return ranges:
- `relevanceScorer.ts` returns 0.0–1.0
- `jobRankingService.ts` returns 0–100

In `jobRankingService.ts`:
1. Remove the local `computeTitleSimilarity` function definition entirely
2. Import `computeTitleSimilarity` from `../services/relevanceScorer.js`
3. Find every call site in `jobRankingService.ts` that uses the result (variable `titleMatch`)
4. Multiply the result by 100 at each call site: `const titleMatch = computeTitleSimilarity(userTitle, job.title) * 100;`
   (this keeps downstream scoring math identical since it was previously 0-100)

Verify: search for all uses of `titleMatch` in `jobRankingService.ts` to confirm no other scaling is applied.

**Commit message:** `refactor(scoring): deduplicate computeTitleSimilarity, import from relevanceScorer`

---

## Task 7 — Logic: MCP Sync concurrency guard + domain persistence

**Files:**
- `server/src/mcp/jobSyncCron.ts`

**What to do:**

### 7a. Concurrency guard
Add at module level (before `syncJobsViaMCP`):
```typescript
let syncRunning = false;
```

At the start of `syncJobsViaMCP`:
```typescript
export async function syncJobsViaMCP(): Promise<{ total: number; errors: number }> {
    if (syncRunning) {
        console.log("[MCP-Sync] Previous sync still running — skipping.");
        return { total: 0, errors: 0 };
    }
    syncRunning = true;
    try {
        // ... existing body ...
    } finally {
        syncRunning = false;
    }
}
```

### 7b. Persist job_domain at ingest time
Import `classifyJobDomain` from `../services/jobDomainClassifier.js` at the top of the file.

In the `upsertPayload` block (inside the loop over `rawJob`), add:
```typescript
job_domain: classifyJobDomain(title, description, skills),
```
This goes in the base `upsertPayload` (not inside the `if (!migrationMissing)` block, since `job_domain` is a core column). If `migrationMissing` triggers, also add it to the base retry payload.

**Commit message:** `fix(cron): add concurrency guard + persist job_domain at ingest`

---

## Task 8 — Logic: Remove duplicated domain-detection regex in jobListings.ts

**Files:**
- `server/src/routes/jobListings.ts`

**What to do:**

Lines 147–162 contain inline regex-based domain detection that duplicates `classifyJobDomain()`. The `classifyJobDomain` import already exists at the top of the file.

Replace this entire block:
```typescript
if (/\b(data\s*scien|machine\s*learn|...).test(roleAndSummary)) {
    userPrimaryDomain = "data-science-ml";
} else if (/.../) { ... }
// ... all the if/else chain ...
```

With a single call:
```typescript
// Use the canonical domain classifier (summary gives extra context)
const summary = pd?.sections?.summary || "";
userPrimaryDomain = classifyJobDomain(userCurrentRole, summary, userSkills) as string;
```

After the replacement, verify:
- `userPrimaryDomain` is still set as a string (the classifier returns a `JobDomain` which is a string union)
- The code that follows — `if (userPrimaryDomain && JOB_DOMAIN_VALUES.includes(...))` — still works identically

Do NOT change anything else in this file in this task.

**Commit message:** `refactor(jobs): replace inline domain regex with classifyJobDomain()`

---

## Task 9 — Reliability: Eliminate double resume DB fetch in job ranking

**Files:**
- `server/src/services/jobRankingService.ts`
- `server/src/routes/jobListings.ts`

**What to do:**

In `jobListings.ts`, by the time `rankJobsForUser` is called, the route handler already has:
- `userSkills` (array of strings)
- `userExperienceYears` (number)

`rankJobsForUser` in `jobRankingService.ts` re-fetches the resume from Supabase to extract these same values. This is the double fetch.

**Fix:**
1. In `jobListings.ts`, change the `rankJobsForUser` call to `rankJobsForUserWithSkills` (which already exists and accepts pre-loaded skills):
```typescript
rankedJobs = await rankJobsForUserWithSkills(
    userId,
    allJobs,
    userSkills,
    userExperienceYears ?? 0,
    allJobs.length
);
```
2. Remove the `rankJobsForUser` import from `jobListings.ts` if it's no longer used there.
3. `getUserSkillsForMatching` call (line ~344) still fetches from DB — this is for `userSkillsForResponse` on the legacy response. Keep it but move it inside the `if (!user_id || !userDomain)` legacy branch since authenticated domain-aware users don't need it (their skills are already in `userSkills`).

**Commit message:** `perf(jobs): eliminate double resume DB fetch by using rankJobsForUserWithSkills`

---

## Task 10 — Reliability: Fix fragile JSON regex in score-with-job

**Files:**
- `server/src/routes/resume.ts` (around line 1008–1016)

**What to do:**

Current fragile code:
```typescript
const jsonStr = aiResponse.reply.match(/\{[\s\S]*\}/)?.[0] || aiResponse.reply;
gapAnalysis = JSON.parse(jsonStr);
```

Replace with a more robust extractor that:
1. Strips markdown code fences first
2. Then tries to parse the whole string
3. Falls back to the greedy regex only as a last resort

```typescript
let jsonStr = aiResponse.reply
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
try {
    gapAnalysis = JSON.parse(jsonStr);
} catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) {
        console.error("Failed to parse Gemini JD match response:", aiResponse.reply);
        res.status(500).json({ error: "Failed to parse AI response. Please try again." });
        return;
    }
    gapAnalysis = JSON.parse(match[0]);
}
```

This mirrors the same approach already used in the `/ai-edit` handler.

**Commit message:** `fix(resume): use robust JSON extraction for score-with-job AI response`

---

## Task 11 — Reliability: CORS multiple origins + rate limiting on AI endpoints

**Files:**
- `server/src/index.ts`
- `server/src/routes/resume.ts`

**What to do:**

### 11a. CORS — allow multiple origins
Replace:
```typescript
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
```
With:
```typescript
const ALLOWED_ORIGINS = [
    process.env.CLIENT_URL || "http://localhost:5173",
    "http://localhost:5173",
    "http://localhost:3000",
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));
```

### 11b. Rate limit AI resume endpoints
`express-rate-limit` is already installed (used in chat.ts). In `resume.ts`, add a limiter for AI-heavy endpoints:

At the top of `resume.ts` (after imports):
```typescript
import rateLimit from "express-rate-limit";

const aiResumeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    message: { error: "Too many AI requests. Please wait a moment." },
    keyGenerator: (req: any) => req.user?.userId || req.ip,
});
```

Apply to the AI-heavy routes:
- `router.post("/ai-edit", aiResumeLimiter, async ...)`
- `router.post("/score-with-job", aiResumeLimiter, async ...)`
- `router.post("/create-new", aiResumeLimiter, async ...)`
- `router.post("/compile-latex", aiResumeLimiter, async ...)`

**Commit message:** `fix(security): CORS multi-origin support + rate limit AI resume endpoints`

---

## Task 12 — UX: Remove misleading "Drop jobs here" drag-and-drop hint

**Files:**
- `client/src/pages/Jobs.tsx`

**What to do:**

Line 1033 renders:
```tsx
<div className="border border-dashed border-border rounded-2xl p-6 text-center text-gray-400 text-[13px] font-medium flex items-center justify-center min-h-[120px]">Drop jobs here</div>
```

Since drag-and-drop is not implemented, replace the text with a neutral empty-state message:
```tsx
<div className="border border-dashed border-border rounded-2xl p-6 text-center text-gray-400 text-[13px] font-medium flex items-center justify-center min-h-[120px]">No jobs in this column yet</div>
```

**Commit message:** `fix(ui): replace misleading drag-and-drop hint with neutral empty-state text`

---

## Task 13 — UX: Raise LaTeX rawText cap to match PDF + fix AuthContext deps

**Files:**
- `server/src/routes/resume.ts`
- `client/src/contexts/AuthContext.tsx`

**What to do:**

### 13a. LaTeX rawText cap
Find (around line 963):
```typescript
rawText: rawText.substring(0, 5000),
```
Change to:
```typescript
rawText: rawText.substring(0, 20000),
```

### 13b. AuthContext stale closure
In `AuthContext.tsx`, the `useEffect` for `auth_error` event uses `signOut` without listing it in deps. Since `signOut` is stable (defined inline and doesn't change), the fix is to wrap it in `useCallback`:

1. Import `useCallback` from react (add to existing import)
2. Wrap `signOut`:
```typescript
const signOut = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (e) {
      console.error("Failed to sign out from server", e);
    }
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
}, []);
```
3. Add `signOut` to the auth_error useEffect deps: `}, [signOut]);`

**Commit message:** `fix(ux): raise LaTeX rawText cap to 20000 + fix AuthContext stale closure`

---

## Task 14 — Scoring: Consolidate dual shortlisting chance scorers

**Files:**
- `server/src/routes/jobListings.ts`

**What to do:**

Currently, for each authenticated job, the route computes:
- `shortlisting_chance` / `shortlisting_band` / `shortlisting_reason` from `estimateShortlistingChance()` (set on enrichedJob)
- `selection_chance` / `selection_reason` from `computeSelectionChance()` inside `rankJobsForUser()` (comes in via `finalJobs`)

In the `enrichedJob` object (around line 441), add aliases so the frontend always sees consistent field names regardless of which path generated them:
```typescript
const enrichedJob = {
    ...job,
    job_domain: jobDomain,
    job_domain_label: JOB_DOMAIN_LABELS[jobDomain] || jobDomain,
    relevance_score: relevanceScore,
    matched_skills: matchedSkills.length > 0 ? matchedSkills : (job.matched_skills || []),
    skill_gap: skillGap.length > 0 ? skillGap : (job.skill_gap || []),
    shortlisting_chance: shortlist.chance,
    shortlisting_band: shortlist.band,
    shortlisting_reason: shortlist.reason,
    // Alias to selection_chance so frontend components that read either field work
    selection_chance: shortlist.chance,
    selection_reason: shortlist.reason,
    domain_match: domainMatch,
};
```

This makes `estimateShortlistingChance()` the single source of truth for authenticated domain-aware responses. The `selection_chance` from `rankJobsForUser` still exists on the legacy path — do NOT remove it there.

**Commit message:** `fix(scoring): alias shortlisting_chance to selection_chance for consistency`

---
