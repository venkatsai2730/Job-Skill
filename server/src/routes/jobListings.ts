// ═══════════════════════════════════════════════════════════════
// Job Listings Routes — Real-time ATS job feed
// ═══════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { fetchAllJobs, searchJobs } from "../services/jobFetcher.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/job-listings — search/browse jobs
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const { query, location, skills, experience_max, limit } = req.query;
        const jobs = await searchJobs({
            query: query as string,
            location: location as string,
            skills: skills ? (skills as string).split(",") : undefined,
            experience_max: experience_max ? parseInt(experience_max as string) : undefined,
            limit: limit ? parseInt(limit as string) : 50,
        });
        res.json({ jobs, count: jobs.length });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/job-listings/fetch — trigger manual job fetch (admin/cron)
router.post("/fetch", async (_req, res: Response) => {
    try {
        const result = await fetchAllJobs();
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
