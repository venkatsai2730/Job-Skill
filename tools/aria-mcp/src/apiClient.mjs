// Thin HTTP client the MCP tools use to reach the running Aria backend.
// Config via env (set in .mcp.json or the shell):
//   ARIA_API_URL    — backend base URL (default http://localhost:3001)
//   ARIA_AUTH_TOKEN — optional Bearer token for authenticated routes

const BASE = (process.env.ARIA_API_URL || "http://localhost:3001").replace(/\/+$/, "");
const TOKEN = process.env.ARIA_AUTH_TOKEN || "";

export function baseUrl() {
  return BASE;
}

export function hasToken() {
  return Boolean(TOKEN);
}

/**
 * Make a JSON request to the backend. Never throws — always resolves to a
 * structured result so tool handlers can report status uniformly.
 * @returns {Promise<{ok:boolean,status:number,data?:any,error?:string}>}
 */
export async function apiRequest(method, path, { body, auth = true, timeoutMs = 15000 } = {}) {
  const url = `${BASE}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (auth && TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const isTimeout = err && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: isTimeout ? `timeout after ${timeoutMs}ms` : String((err && err.message) || err),
    };
  } finally {
    clearTimeout(timer);
  }
}
