import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { normalizeEvents, recordInteractions } from "../services/interactionService.js";

const router = Router();

router.use(authenticateToken);

// Impressions batch on every feed render, so this is the highest-volume
// write path in the app. Cap it well above normal browsing.
const telemetryLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many telemetry requests." },
});

// ── POST /api/job-interactions ───────────────────────────────
// Fire-and-forget. Always 202 on a well-formed request: telemetry must
// never surface an error to the user, and the client must not retry.
router.post("/", telemetryLimiter, async (req: AuthRequest, res: Response) => {
    const rows = normalizeEvents(req.user!.userId, req.body?.events);

    res.status(202).json({ accepted: rows.length });

    // Insert after responding — the user's UI never waits on telemetry.
    void recordInteractions(rows);
});

export default router;
