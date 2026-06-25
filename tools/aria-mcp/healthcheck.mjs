// Plain healthcheck for cron/CI — no Claude, no API key needed.
// Hits the backend directly and exits non-zero if anything critical is down.
//
//   ARIA_API_URL=https://api.yourapp.com node tools/aria-mcp/healthcheck.mjs
//
// Use it in a cron job or CI step; pipe the JSON to your alerting.

import { apiRequest, baseUrl } from "./src/apiClient.mjs";

const checks = [
  { name: "health", path: "/api/health", auth: false, critical: true },
  { name: "jobs", path: "/api/jobs?query=developer&limit=1", auth: true, critical: false },
  { name: "job-listings", path: "/api/job-listings?limit=1", auth: true, critical: false },
];

const results = [];
for (const c of checks) {
  const r = await apiRequest("GET", c.path, { auth: c.auth, timeoutMs: 10000 });
  // 401/403 = route exists but needs auth → still "up"
  const up = r.status !== 0 && r.status !== 404 && r.status < 500;
  results.push({ name: c.name, status: r.status, up, critical: c.critical });
}

const criticalDown = results.filter(r => r.critical && !r.up);
const report = {
  base_url: baseUrl(),
  timestamp: new Date().toISOString(),
  ok: criticalDown.length === 0,
  checks: results,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
