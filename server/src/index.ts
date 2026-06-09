import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import resumeRoutes from "./routes/resume.js";
import linkedinRoutes from "./routes/linkedin.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.disable("x-powered-by");

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
app.use("/api/linkedin", linkedinRoutes);

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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
