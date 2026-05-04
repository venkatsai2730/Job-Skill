// ═══════════════════════════════════════════════════════════════
// Activity Routes — GET /api/activity
// Returns the logged-in user's real recent activity events
// ═══════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { getUserActivity } from "../services/activityService.js";

const router = Router();
router.use(authenticateToken);

// GET /api/activity — fetch recent activity (max 20 items)
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const limit = Math.min(parseInt(String(req.query.limit || "15"), 10), 50);
        const events = await getUserActivity(req.user!.userId, limit);
        res.json({ activity: events });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
