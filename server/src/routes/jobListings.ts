// ═══════════════════════════════════════════════════════════════
// Job Listings Routes — Real-time ATS job feed + Global Live Search
// ═══════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { searchJobs, extractExperience, detectCategory } from "../services/jobFetcher.js";
import { mcpLiveSearch } from "../mcp/mcpClient.js";
import { syncJobsViaMCP } from "../mcp/jobSyncCron.js";
import { rankJobsForUser, getUserSkillsForMatching } from "../services/jobRankingService.js";
import { supabaseAdmin } from "../config/supabase.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Memory Cache to speed up job queries
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

        const { query, location, skills, experience_max, limit, page, preferred_location, city, country, user_id, category } = req.query;

        const parsedLimit = limit ? parseInt(limit as string) : 40;
        const parsedPage = page ? parseInt(page as string) : 1;
        const parsedExpMax = experience_max !== undefined && experience_max !== "" 
            ? parseInt(experience_max as string) 
            : undefined;

        // Fetch user profile for resume-based matching
        let userSkills: string[] = [];
        let userExperienceYears: number | undefined;
        let userSeniority: string | undefined;

        if (user_id) {
            try {
                const { data: profile } = await supabaseAdmin
                    .from("user_profiles")
                    .select("skills, experience_years, seniority_level")
                    .eq("user_id", user_id as string)
                    .single();

                if (profile) {
                    userSkills = profile.skills || [];
                    userExperienceYears = profile.experience_years || undefined;
                    userSeniority = profile.seniority_level || undefined;
                }
            } catch {
                // No profile found — continue without resume matching
            }

            // Fallback: try to get skills from latest resume parsed data
            if (userSkills.length === 0) {
                try {
                    const { data: resume } = await supabaseAdmin
                        .from("resumes")
                        .select("parsed_data")
                        .eq("user_id", user_id as string)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .single();

                    if (resume?.parsed_data) {
                        const pd = resume.parsed_data as any;
                        const skillGroups = pd?.sections?.skills || [];
                        userSkills = skillGroups.flatMap((g: any) => g.items || []);
                        // Infer experience from resume sections
                        const expEntries = pd?.sections?.experience || [];
                        if (expEntries.length > 0) {
                            userExperienceYears = Math.min(expEntries.length * 2, 15); // rough estimate
                        }
                    }
                } catch { /* no resume */ }
            }
        }

        // Search the DB with all advanced features
        const result = await searchJobs({
            query: query as string,
            location: location as string,
            skills: skills ? (skills as string).split(",") : undefined,
            experience_max: parsedExpMax,
            limit: parsedLimit,
            page: parsedPage,
            preferred_location: preferred_location as string,
            city: city as string,
            country: country as string,
            category: category as string,
            // Resume-based matching
            user_skills: userSkills.length > 0 ? userSkills : undefined,
            user_experience_years: userExperienceYears,
            user_seniority: userSeniority,
        });

        let allJobs = result.data;
        let totalCount = result.total;

        // If DB results are too few, supplement with MCP live scraping (no API keys)
        if (allJobs.length < 10 && (location || city || query)) {
            const searchLocation = (location || city || "") as string;
            const searchQuery = (query || "") as string;
            
            // For fresher searches, use targeted queries to get more relevant results
            const isFresherSearch = parsedExpMax !== undefined && parsedExpMax <= 2;
            const queries = isFresherSearch
                ? [
                    `junior ${searchQuery || "developer"}`,
                    `entry level ${searchQuery || "software engineer"}`,
                    `fresher ${searchQuery || "developer"}`,
                    `intern ${searchQuery || "software"}`,
                  ]
                : [searchQuery || "software engineer"];

            const existingUrls = new Set(allJobs.map((j: any) => j.job_url));
            
            for (const q of queries) {
                if (allJobs.length >= 20) break; // enough results
                const liveJobs = await mcpLiveSearch(q, searchLocation, 20);

                if (liveJobs.length > 0) {
                    let newJobs = liveJobs
                        .filter(j => j.job_url && !existingUrls.has(j.job_url))
                        .map(j => ({
                            id: `mcp_${Buffer.from(j.job_url).toString("base64").substring(0, 20)}`,
                            title: j.title,
                            company: j.company,
                            location: j.location,
                            salary_min: j.salary_min,
                            salary_max: j.salary_max,
                            experience_min: null as number | null,
                            experience_max: null as number | null,
                            skills: [] as string[],
                            job_url: j.job_url,
                            source: j.source || "mcp",
                            posted_at: j.posted_at || new Date().toISOString(),
                            description: j.description || "",
                            seniority_level: "unknown",
                            match_score: 0,
                            confidence_score: 50,
                            is_active: true,
                            category: detectCategory(j.title, j.category),
                        }));

                    // Apply experience filtering to live jobs before appending
                    if (parsedExpMax !== undefined && !isNaN(parsedExpMax)) {
                        newJobs = newJobs.filter(job => {
                            const exp = extractExperience(job.description || "");
                            if (exp.min !== null && exp.min > parsedExpMax) return false;
                            
                            // Strict title check for Entry-level/Fresher
                            if (parsedExpMax <= 2) {
                                const title = (job.title || "").toLowerCase();
                                const seniorKw = ["senior", "sr ", "sr.", "lead", "staff", "principal", "architect", "manager", "director", "vp", "head", "expert"];
                                if (seniorKw.some(kw => title.includes(kw))) return false;
                            }
                            return true;
                        });
                    }

                    for (const j of newJobs) {
                        if (!existingUrls.has(j.job_url)) {
                            existingUrls.add(j.job_url);
                            allJobs.push(j);
                        }
                    }
                    totalCount = allJobs.length;
                }
            }
        }

        // v2.0: Smart ranking by resume match when user is identified
        let rankedJobs = allJobs;
        let userSkillsForResponse: string[] = [];
        if (user_id && allJobs.length > 0) {
            try {
                rankedJobs = await rankJobsForUser(user_id as string, allJobs, allJobs.length);
                userSkillsForResponse = await getUserSkillsForMatching(user_id as string);
            } catch (rankErr: any) {
                console.warn("[JobListings] Ranking failed, returning unranked:", rankErr.message);
            }
        }

        const responseData = {
            jobs: rankedJobs,
            count: rankedJobs.length,
            total: totalCount,
            user_skills: userSkillsForResponse,
        };
        routeCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
        res.json(responseData);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/job-listings/fetch — trigger manual job fetch (now uses MCP)
router.post("/fetch", async (_req, res: Response) => {
    try {
        const result = await syncJobsViaMCP();
        res.json({ message: `MCP sync complete. Stored: ${result.total}, Errors: ${result.errors}` });
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
