---
description: Validate (and, on request, improve) the new-user onboarding flow — signup → guided setup → resume upload → settings/preferences persistence.
argument-hint: "[optional: 'verify' (default) or 'implement']"
---

Validate the JobSkill AI ("Aria") onboarding flow end to end. Mode from the user: **$ARGUMENTS** (default = `verify`, read-only).

Start by calling `mcp__aria__aria_health`. If the app is down, ask the user to start it and stop.

Dispatch in parallel:

1. **frontend-agent** — "Walk the new-user path in the browser via Playwright: Auth/signup → Dashboard → Resume upload → Settings (target role, locations, preferences). Snapshot each step, capture console/network errors, and report where the flow breaks or is confusing. Cite the page components."
2. **backend-agent** — "Confirm onboarding data persists: after profile/settings are set, use `aria_check_settings_persistence` and `aria_get_resume_status` to verify the fields round-trip to the DB. Trace the persistence path (routes/profile.ts, routes/resume.ts) and report any field that doesn't save."

Then synthesize: a step-by-step **onboarding scorecard** (✅/⚠️/❌ per step) with evidence and the exact fix for any broken step.

If mode is `implement`: after the verification report, propose a concrete change set (files + edits) to fix the broken/confusing steps, and ask the user to approve before the main thread applies them. Never edit code from inside a subagent.
