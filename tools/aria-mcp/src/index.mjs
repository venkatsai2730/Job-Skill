// ═══════════════════════════════════════════════════════════════
// Aria MCP Server — exposes the JobSkill AI app to Claude subagents
// as callable tools. Stdio transport (Claude Code launches this).
//
// Tools probe the RUNNING backend over HTTP, so the app must be up
// (cd server && npm run dev). Authenticated routes need ARIA_AUTH_TOKEN.
// ═══════════════════════════════════════════════════════════════

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiRequest, baseUrl, hasToken } from "./apiClient.mjs";

const server = new McpServer({ name: "aria", version: "1.0.0" });

// Wrap a JS value as an MCP text result.
const text = (value) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

// ── aria_health ────────────────────────────────────────────────
// Is the backend up? Hits the public /api/health endpoint (no auth).
server.tool(
  "aria_health",
  "Check whether the Aria backend is running and reachable (GET /api/health).",
  {},
  async () => {
    const r = await apiRequest("GET", "/api/health", { auth: false });
    return text({
      base_url: baseUrl(),
      reachable: r.status !== 0,
      healthy: r.ok,
      status: r.status,
      response: r.data ?? r.error ?? null,
      auth_token_configured: hasToken(),
    });
  }
);

// ── aria_check_endpoints ───────────────────────────────────────
// Probe a curated set of GET routes and report which are present.
// A 401/403 means the route EXISTS but needs auth (still "present").
server.tool(
  "aria_check_endpoints",
  "Probe key backend GET routes and report reachability. 200=ok, 401/403=present-but-needs-auth, 404/0=problem. Only safe read routes are probed.",
  {},
  async () => {
    const routes = [
      { page: "Health", path: "/api/health", auth: false },
      { page: "Jobs", path: "/api/jobs?query=developer&limit=1" },
      { page: "Job Listings", path: "/api/job-listings?limit=1" },
      { page: "Resume", path: "/api/resume/parsed" },
      { page: "Profile/Settings", path: "/api/profile" },
      { page: "Activity", path: "/api/activity" },
      { page: "Notifications", path: "/api/notifications" },
    ];

    const results = [];
    for (const route of routes) {
      const r = await apiRequest("GET", route.path, { auth: route.auth !== false });
      const present = r.status !== 0 && r.status !== 404;
      const needsAuth = r.status === 401 || r.status === 403;
      results.push({
        page: route.page,
        path: route.path,
        status: r.status,
        present,
        verdict: r.status === 0 ? "unreachable (is the server up?)"
          : r.status === 404 ? "MISSING (404)"
            : needsAuth ? "present (needs auth token)"
              : r.ok ? "ok" : `present (HTTP ${r.status})`,
      });
    }

    const missing = results.filter(x => !x.present).length;
    return text({
      base_url: baseUrl(),
      auth_token_configured: hasToken(),
      summary: missing === 0 ? "All probed routes are present." : `${missing} route(s) unreachable/missing.`,
      routes: results,
    });
  }
);

// ── aria_run_job_search ────────────────────────────────────────
// Exercise the job engine end-to-end and return a structured sample.
server.tool(
  "aria_run_job_search",
  "Run a real job search through the app (GET /api/jobs) and return count + a small sample. May require ARIA_AUTH_TOKEN.",
  {
    query: z.string().optional().describe("Role/keyword, e.g. 'frontend developer'"),
    location: z.string().optional().describe("Location filter, e.g. 'Bangalore'"),
    limit: z.number().int().min(1).max(20).optional().describe("Max results to sample (default 5)"),
  },
  async ({ query = "software developer", location = "", limit = 5 }) => {
    const params = new URLSearchParams({ query, limit: String(limit) });
    if (location) params.set("location", location);
    const r = await apiRequest("GET", `/api/jobs?${params.toString()}`);
    if (r.status === 0) return text({ ok: false, error: `Backend unreachable at ${baseUrl()} — is it running?` });
    if (r.status === 401 || r.status === 403) return text({ ok: false, error: "Needs auth. Set ARIA_AUTH_TOKEN to a valid Bearer token." });

    const list = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
    return text({
      ok: r.ok,
      status: r.status,
      query,
      location: location || "(any)",
      returned: list.length,
      sample: list.slice(0, limit).map(j => ({
        title: j.title, company: j.company, location: j.location, match: j.match_score ?? null,
      })),
    });
  }
);

// ── aria_check_settings_persistence ────────────────────────────
// Confirm the authenticated user's profile/preferences read back.
server.tool(
  "aria_check_settings_persistence",
  "Read the authenticated user's profile (GET /api/profile) and report which preference fields are persisted. Requires ARIA_AUTH_TOKEN.",
  {},
  async () => {
    if (!hasToken()) return text({ ok: false, error: "ARIA_AUTH_TOKEN not set — cannot read an authenticated profile." });
    const r = await apiRequest("GET", "/api/profile");
    if (r.status === 0) return text({ ok: false, error: `Backend unreachable at ${baseUrl()}.` });
    if (r.status === 401 || r.status === 403) return text({ ok: false, error: "Token rejected (401/403). Provide a fresh ARIA_AUTH_TOKEN." });

    const p = r.data?.profile ?? r.data ?? {};
    const fields = ["skills", "experience_years", "preferred_locations", "target_roles", "current_role"];
    return text({
      ok: r.ok,
      status: r.status,
      persisted_fields: fields.filter(f => p[f] !== undefined && p[f] !== null && (Array.isArray(p[f]) ? p[f].length > 0 : true)),
      missing_or_empty: fields.filter(f => p[f] === undefined || p[f] === null || (Array.isArray(p[f]) && p[f].length === 0)),
    });
  }
);

// ── aria_get_resume_status ─────────────────────────────────────
// Confirm a resume + ATS score are stored for the user.
server.tool(
  "aria_get_resume_status",
  "Check whether the authenticated user has a parsed resume + ATS score (GET /api/resume/parsed). Requires ARIA_AUTH_TOKEN.",
  {},
  async () => {
    if (!hasToken()) return text({ ok: false, error: "ARIA_AUTH_TOKEN not set — cannot read the user's resume." });
    const r = await apiRequest("GET", "/api/resume/parsed");
    if (r.status === 0) return text({ ok: false, error: `Backend unreachable at ${baseUrl()}.` });

    const pd = r.data?.parsed_data ?? r.data ?? {};
    return text({
      ok: r.ok,
      status: r.status,
      has_resume: Boolean(pd?.sections || pd?.rawText),
      ats_score: pd?.ats?.score ?? pd?.ats?.overall_score ?? null,
      sections_present: pd?.sections ? Object.keys(pd.sections) : [],
    });
  }
);

// ── aria_verify_payment_flow (STUB) ────────────────────────────
// No payment routes were found in the app (only a Pricing page/UI).
// This is an honest placeholder so the SRE/backend agents report
// "not implemented" instead of inventing a result.
server.tool(
  "aria_verify_payment_flow",
  "Verify the payment flow. STUB: no payment/checkout routes exist in this app yet — returns not-implemented so agents don't fabricate success.",
  {
    testUser: z.string().optional().describe("Test user id (unused until payment routes exist)"),
  },
  async ({ testUser }) => {
    return text({
      ok: false,
      implemented: false,
      message: "No payment/checkout backend routes detected (only the Pricing UI). " +
        "Wire a Stripe/Razorpay test route (e.g. POST /api/payments/checkout) and update this tool to call it.",
      test_user: testUser ?? null,
    });
  }
);

// ── boot ───────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
// NOTE: do not console.log to stdout — stdio is the MCP channel. Use stderr.
console.error(`[aria-mcp] ready · base=${baseUrl()} · token=${hasToken() ? "set" : "none"}`);
