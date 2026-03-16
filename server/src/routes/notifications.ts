// ═══════════════════════════════════════════════════════════════
// Notification Routes
// ═══════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import {
    getUserNotifications,
    markAsRead,
    markAllRead,
    getUnreadCount,
} from "../services/notificationService.js";

const router = Router();
router.use(authenticateToken);

// GET /api/notifications
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const notifications = await getUserNotifications(req.user!.userId);
        res.json({ notifications });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/notifications/unread-count
router.get("/unread-count", async (req: AuthRequest, res: Response) => {
    try {
        const count = await getUnreadCount(req.user!.userId);
        res.json({ count });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req: AuthRequest, res: Response) => {
    try {
        await markAsRead(req.params.id as string, req.user!.userId);
        res.json({ message: "Marked as read." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notifications/read-all
router.post("/read-all", async (req: AuthRequest, res: Response) => {
    try {
        await markAllRead(req.user!.userId);
        res.json({ message: "All marked as read." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
