// Optional headless audit — runs Claude over the aria checks with NO Claude Code
// in the loop. Good for CI / cron "nightly Aria healthcheck" that posts a summary.
//
// Uses the documented Anthropic Messages API tool runner (@anthropic-ai/sdk),
// reusing the same apiClient the MCP server uses. This is the accurate,
// documented equivalent of an Agent-SDK headless run. For a full Claude Agent
// SDK (query()/createSdkMcpServer) scaffold instead, use the
// `agent-sdk-dev:new-sdk-app` skill — it emits verified Agent-SDK code.
//
// Requires:  npm install   (pulls the optional @anthropic-ai/sdk)
//            ANTHROPIC_API_KEY=...   ARIA_API_URL / ARIA_AUTH_TOKEN as usual
// Run:       npm run audit   (in tools/aria-mcp)

import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { apiRequest, baseUrl, hasToken } from "./src/apiClient.mjs";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required for the headless audit.");
  process.exit(1);
}

const client = new Anthropic();

const ariaHealth = betaZodTool({
  name: "aria_health",
  description: "Check whether the Aria backend is up (GET /api/health).",
  inputSchema: z.object({}),
  run: async () => {
    const r = await apiRequest("GET", "/api/health", { auth: false });
    return JSON.stringify({ base: baseUrl(), healthy: r.ok, status: r.status, body: r.data ?? r.error });
  },
});

const ariaEndpoints = betaZodTool({
  name: "aria_check_endpoints",
  description: "Probe key backend GET routes. 401/403 = present-but-needs-auth.",
  inputSchema: z.object({}),
  run: async () => {
    const routes = ["/api/health", "/api/jobs?limit=1", "/api/job-listings?limit=1", "/api/resume/parsed", "/api/profile"];
    const out = [];
    for (const path of routes) {
      const r = await apiRequest("GET", path, { auth: path !== "/api/health" });
      out.push({ path, status: r.status, present: r.status !== 0 && r.status !== 404 });
    }
    return JSON.stringify(out);
  },
});

const ariaJobs = betaZodTool({
  name: "aria_run_job_search",
  description: "Run a real job search (GET /api/jobs) and return a small sample.",
  inputSchema: z.object({ query: z.string().optional() }),
  run: async ({ query = "software developer" }) => {
    const r = await apiRequest("GET", `/api/jobs?query=${encodeURIComponent(query)}&limit=3`);
    const list = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
    return JSON.stringify({ status: r.status, returned: list.length, sample: list.slice(0, 3).map(j => ({ title: j.title, company: j.company })) });
  },
});

const finalMessage = await client.beta.messages.toolRunner({
  model: "claude-opus-4-8",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  tools: [ariaHealth, ariaEndpoints, ariaJobs],
  messages: [{
    role: "user",
    content:
      `You are the Aria SRE agent. The backend is at ${baseUrl()} (auth token ${hasToken() ? "set" : "NOT set"}). ` +
      "Use the aria_* tools to run a health sweep: confirm the server is up, probe key endpoints, and exercise the job engine. " +
      "Then produce a concise status report: 🟢/🟡/🔴 overall, a per-check table, and a short prioritized TODO list. " +
      "Treat 401/403 as healthy (auth-gated), 404/unreachable as incidents.",
  }],
});

for (const block of finalMessage.content) {
  if (block.type === "text") process.stdout.write(block.text);
}
process.stdout.write("\n");
