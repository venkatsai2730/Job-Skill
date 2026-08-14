# JobSkill AI 

An AI-powered job-search and career-prep platform. Aria finds and ranks jobs against your
résumé, scores and rewrites your résumé for ATS, and helps with cover letters, LinkedIn
optimization, and interview prep — all driven by an AI agent chat.

- **Client** — React + Vite + TypeScript, shadcn-ui, Tailwind CSS
- **Server** — Express + TypeScript (ESM), Supabase (Postgres) for data
- **AI** — LangGraph/LangChain agent, Groq / Gemini / Mistral providers, Qdrant for RAG
- **Jobs** — MCP-based scraping + free ATS board APIs (no paid job APIs)

> Repo layout is a monorepo: [`client/`](client/) (frontend) and [`server/`](server/) (backend).
> The server can also serve the built client, so a single process can host the whole app in production.

## Features

| Area | What it does |
|---|---|
| **Jobs** | Domain-aware recommender — splits results into "roles in your domain" vs "other tech roles", ranked against your résumé with a match score and estimated selection chance. Plus a tracked-applications kanban. |
| **Résumé** | Upload → parse → ATS scoring, inline editor, and AI tailoring/rewrite. |
| **Cover Letter** | Generates role-specific cover letters. |
| **LinkedIn** | Profile/headline/about optimization. |
| **Interview** | AI interview-coach prompts (via the chat agent). |
| **Chat (Aria)** | The AI agent that ties the tools together (job fit, résumé edits, career advice). |
| **Templates / Settings / Pricing** | Résumé templates, profile & preferences, and plans. Payment backend is not yet implemented. |

## Architecture at a glance

```
client (Vite :5173) ──HTTP──▶ server (Express :3001) ──▶ Supabase (Postgres)
                                     │
                                     ├─ MCP job scraping cron  (every 2h, ~10 sources)
                                     ├─ ATS board APIs cron    (every 15m: Greenhouse/Lever/Ashby)
                                     ├─ auto-expire (24h) + verify-top (7d)
                                     └─ AI agent (LangGraph) + Qdrant RAG
```

### The job-recommendation pipeline

A request to `GET /api/job-listings` flows through five stages
([`server/src/routes/jobListings.ts`](server/src/routes/jobListings.ts)):

1. **Profile load** — pulls the user's skills/experience/domain from `user_profiles` and their
   latest parsed résumé.
2. **Search** — queries the `job_listings` table (`searchJobs`), pulling a large pool for
   logged-in users.
3. **Supplement** — if the pool is thin, tops up with live MCP scraping.
4. **Rank** — [`jobRankingService`](server/src/services/jobRankingService.ts) scores each job
   (skill overlap, title, seniority, project relevance, recency) into a `match_score` and an
   estimated `selection_chance`, applying penalties (PhD/seniority/tier-1 mismatches).
5. **Domain split** — [`relevanceScorer`](server/src/services/relevanceScorer.ts) +
   [`jobDomainClassifier`](server/src/services/jobDomainClassifier.ts) classify each job's domain
   and split into **primary** (your domain) vs **cross-domain** pools, ordered by `match_score`.

Anonymous users get a flat `{ jobs, total }` response; logged-in users get
`{ primary_jobs, cross_domain_jobs, meta }`, which the [Jobs page](client/src/pages/Jobs.tsx)
renders as two sections with per-job match/selection/domain badges.

## Prerequisites

- Node.js 18+ and npm
- A Supabase project (URL + service key)
- At least one AI provider key for chat/résumé features (Groq and/or Gemini)

## Setup

```sh
# 1. Install dependencies for both packages
npm run install:all          # == cd server && npm i  +  cd client && npm i

# 2. Configure the server env
cp server/.env.example server/.env
#    then fill in the values below
```

### Environment variables

**Server** (`server/.env`) — required vars are fatal if missing; optional ones degrade a feature:

| Var | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service-role key |
| `JWT_SECRET` | ✅ | Signs auth tokens |
| `GROQ_API_KEY` | optional | Chat / most AI features |
| `GEMINI_API_KEY` | optional | Résumé edit & tailoring |
| `MISTRAL_API_KEY` | optional | Code generation (Codestral) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google OAuth sign-in |
| `CLIENT_URL` | optional | Extra allowed CORS origin |
| `PORT` | optional | Server port (default `3001`) |
| `TRUST_PROXY` | optional | Set to `1` when running behind a reverse proxy outside `NODE_ENV=production`, so rate limiters key on the real client IP |

**Client** (`client/.env`):

| Var | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend (e.g. `http://localhost:3001`) |
| `VITE_MIXPANEL_TOKEN` | Optional analytics token |

## Running locally

```sh
# From the repo root — runs client and server together
npm run dev

# …or individually
npm run dev:server           # Express on :3001 (tsx watch)
npm run dev:client           # Vite on :5173
```

The server validates required env on boot and exits with a clear message if any are missing.

## Building for production

```sh
cd client && npm run build   # outputs client/dist
cd server && npm run build   # tsc → server/dist, then: npm start
```

When `client/dist` exists, the server serves it as static files, so `npm start` in `server/`
hosts the full app on one port.

## Testing & type-checking

```sh
cd server && npm test        # vitest (unit tests for scorers/classifiers)
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
cd client && npm run lint
```

## The Aria dev harness

This repo also ships a Claude Code harness that lets an AI agent exercise the **running** app
(health checks, live job searches, résumé/settings round-trips) via MCP tools and scoped
subagents. See [`ARIA_HARNESS.md`](ARIA_HARNESS.md) for setup and usage.

## Deployment

Container config lives in [`docker-compose.yml`](docker-compose.yml) and
[`vercel.json`](vercel.json). The server binds `0.0.0.0` and supports graceful shutdown for
container environments.
