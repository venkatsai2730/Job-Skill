// ═══════════════════════════════════════════════════════════════
// Job Listings Routes — Domain-aware multi-stage recommender
//
// Two-pool architecture:
//   primary_jobs    → jobs matching user's domain + related domains
//   cross_domain_jobs → other tech jobs (same location/experience)
//
// Anonymous users get the legacy flat { jobs, total } response.
// ═══════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { searchJobs, extractExperience, detectCategory } from "../services/jobFetcher.js";
import { mcpLiveSearch } from "../mcp/mcpClient.js";
import { syncJobsViaMCP } from "../mcp/jobSyncCron.js";
import { rankJobsForUser, getUserSkillsForMatching } from "../services/jobRankingService.js";
import { supabaseAdmin } from "../config/supabase.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

// ── New domain-aware imports ─────────────────────────────────
import {
    classifyJobDomain, isDomainMatch, getRelatedDomains,
    JOB_DOMAIN_LABELS, type JobDomain, JOB_DOMAIN_VALUES, isTechTitle,
} from "../services/jobDomainClassifier.js";
import {
    computeRelevanceScore, computeSkillOverlap, computeTitleSimilarity,
    computeLocationMatch, computeRecencyScore,
    MIN_PRIMARY_RELEVANCE, RELAXED_PRIMARY_RELEVANCE, MIN_PRIMARY_JOBS,
    type RelevanceSignals,
} from "../services/relevanceScorer.js";
import {
    estimateShortlistingChance, type UserProfile, type ScoredJob,
} from "../services/shortlistingChance.js";

const router = Router();

// Memory Cache to speed up job queries
const routeCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Infer user domain from title + skills ────────────────────
function inferUserDomain(title: string, skills: string[]): JobDomain {
    return classifyJobDomain(title, "", skills);
}

// GET /api/job-listings — search/browse jobs (DB + optional live JSearch merge)
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const cacheKey = req.originalUrl;
        // Only use cache for unauthenticated/anonymous requests
        // Authenticated users get fresh personalized results every time
        const hasUser = !!(req.query.user_id);
        if (!hasUser) {
            const cached = routeCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                res.json(cached.data);
                return;
            }
        }

        const { query, location, skills, experience_max, limit, page, preferred_location, city, country, user_id, category } = req.query;

        // An EXPLICIT location is one the user typed into the filter box (as opposed to
        // the geo-detected city/country). When present we treat it as a HARD constraint:
        // keep the DB location filter on, drop non-matching jobs, and pull live jobs for it.
        const explicitLocation = typeof location === "string" && location.trim() ? location.trim() : "";

        const parsedLimit = limit ? parseInt(limit as string) : (hasUser ? 300 : 40);
        // For domain-aware split we need a much larger raw pool; pagination happens after split
        const dbFetchLimit = (hasUser && !category) ? Math.max(parsedLimit, 1000) : parsedLimit;
        const parsedPage = page ? parseInt(page as string) : 1;
        const parsedExpMax = experience_max !== undefined && experience_max !== "" 
            ? parseInt(experience_max as string) 
            : undefined;

        // Fetch user profile for resume-based matching
        let userSkills: string[] = [];
        let userExperienceYears: number | undefined;
        let userSeniority: string | undefined;
        let userPrimaryDomain: string | null = null;
        let userCurrentRole: string = "";

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
            // ALWAYS enrich from resume (profile may be stale or missing project/inferred skills)
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
                    // Split parenthetical groups: "Python (pandas, NumPy)" → ["Python", "pandas", "NumPy"]
                    const resumeExplicitSkills = skillGroups.flatMap((g: any) => g.items || []).flatMap((s: string) => {
                        const base = s.replace(/\s*\([^)]*\)/g, '').trim();
                        const parenMatch = s.match(/\(([^)]+)\)/);
                        const parenItems = parenMatch ? parenMatch[1].split(/[,;]/).map((i: string) => i.trim()).filter(Boolean) : [];
                        return [base, ...parenItems].filter(i => i.length > 0);
                    });
                    
                    // Also include LLM-inferred skills (from projects/experience)
                    const inferredSkills: string[] = pd?.ats?.inferredSkills || [];

                    // Also include skills from project tech stacks
                    const projects = pd?.sections?.projects || [];
                    const projectTechSkills = projects.flatMap((p: any) => (p.tech || []).map((t: string) => t.trim())).filter(Boolean);

                    // Merge all sources
                    const allResumeSkills = [...resumeExplicitSkills, ...inferredSkills, ...projectTechSkills];
                    if (allResumeSkills.length > 0) {
                        userSkills = Array.from(new Set([...userSkills, ...allResumeSkills]));
                    }

                    // Infer experience from resume sections if not already set
                    if (!userExperienceYears) {
                        const expEntries = pd?.sections?.experience || [];
                        if (expEntries.length > 0) {
                            userExperienceYears = Math.min(expEntries.length * 2, 15);
                        }
                    }

                    // ── Domain Detection (from same resume fetch) ──
                    userCurrentRole = pd?.sections?.experience?.[0]?.title || "";
                    const summary = pd?.sections?.summary || "";
                    const roleAndSummary = `${userCurrentRole} ${summary}`.toLowerCase();
                    
                    if (/\b(data\s*scien|machine\s*learn|ml\s*engineer|ai\s*engineer|deep\s*learn|nlp|data\s*analyst|analytics)/i.test(roleAndSummary)) {
                        userPrimaryDomain = "data-science-ml";
                    } else if (/\b(frontend|front.?end|react|angular|vue|ui\s*developer|web\s*developer)/i.test(roleAndSummary)) {
                        userPrimaryDomain = "frontend";
                    } else if (/\b(backend|back.?end|server|api\s*developer|node|java\s*developer|python\s*developer)/i.test(roleAndSummary)) {
                        userPrimaryDomain = "backend";
                    } else if (/\b(full.?stack|fullstack)/i.test(roleAndSummary)) {
                        userPrimaryDomain = "backend";
                    } else if (/\b(devops|sre|cloud\s*engineer|infrastructure|platform\s*engineer)/i.test(roleAndSummary)) {
                        userPrimaryDomain = "devops";
                    } else if (/\b(data\s*engineer|etl|pipeline|spark|airflow|warehouse)/i.test(roleAndSummary)) {
                        userPrimaryDomain = "data-analytics";
                    } else if (/\b(android|ios|mobile|flutter|react\s*native|swift|kotlin)/i.test(roleAndSummary)) {
                        userPrimaryDomain = "mobile";
                    }
                }
            } catch { /* no resume */ }
        }

        // Clean and deduplicate skills before passing to search
        if (userSkills.length > 0) {
            userSkills = Array.from(new Set(
                userSkills
                    .flatMap(s => {
                        if (s.includes('(')) {
                            const base = s.replace(/\s*\([^)]*\)/g, '').trim();
                            const parenMatch = s.match(/\(([^)]+)\)/);
                            const parenItems = parenMatch ? parenMatch[1].split(/[,;]/).map(i => i.trim()).filter(Boolean) : [];
                            return [base, ...parenItems];
                        }
                        return [s];
                    })
                    .map(s => s.trim())
                    .filter(s => s.length >= 2 && s.length <= 50)
            ));
        }

        // Infer user domain from classifier when regex-based detection didn't work
        let userDomain: JobDomain | null = null;
        if (userPrimaryDomain && JOB_DOMAIN_VALUES.includes(userPrimaryDomain as JobDomain)) {
            userDomain = userPrimaryDomain as JobDomain;
        } else if (user_id && userSkills.length > 0) {
            // Use the domain classifier on the user's own profile
            userDomain = inferUserDomain(userCurrentRole, userSkills);
        }
        // Logged-in users with no detectable domain still get domain-split routing
        if (user_id && userDomain === null) {
            userDomain = "generic-fresher";
        }

        // Debug: Log what skills are being used for matching
        if (user_id && userSkills.length > 0) {
            console.log(`[JobListings] User ${(user_id as string).substring(0, 8)}... matching with ${userSkills.length} skills: ${userSkills.slice(0, 15).join(", ")}${userSkills.length > 15 ? '...' : ''}`);
            console.log(`[JobListings] Domain: ${userDomain || 'unknown'}, Role: ${userCurrentRole || 'unknown'}, Experience: ${userExperienceYears || 'unknown'} yrs`);
        }

        // Search the DB with all advanced features
        const result = await searchJobs({
            query: query as string,
            location: location as string,
            skills: skills ? (skills as string).split(",") : undefined,
            experience_max: parsedExpMax ?? userExperienceYears,
            limit: dbFetchLimit,
            // Domain-aware users normally score location in-memory, BUT when the user
            // explicitly typed a location we keep the hard DB filter so the pool is
            // actually constrained to that city/country (+ remote).
            bypassLocationFilter: !!userDomain && !explicitLocation,
            page: parsedPage,
            preferred_location: preferred_location as string,
            city: city as string,
            country: country as string,
            category: category as string,
            // Resume-based matching
            user_skills: userSkills.length > 0 ? userSkills : undefined,
            user_experience_years: userExperienceYears,
            user_seniority: userSeniority,
            user_primary_domain: userPrimaryDomain || undefined,
        });

        let allJobs = result.data;
        let totalCount = result.total;

        // If DB results are too few, supplement with MCP live scraping (no API keys)
        const supplementThreshold = hasUser ? 100 : 50;
        const supplementLocation = (location || city || preferred_location || "India") as string;

        // When the user explicitly set a location, count how many fetched jobs actually
        // match it (city/country/remote). If that pool is thin, force a live search for
        // that location so India/Hyderabad jobs get pulled even when the DB has plenty
        // of (US) jobs overall.
        const explicitCountry = (country || preferred_location || "") as string;
        const locMatchCount = explicitLocation
            ? allJobs.filter((j: any) =>
                computeLocationMatch(j.location || "", explicitLocation.toLowerCase(), explicitCountry.toLowerCase()) >= 0.5
              ).length
            : Infinity;
        const needLocationSupplement = !!explicitLocation && locMatchCount < (hasUser ? 60 : 30);

        if ((allJobs.length < supplementThreshold || needLocationSupplement) && (location || city || query || hasUser)) {
            const searchLocation = supplementLocation;
            const searchQuery = (query || "") as string;

            // Domain-aware fallback queries so a DS user gets "data scientist" not "software engineer"
            const DOMAIN_FALLBACK_QUERIES: Record<string, string[]> = {
                "data-science-ml":    ["data scientist", "machine learning engineer", "ai engineer"],
                "data-analytics":     ["data analyst", "business analyst", "analytics engineer"],
                "frontend":           ["frontend developer", "react developer", "ui developer"],
                "backend":            ["backend developer", "software engineer", "api developer"],
                "mobile":             ["android developer", "ios developer", "flutter developer"],
                "devops":             ["devops engineer", "cloud engineer", "sre"],
                "generic-fresher":    ["fresher software engineer", "junior developer"],
            };
            const domainFallbacks = userPrimaryDomain ? (DOMAIN_FALLBACK_QUERIES[userPrimaryDomain] || []) : [];

            // For fresher searches, use targeted queries to get more relevant results
            const isFresherSearch = parsedExpMax !== undefined && parsedExpMax <= 2;
            const queries = isFresherSearch
                ? [
                    `junior ${searchQuery || "developer"}`,
                    `entry level ${searchQuery || "software engineer"}`,
                    `fresher ${searchQuery || "developer"}`,
                    `intern ${searchQuery || "software"}`,
                  ]
                : searchQuery
                    ? [searchQuery]
                    : domainFallbacks.length > 0
                        ? domainFallbacks
                        : ["software engineer"];

            const existingUrls = new Set(allJobs.map((j: any) => j.job_url));
            const targetCount = hasUser ? 200 : 40;
            
            for (const q of queries) {
                if (allJobs.length >= targetCount) break;
                const liveJobs = await mcpLiveSearch(q, searchLocation, 50);

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
                            job_domain: classifyJobDomain(j.title, j.description || "", []),
                        }));

                    // Apply experience filtering to live jobs before appending
                    if (parsedExpMax !== undefined && !isNaN(parsedExpMax)) {
                        newJobs = newJobs.filter(job => {
                            const exp = extractExperience(job.description || "");
                            if (exp.min !== null && exp.min > parsedExpMax) return false;
                            
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

        // Ensure selection_chance exists on all jobs (defaults for non-ranked)
        const finalJobs = rankedJobs.map((j: any) => ({
            ...j,
            selection_chance: j.selection_chance ?? 0,
            selection_reason: j.selection_reason ?? "",
        }));

        // ═══════════════════════════════════════════════════════
        // DOMAIN-AWARE SPLIT (only for authenticated users)
        // ═══════════════════════════════════════════════════════
        if (user_id && userDomain) {
            const userCity = ((city || location || "") as string).toLowerCase();
            const userCountry = ((country || preferred_location || "") as string).toLowerCase();

            // Remove clearly non-tech jobs that slipped in (e.g. telecallers, hospitality, delivery).
            // We do NOT use the full isTechTitle() check here because it rejects legitimate roles
            // with ambiguous titles ("Solution Architect", "Team Lead", "Intern") that don't contain
            // explicit tech keywords. Instead we only block confirmed non-tech keyword patterns.
            const OBVIOUS_NON_TECH = /\b(telecaller|telecalling|bpo\s*exec|call\s*center|fundraising|real\s*estate\s*agent|chef|cook|driver|delivery\s*(boy|exec|partner)|rider|warehouse|logistics\s*exec|hospital\s*staff|nurse|nursing|doctor|dentist|physiotherap|accountant|ca\s*article|chartered\s*account|content\s*writ(?!er.*tech)|fashion\s*design|textile|apparel|insurance\s*agent|loan\s*officer|mortgage|telecall)\b/i;
            let domainInputJobs = finalJobs.filter((j: any) => {
                const title = (j.title || "").trim();
                if (!title) return false;               // drop blank-title rows
                return !OBVIOUS_NON_TECH.test(title);   // keep everything that isn't clearly non-tech
            });
            const userExp = userExperienceYears || 0;
            const userSeniorityStr = userSeniority || (userExp <= 1 ? "intern" : userExp <= 3 ? "entry" : userExp <= 6 ? "mid" : "senior");

            // Build UserProfile for shortlisting estimator
            const userProfile: UserProfile = {
                skills: userSkills,
                experienceYears: userExp,
                seniority: userSeniorityStr,
                domain: userDomain,
            };

            // Score and classify each job
            const scoredPrimary: any[] = [];
            const scoredCross: any[] = [];

            for (const job of domainInputJobs) {
                // Classify job domain (use stored value or compute on-the-fly)
                const jobDomain: JobDomain = (
                    job.job_domain && JOB_DOMAIN_VALUES.includes(job.job_domain)
                        ? job.job_domain
                        : classifyJobDomain(job.title || "", job.description || "", job.skills || [])
                ) as JobDomain;

                const domainMatch = isDomainMatch(userDomain, jobDomain);

                // Compute relevance signals
                const { ratio: skillOverlapRatio, matchedSkills, skillGap } = computeSkillOverlap(
                    userSkills, job.skills || [], job.description || ""
                );
                const titleSim = computeTitleSimilarity(userCurrentRole, job.title || "");
                const locationMatch = computeLocationMatch(job.location || "", userCity, userCountry);

                // HARD location filter: when the user explicitly typed a location, drop
                // jobs that don't match it (keeps in-city + same-country + remote, removes
                // e.g. US-only roles). This is the fix for "Hyderabad shows only US jobs".
                if (explicitLocation && locationMatch < 0.5) continue;

                const recency = computeRecencyScore(job.posted_at || "");

                const signals: RelevanceSignals = {
                    domainMatch,
                    skillOverlapRatio,
                    titleSimilarity: titleSim,
                    locationMatch,
                    recencyScore: recency,
                };
                const relevanceScore = computeRelevanceScore(signals);

                // Estimate shortlisting chance
                const scoredJob: ScoredJob = {
                    title: job.title || "",
                    company: job.company || "",
                    skills: job.skills || [],
                    seniority_level: job.seniority_level || "unknown",
                    job_domain: jobDomain,
                    posted_at: job.posted_at || "",
                    relevanceScore,
                    skillOverlapRatio,
                    domainMatch,
                };
                const shortlist = estimateShortlistingChance(userProfile, scoredJob);

                // Enrich job with new fields
                const enrichedJob = {
                    ...job,
                    job_domain: jobDomain,
                    job_domain_label: JOB_DOMAIN_LABELS[jobDomain] || jobDomain,
                    relevance_score: relevanceScore,
                    matched_skills: matchedSkills.length > 0 ? matchedSkills : (job.matched_skills || []),
                    skill_gap: skillGap.length > 0 ? skillGap : (job.skill_gap || []),
                    shortlisting_chance: shortlist.chance,
                    shortlisting_band: shortlist.band,
                    shortlisting_reason: shortlist.reason,
                    domain_match: domainMatch,
                };

                if (domainMatch) {
                    scoredPrimary.push(enrichedJob);
                } else {
                    scoredCross.push(enrichedJob);
                }
            }

            // Sort both pools by relevance score (descending)
            scoredPrimary.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
            scoredCross.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

            // Apply a very loose relevance floor just to drop truly irrelevant noise
            const minFloor = 0.10;
            let primaryFiltered = scoredPrimary.filter(j => (j.relevance_score || 0) >= minFloor);
            // If floor cuts too much, include everything
            if (primaryFiltered.length < MIN_PRIMARY_JOBS) {
                primaryFiltered = scoredPrimary;
            }

            // Cap each pool so the API response stays reasonable
            const MAX_PRIMARY = 200;
            const MAX_CROSS   = 100;

            const responseData = {
                primary_jobs: primaryFiltered.slice(0, MAX_PRIMARY),
                cross_domain_jobs: scoredCross.slice(0, MAX_CROSS),
                meta: {
                    user_domain: userDomain,
                    user_domain_label: JOB_DOMAIN_LABELS[userDomain] || userDomain,
                    total_primary: Math.min(primaryFiltered.length, MAX_PRIMARY),
                    total_cross: Math.min(scoredCross.length, MAX_CROSS),
                    total_primary_available: primaryFiltered.length,
                    total_cross_available: scoredCross.length,
                    debug_db_fetched: allJobs.length,
                    debug_after_rank: finalJobs.length,
                    debug_after_tech_filter: domainInputJobs.length,
                    user_skills_count: userSkills.length,
                    related_domains: getRelatedDomains(userDomain).map(d => ({
                        domain: d,
                        label: JOB_DOMAIN_LABELS[d] || d,
                    })),
                },
                // Keep backward-compatible fields for any consumers
                user_skills: userSkillsForResponse,
            };

            res.json(responseData);
            return;
        }

        // ═══════════════════════════════════════════════════════
        // ANONYMOUS / LEGACY RESPONSE (backward compatible)
        // ═══════════════════════════════════════════════════════
        const responseData = {
            jobs: finalJobs,
            count: finalJobs.length,
            total: totalCount,
            user_skills: userSkillsForResponse,
        };
        // Only cache anonymous (non-personalized) responses
        if (!user_id) {
            routeCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
        }
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
