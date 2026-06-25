# Aria multi-agent harness

A Claude Code harness wrapped *around* the JobSkill AI app so Claude (and its subagents) can **touch the running app**, not just read code. It has three pieces:

1. **MCP server** (`tools/aria-mcp/`) — exposes the app to Claude as `aria_*` tools that call the live HTTP API.
2. **Subagents** (`.claude/agents/`) — backend, frontend, docs, SRE — each scoped to its tools and domain.
3. **Skills / slash commands** (`.claude/commands/`) — `/aria-audit`, `/aria-onboarding`, `/aria-payments-check` — that orchestrate the subagents in parallel and synthesize a report.

```
You ──/aria-audit──▶ main thread
                      ├─▶ @agent-backend-agent ─┐
                      ├─▶ @agent-frontend-agent ─┤ (parallel, isolated context)
                      ├─▶ @agent-sre-agent ──────┤  each calls aria_* / Playwright
                      └─▶ @agent-docs-agent ─────┘
                                  │  (hard multi-layer bug? →)
                      └─▶ @agent-debugger-agent  (symptom→route→service→data, file:line)
                                  │
                      synthesized status report + TODO list
```

The subagents are **repo-aware**: each embeds the real architecture map (the live request paths, subsystem file locations, and the recurring failure traps) plus a debugging playbook, so they can trace complex cross-cutting bugs instead of giving generic advice. `@agent-debugger-agent` is the deep-debugging specialist for issues where the symptom is far from the cause.

## One-time setup

```bash
# 1. Install the MCP server's deps
cd tools/aria-mcp && npm install && cd ../..

# 2. (optional) Set a token so authed tools work. Get it from the browser:
#    log in to the app → DevTools console → localStorage.auth_token
export ARIA_AUTH_TOKEN="eyJhbGci..."
#    Override the API URL if not localhost:
export ARIA_API_URL="http://localhost:3001"
```

`.mcp.json` (repo root) registers the `aria` MCP server. The first time you open this repo in Claude Code, **approve the `aria` MCP server** when prompted (project-scoped servers require approval).

## Run the app, then the harness

The tools hit the **running** backend, so start it first:

```bash
cd server && npm run dev     # backend on :3001
cd client && npm run dev     # frontend on :5173 (separate terminal)
```

Then in Claude Code:

| Command | What it does |
|---|---|
| `/aria-audit` | Full end-to-end audit (all four subagents) → status report + TODO list |
| `/aria-audit jobs` | Same, biased toward the job-search area |
| `/aria-onboarding` | Verify signup → setup → resume → settings persistence |
| `/aria-onboarding implement` | …and propose fixes for broken steps |
| `/aria-payments-check` | Report Pricing/payment readiness (payments backend is not built yet) |

Call a subagent directly when you want just one lens:

```
@agent-backend-agent verify the job engine and resume scoring against the live app
@agent-frontend-agent walk the Resume page edit flow in the browser and report console errors
@agent-sre-agent run a health sweep and list reliability risks
@agent-docs-agent check the README feature matrix against what's actually shipped
```

## The aria_* tools

| Tool | Auth | Purpose |
|---|---|---|
| `aria_health` | no | Backend up? |
| `aria_check_endpoints` | optional | Probe key routes (401/403 = present, needs auth) |
| `aria_run_job_search` | optional | Run a real job search, sample results |
| `aria_check_settings_persistence` | yes | Confirm profile/preferences round-trip |
| `aria_get_resume_status` | yes | Confirm a parsed resume + ATS score exist |
| `aria_verify_payment_flow` | — | **Stub** — no payment routes yet |

Frontend flows use the **Playwright** MCP tools (from the installed `playwright` plugin) to drive a real browser.

## Headless / CI (no Claude Code)

- **Plain healthcheck** (no API key): `ARIA_API_URL=… node tools/aria-mcp/healthcheck.mjs` — exits non-zero if a critical check fails. Drop it in cron/CI.
- **Claude-powered nightly audit** (needs `ANTHROPIC_API_KEY`): `npm run audit` in `tools/aria-mcp` — Claude runs the sweep and prints a report. Built on the documented Anthropic Messages API tool runner. For a full Claude **Agent SDK** (`query()`/`createSdkMcpServer`) program instead, use the `agent-sdk-dev:new-sdk-app` skill, which scaffolds verified Agent-SDK code.

## Extending it

- **New tool:** add a `server.tool(...)` block in `tools/aria-mcp/src/index.mjs`, then grant it to the relevant subagent in `.claude/agents/*.md` (`mcp__aria__<tool>`).
- **New skill:** add a markdown file under `.claude/commands/` with a `description` frontmatter and a body that dispatches subagents.
- **Wire up payments:** add a real `POST /api/payments/checkout` route, then make `aria_verify_payment_flow` call it (replace the stub).

## Safety notes

- Tools are **read-only probes** of your API; they don't mutate data. Subagents are scoped with `tools:` frontmatter and instructed not to edit code — they propose changes for the main thread to apply.
- `ARIA_AUTH_TOKEN` is a real user token — keep it in your shell/secret store, not in committed files.
