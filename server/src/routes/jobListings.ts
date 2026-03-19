// ═══════════════════════════════════════════════════════════════
// Job Listings Routes — Real-time ATS job feed + Global Live Search
// ═══════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { fetchAllJobsLegacy, searchJobs, searchJSearchLive, extractExperience } from "../services/jobFetcher.js";
import { supabaseAdmin } from "../config/supabase.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Memory Cache to significantly speed up job queries and drop DB load
const routeCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GET /api/job-listings — search/browse jobs (DB + optional live JSearch merge)
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const cacheKey = req.originalUrl;
        const cached = routeCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            res.json(cached.data);
            return;
        }

        const { query, location, skills, experience_max, limit, page, preferred_location, city, country, lat, lon } = req.query;
        
        const parsedLimit = limit ? parseInt(limit as string) : 20;
        const parsedPage = page ? parseInt(page as string) : 1;
        
        // Search the DB with smarter location matching
        const result = await searchJobs({
            query: query as string,
            location: location as string,
            skills: skills ? (skills as string).split(",") : undefined,
            experience_max: experience_max ? parseInt(experience_max as string) : undefined,
            limit: parsedLimit,
            page: parsedPage,
            preferred_location: preferred_location as string,
            city: city as string,
            country: country as string,
        });

        let allJobs = result.data;
        let totalCount = result.total;

        // If DB results are too few, supplement with live JSearch results
        if (allJobs.length < 10 && (location || city || query)) {
            const searchLocation = (location || city || "") as string;
            const searchQuery = (query || "") as string;

            const liveJobs = await searchJSearchLive(searchQuery, searchLocation, 20);
            
            if (liveJobs.length > 0) {
                // Convert RawJob to the format expected by the frontend
                const existingUrls = new Set(allJobs.map((j: any) => j.job_url));
                const newJobs = liveJobs
                    .filter(j => j.job_url && !existingUrls.has(j.job_url))
                    .map(j => ({
                        id: `jsearch_${Buffer.from(j.job_url).toString("base64").substring(0, 20)}`,
                        title: j.title,
                        company: j.company,
                        location: j.location,
                        salary_min: null,
                        salary_max: null,
                        experience_min: null,
                        experience_max: null,
                        skills: [],
                        job_url: j.job_url,
                        source: "jsearch",
                        posted_at: j.posted_at || new Date().toISOString(),
                        description: j.description || "",
                    }));

                // Append live results after DB results
                allJobs = [...allJobs, ...newJobs];
                totalCount += newJobs.length;
            }
        }
        
        const responseData = { jobs: allJobs, count: allJobs.length, total: totalCount };
        
        // Save to cache
        routeCache.set(cacheKey, { timestamp: Date.now(), data: responseData });

        res.json(responseData);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/job-listings/fetch — trigger manual job fetch (admin/cron)
router.post("/fetch", async (_req, res: Response) => {
    try {
        const result = await fetchAllJobsLegacy();
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/job-listings/reprocess-exp — re-calculate experience for all jobs
router.post("/reprocess-exp", async (_req, res: Response) => {
    try {
        const { data: jobs, error } = await supabaseAdmin
            .from("job_listings")
            .select("job_url, description");

        if (error) throw error;

        let count = 0;
        for (const job of jobs || []) {
            const exp = extractExperience(job.description);
            if (exp.min !== null) {
                await supabaseAdmin
                    .from("job_listings")
                    .update({ experience_min: exp.min, experience_max: exp.max })
                    .eq("job_url", job.job_url);
                count++;
            }
        }
        res.json({ message: `Reprocessed ${count} jobs.` });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
