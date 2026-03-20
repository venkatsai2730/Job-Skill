import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import resumeRoutes from "./routes/resume.js";
import chatRoutes from "./routes/chat.js";
import jobsRoutes from "./routes/jobs.js";
import jobListingsRoutes from "./routes/jobListings.js";
import notificationRoutes from "./routes/notifications.js";
import linkedinRoutes from "./routes/linkedin.js";
import geocodeRoutes from "./routes/geocode.js";
import { fetchAtsJobs, fetchRssJobs, fetchScraperJobs, fetchJSearchCronJobs, autoExpireJobs, verifyTopJobs } from "./services/jobFetcher.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}));
app.use(express.json({ limit: "15mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/job-listings", jobListingsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/linkedin", linkedinRoutes);
app.use("/api/geocode", geocodeRoutes);

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Job Fetch Cron (Staggered Intervals) ────────────────────
const ATS_INTERVAL = 5 * 60 * 1000;        // 5 minutes
const RSS_INTERVAL = 15 * 60 * 1000;       // 15 minutes
const SCRAPER_INTERVAL = 30 * 60 * 1000;   // 30 minutes
const JSEARCH_INTERVAL = 10 * 60 * 1000;   // 10 minutes
const EXPIRY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const VERIFY_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

function startJobFetchCron() {
    // Initial fetch after a short delay to let server start
    setTimeout(() => {
        fetchAtsJobs().catch(err => console.warn("[Cron] Initial ATS fetch failed:", err.message));
        fetchRssJobs().catch(err => console.warn("[Cron] Initial RSS fetch failed:", err.message));
        setTimeout(() => fetchScraperJobs().catch(e => console.warn("[Cron] Scraper failed", e.message)), 10000);
        setTimeout(() => fetchJSearchCronJobs().catch(e => console.warn("[Cron] JSearch cron failed", e.message)), 20000);
        autoExpireJobs().catch(e => console.warn("[Cron] Expiry failed", e.message));
    }, 30000);

    setInterval(() => {
        fetchAtsJobs().catch(err => console.warn("[Cron] ATS fetch failed:", err.message));
    }, ATS_INTERVAL);

    setInterval(() => {
        fetchRssJobs().catch(err => console.warn("[Cron] RSS fetch failed:", err.message));
    }, RSS_INTERVAL);

    setInterval(() => {
        fetchScraperJobs().catch(err => console.warn("[Cron] Scraper fetch failed:", err.message));
    }, SCRAPER_INTERVAL);

    setInterval(() => {
        fetchJSearchCronJobs().catch(err => console.warn("[Cron] JSearch cron failed:", err.message));
    }, JSEARCH_INTERVAL);

    setInterval(() => {
        autoExpireJobs().catch(err => console.warn("[Cron] Expiry failed:", err.message));
    }, EXPIRY_INTERVAL);

    setInterval(() => {
        verifyTopJobs().catch(err => console.warn("[Cron] Verification failed:", err.message));
    }, VERIFY_INTERVAL);

    console.log(`⏰ Cron started: ATS (5m), RSS (15m), Scraper (30m), JSearch (10m), Expiry (24h), Verify (7d)`);
}

startJobFetchCron();

// Global Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("🔥 Unhandled Express Error:", err);
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
