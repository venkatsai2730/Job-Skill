# Aria MCP server

A small [Model Context Protocol](https://modelcontextprotocol.io) server that lets Claude (and Claude subagents) **touch the running JobSkill AI app** through tools, instead of only reading code.

It calls the app's HTTP API — so the backend must be running.

## Install

```bash
cd tools/aria-mcp
npm install
```

## Configure (env)

| Var | Default | Purpose |
|-----|---------|---------|
| `ARIA_API_URL` | `http://localhost:3001` | Backend base URL |
| `ARIA_AUTH_TOKEN` | _(empty)_ | Bearer token for authenticated routes (most `/api/*`). Get one by logging into the app and copying `localStorage.auth_token`. |

These are wired in the repo-root `.mcp.json`, which Claude Code reads automatically. Set them in your shell before launching Claude Code, e.g.:

```bash
export ARIA_AUTH_TOKEN="eyJhbGci..."   # optional, enables authed tools
```

## Tools

| Tool | Auth? | What it does |
|------|-------|--------------|
| `aria_health` | no | Is the backend up? (`GET /api/health`) |
| `aria_check_endpoints` | optional | Probe key GET routes; `401/403` = present-but-auth-gated |
| `aria_run_job_search` | optional | Run a real job search and sample results |
| `aria_check_settings_persistence` | yes | Confirm profile/preferences round-trip to the DB |
| `aria_get_resume_status` | yes | Confirm a parsed resume + ATS score exist |
| `aria_verify_payment_flow` | — | **Stub** — no payment routes yet; returns not-implemented |

## Run standalone (debug)

```bash
node src/index.mjs        # speaks MCP over stdio; Ctrl-C to quit
```

## Cron / CI healthcheck (no Claude needed)

```bash
ARIA_API_URL=https://api.yourapp.com node healthcheck.mjs
# exits 0 if healthy, 1 if a critical check fails; prints JSON
```
