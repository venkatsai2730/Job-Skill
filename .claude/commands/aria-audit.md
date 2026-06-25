---
description: End-to-end audit of the Aria app using the backend/frontend/docs/SRE subagents in parallel, synthesized into one status report + TODO list.
argument-hint: "[optional focus area, e.g. 'jobs' or 'resume edit']"
---

Run a full end-to-end audit of the JobSkill AI ("Aria") app. Optional focus from the user: **$ARGUMENTS** (if empty, audit everything).

First, sanity-check the app is reachable by calling the `mcp__aria__aria_health` tool. If the backend is down, tell the user to run `cd server && npm run dev` (and the client) and stop — the audit needs a live app.

Then dispatch these subagents **in parallel** (one Task call each, in a single message) with focused goals:

1. **backend-agent** — "Verify API routes, the job engine, resume scoring, settings persistence, and auth using the aria_* tools. Report status codes and any broken route with file:line + fix."
2. **frontend-agent** — "Exercise each main page's core flow (Auth → Dashboard → Jobs → Resume → Settings) in the browser via Playwright. Capture console/network errors. Report pass/fail per page with evidence."
3. **sre-agent** — "Run a health sweep (health, endpoints, job pipeline), review crons/error-handling/env validation, and list the top reliability risks + alert recommendations."
4. **docs-agent** — "Compare README/CLAUDE.md/feature-matrix against actual routes and pages; report doc drift and the corrected feature matrix."

If the user gave a focus area, bias every subagent toward it but still do a baseline health check.

If any subagent surfaces a hard, multi-layer bug (symptom far from cause, spanning client + server), dispatch the **debugger-agent** on it: "Find the true root cause of <bug> — reproduce it against the live app, trace symptom → route → service → data/scorer with file:line, and propose a minimal fix."

When all subagents return, **synthesize** their summaries into a single report:
- **🟢/🟡/🔴 overall health**
- **Per-area findings** (backend / frontend / reliability / docs), each with evidence
- **Prioritized TODO list** — concrete, ordered by severity, each item naming the file(s) to change

Do not apply fixes in this command — it is read-only analysis. End by asking the user which TODO items to tackle.
