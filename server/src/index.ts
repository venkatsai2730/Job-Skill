import "dotenv/config";
// Validate env as an import side-effect — must run before the route/config
// imports below construct clients from these vars (ESM evaluates imported
// modules in source order). Keep this import directly after dotenv.
import "./config/validateEnv.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import resumeRoutes from "./routes/resume.js";
import linkedinRoutes from "./routes/linkedin.js";
import chatRoutes from "./routes/chat.js";
import jobsRoutes from "./routes/jobs.js";
import jobListingsRoutes from "./routes/jobListings.js";
import notificationRoutes from "./routes/notifications.js";
import geocodeRoutes from "./routes/geocode.js";
import chatbotRoutes from "./routes/chatbot.js";
import activityRoutes from "./routes/activity.js";
import resumeDataRoutes from "./routes/resumeData.js";
import applicationsRoutes from "./routes/applications.js";
import coverLetterRoutes from "./routes/cover-letter.js";
import interviewRoutes from "./routes/interview.js";
import templatesRoutes from "./routes/templates.js";
import usersRoutes from "./routes/users.js";
import resumeRewriteRoutes from "./routes/resume-rewrite.js";
import jobInteractionsRoutes from "./routes/jobInteractions.js";
import { fetchAtsJobs, autoExpireJobs, verifyTopJobs } from "./services/jobFetcher.js";
import { startMCPJobCron } from "./mcp/jobSyncCron.js";

const app = express();
const PORT = process.env.PORT || 3001;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, "../../client/dist");
const serveStatic = fs.existsSync(clientDist);

// Behind a reverse proxy (Vercel / container ingress) req.ip is the proxy's
// address unless we trust the first X-Forwarded-For hop. The rate limiters
// key on req.ip, so without this every client shares one bucket.
if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
}

app.disable("x-powered-by");

// Security headers. CSP is disabled because the SPA we serve from client/dist
// ships inline styles/scripts from the Vite build; the rest of helmet's
// defaults (HSTS, nosniff, frameguard, referrer-policy) all apply.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Middleware
const ALLOWED_ORIGINS = [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:3000",
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));
// Body limits are scoped, not global. Only the résumé routes accept a large
// payload (base64 PDF / raw LaTeX upload); every other route gets 1mb so a
// single request can't pin memory. body-parser is a no-op on a request whose
// body is already parsed, so the 1mb parser below is skipped for these.
app.use("/api/resume", express.json({ limit: "15mb" }));
app.use("/api/templates", express.json({ limit: "15mb" }));
app.use(express.json({ limit: "1mb" }));

// Credential endpoints are the brute-force surface: throttle by IP. Login and
// signup are counted together so rotating between them doesn't reset the
// budget. Read-only auth routes (/me, /logout) are excluded.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again in a few minutes." },
});

// Routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/change-password", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/linkedin", linkedinRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/job-listings", jobListingsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/geocode", geocodeRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/resume/data", resumeDataRoutes);
app.use("/api/resume-rewrite", resumeRewriteRoutes);
app.use("/api/applications", applicationsRoutes);
app.use("/api/cover-letter", coverLetterRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/job-interactions", jobInteractionsRoutes);

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Unmatched API routes must 404 as JSON. This has to sit ahead of the SPA
// catch-all below — otherwise an unmounted /api path falls through to
// index.html and the client gets HTML 200 where it expected JSON, which shows
// up as an opaque parse error instead of a 404.
app.use("/api", (req, res) => {
    res.status(404).json({ error: `No such API route: ${req.method} /api${req.path}` });
});

// Serve React frontend from client/dist if built
if (serveStatic) {
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => {
        res.sendFile(path.join(clientDist, "index.html"));
    });
}

// ═══════════════════════════════════════════════════════════════
// JOB FETCHING ARCHITECTURE
//
// PRIMARY: MCP-based scraping (zero API keys, zero rate limits)
//   → LinkedIn, Indeed, Naukri, RemoteOK, Remotive, Arbeitnow,
//     Internshala, SimplyHired, Glassdoor, Google Jobs
//   → Runs every 2 hours with 60+ queries
//
// SECONDARY: ATS board APIs (free, no rate limits)
//   → Greenhouse, Lever, Ashby (public company job board APIs)
//   → Runs every 15 minutes
//
// REMOVED: JSearch (RapidAPI — rate limited, paid)
// REMOVED: RSS feeds (unreliable, low volume)
// REMOVED: Legacy scrapers (replaced by MCP scrapers)
// ═══════════════════════════════════════════════════════════════

const ATS_INTERVAL = 15 * 60 * 1000;       // 15 minutes (free APIs, no limits)
const EXPIRY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const VERIFY_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

function startATSBoardCron() {
    // ATS boards (Greenhouse, Lever, Ashby) — free public APIs
    // These are reliable and don't need API keys
    setTimeout(() => {
        fetchAtsJobs().catch(err => console.warn("[Cron] Initial ATS fetch failed:", err.message));
        autoExpireJobs().catch(e => console.warn("[Cron] Expiry failed", e.message));
    }, 45000); // Start after MCP initial sync

    setInterval(() => {
        fetchAtsJobs().catch(err => console.warn("[Cron] ATS fetch failed:", err.message));
    }, ATS_INTERVAL);

    setInterval(() => {
        autoExpireJobs().catch(err => console.warn("[Cron] Expiry failed:", err.message));
    }, EXPIRY_INTERVAL);

    setInterval(() => {
        verifyTopJobs().catch(err => console.warn("[Cron] Verification failed:", err.message));
    }, VERIFY_INTERVAL);

    console.log(`⏰ ATS Board cron started: Greenhouse/Lever/Ashby (15m), Expiry (24h), Verify (7d)`);
}

// Start both engines
startMCPJobCron();     // PRIMARY: MCP scraping (2h cycle, 10 sources)
startATSBoardCron();   // SECONDARY: ATS boards (15m cycle, free APIs)

// Global Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("🔥 Unhandled Express Error:", err);

    // Client-side failures raised by middleware (body-parser's 413 on an
    // oversized payload, its 400 on malformed JSON, the CORS rejection) carry
    // their own status. Reporting those as 500 hides a caller's mistake behind
    // a server fault, so pass 4xx through with a safe message.
    const status = Number(err?.status ?? err?.statusCode);
    if (status >= 400 && status < 500) {
        const message = status === 413
            ? "Payload too large"
            : status === 400
                ? "Malformed request body"
                : "Bad request";
        res.status(status).json({ error: message });
        return;
    }

    res.status(500).json({ error: "Internal Server Error" });
});
// Start server (Bind to 0.0.0.0 for production/container compatibility)
const server = app.listen(PORT as number, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Accepting requests from ${process.env.CLIENT_URL || "http://localhost:5173"}`);
});

// Detect EADDRINUSE (Port Conflict) and exit gracefully with clear instructions
server.on("error", (error: any) => {
    if (error.code === "EADDRINUSE") {
        console.error(`\n❌ ERROR: Port ${PORT} is already in use.`);
        console.error(`   This means another backend process is still running.`);
        console.error(`   ➡️ On Windows, run: (Get-NetTCPConnection -LocalPort ${PORT} -EA SilentlyContinue).OwningProcess | % { taskkill /PID $_ /F }`);
        console.error(`   ➡️ Or close any other open terminals running the server.`);
        process.exit(1);
    } else {
        console.error("💥 Server start error:", error);
        process.exit(1);
    }
});
// --- Production Hardening: Graceful Shutdown & Crash Prevention ---

// 1. Handle unhandled promise rejections (prevent silent crashes)
process.on("unhandledRejection", (reason, promise) => {
    console.error("🚨 Unhandled Rejection at:", promise, "reason:", reason);
    // Do not exit aggressively; log and monitor in production
});

// 2. Handle uncaught synchronous exceptions
process.on("uncaughtException", (error) => {
    console.error("💥 Uncaught Exception:", error);
    // Critical failure: cleanly close server before exiting
    server.close(() => {
        process.exit(1);
    });
});

// 3. Graceful shutdown on termination signals (Docker/Ctrl+C)
const gracefulShutdown = (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        console.log("✅ HTTP server closed.");
        process.exit(0);
    });

    // Force close if it takes too long (e.g., 10 seconds)
    setTimeout(() => {
        console.error("⚠️ Forceful shutdown after timeout.");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
