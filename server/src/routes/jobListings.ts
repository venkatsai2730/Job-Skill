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
import { rankJobsForUserWithSkills } from "../services/jobRankingService.js";
import { supabaseAdmin } from "../config/supabase.js";
import { optionalAuthToken, AuthRequest } from "../middleware/auth.js";

// ── New domain-aware imports ─────────────────────────────────
import {
    classifyJobDomain, classifyDomainBySkills, isDomainMatch, getRelatedDomains,
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
import { isJobInUserRegion, isPureRemote } from "../services/locationRelevance.js";

const router = Router();

// Memory Cache to speed up job queries
const routeCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 200; // bound the cache so it can't grow unboundedly

// ── Infer user domain from title + skills ────────────────────
function inferUserDomain(title: string, skills: string[]): JobDomain {
    return classifyJobDomain(title, "", skills);
}

// GET /api/job-listings — search/browse jobs (DB + optional live JSearch merge)
router.get("/", optionalAuthToken, async (req: AuthRequest, res: Response) => {
    try {
        const cacheKey = req.originalUrl;
        // Only use cache for unauthenticated/anonymous requests
        // Authenticated users get fresh personalized results every time
        const hasUser = !!(req.user?.userId);
        if (!hasUser) {
            const cached = routeCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                res.json(cached.data);
                return;
            }
        }

        const { query, location, skills, experience_max, limit, page, preferred_location, city, country, category } = req.query;
        const user_id = req.user?.userId;

        // An EXPLICIT location is one the user typed into the filter box (as opposed to
        // the geo-detected city/country). When present we treat it as a HARD constraint:
        // keep the DB location filter on, drop non-matching jobs, and pull live jobs for it.
        const explicitLocation = typeof location === "string" && location.trim() ? location.trim() : "";

        const parsedLimit = limit ? parseInt(limit as string) : (hasUser ? 300 : 40);
        // For domain-aware split we need the FULL in-region pool, not just the
        // most-recent ~1000 global jobs (which left only ~100 India rows and
        // starved the feed). searchJobs pages through the DB up to this many.
        const dbFetchLimit = (hasUser && !category) ? 8000 : parsedLimit;
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
                    .eq("user_id", user_id)
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
                    .eq("user_id", user_id)
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
                    userPrimaryDomain = classifyJobDomain(userCurrentRole, summary, userSkills) as string;
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
        // Skills-first upgrade: classifyJobDomain()/inferUserDomain() short-circuit
        // to "generic-fresher" whenever the user's title is missing or non-tech
        // (e.g. a mis-parsed resume role like "default."), discarding a strong
        // skills signal. When that happens, fall back to a title-gate-free,
        // skills-only classification so a Data-Science/Backend candidate isn't
        // dumped into the generic fresher pool. Never downgrades a real domain.
        if (user_id && (userDomain === null || userDomain === "generic-fresher") && userSkills.length > 0) {
            const bySkills = classifyDomainBySkills(userSkills);
            if (bySkills) {
                userDomain = bySkills;
                userPrimaryDomain = bySkills;
            }
        }
        // Logged-in users with no detectable domain still get domain-split routing
        if (user_id && userDomain === null) {
            userDomain = "generic-fresher";
        }

        // Debug: Log what skills are being used for matching
        if (user_id && userSkills.length > 0) {
            console.log(`[JobListings] User ${user_id.substring(0, 8)}... matching with ${userSkills.length} skills: ${userSkills.slice(0, 15).join(", ")}${userSkills.length > 15 ? '...' : ''}`);
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
        // Location target = the typed location OR (falling back to) the user's
        // country from geo/profile. We constrain the feed to this even when the
        // user hasn't typed anything, so results stay in-country (+ remote)
        // instead of showing global jobs.
        const locationTarget = explicitLocation || explicitCountry.trim();
        // Count how many fetched jobs actually match the target location. For a
        // typed city we use the city-level score; for the geo-country case we use
        // the region matcher (so "Remote - US" is NOT miscounted as an India job).
        const locMatchCount = locationTarget
            ? allJobs.filter((j: any) =>
                explicitLocation
                    ? computeLocationMatch(j.location || "", explicitLocation.toLowerCase(), explicitCountry.toLowerCase()) >= 0.5
                    : isJobInUserRegion(j.location || "", (city as string) || "", explicitCountry)
              ).length
            : Infinity;
        const needLocationSupplement = !!locationTarget && locMatchCount < (hasUser ? 60 : 30);

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
                // When we still need location-specific jobs, keep pulling even if the
                // overall pool is already large — it may be full of out-of-country jobs.
                if (!needLocationSupplement && allJobs.length >= targetCount) break;
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
        // Use already-loaded userSkills to avoid a second DB fetch
        const userSkillsForResponse: string[] = userSkills;
        if (user_id && allJobs.length > 0) {
            try {
                rankedJobs = await rankJobsForUserWithSkills(
                    user_id,
                    allJobs,
                    userSkills,
                    userExperienceYears ?? 0,
                    allJobs.length,
                );
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

            // ── Location gate ──────────────────────────────────────────
            // When the user hasn't typed an explicit location, constrain the feed
            // to their country (+ remote) rather than showing global jobs. This is
            // the catch-all that also removes live-scraped foreign jobs (Arbeitnow /
            // LinkedIn) which bypass the DB location filter. Falls back to the
            // unfiltered set if nothing matches so the feed is never empty.
            // (Typed locations are narrowed to city level per-job below.)
            if (!explicitLocation && userCountry) {
                const inRegion = domainInputJobs.filter((j: any) =>
                    isJobInUserRegion(j.location || "", userCity, userCountry)
                );
                if (inRegion.length > 0) domainInputJobs = inRegion;
            }
            const userExp = userExperienceYears || 0;
            const userSeniorityStr = userSeniority || (userExp <= 1 ? "intern" : userExp <= 3 ? "entry" : userExp <= 6 ? "mid" : "senior");

            // Build UserProfile for shortlisting estimator
            const userProfile: UserProfile = {
                skills: userSkills,
                experienceYears: userExp,
                seniority: userSeniorityStr,
                domain: userDomain,
            };

            // Roles clearly above a junior candidate's level. For <2yr users these
            // are hidden — a fresher won't get a callback, so they're just noise.
            const SENIOR_TITLE_RE = /\b(senior|sr\.?|lead|staff|principal|architect|manager|director|vp|head|expert)\b/i;
            const hideSenior = userExp < 2;

            // Score and classify each job
            const scoredPrimary: any[] = [];
            const scoredCross: any[] = [];

            for (const job of domainInputJobs) {
                // Hide senior/staff/principal roles for junior candidates.
                if (hideSenior && SENIOR_TITLE_RE.test(job.title || "")) continue;

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

                // HARD location filter: when the user explicitly typed a location, keep only
                // jobs in that location or remote jobs. Same-country-only matches (e.g. a
                // Bengaluru job when the user asked for Hyderabad) score 0.6 from
                // computeLocationMatch but are NOT what the user asked for, so drop them.
                // (A plain `locationMatch < X` threshold can't express this because remote =
                // 0.5 scores below same-country = 0.6.)
                if (explicitLocation) {
                    const isCityMatch = locationMatch >= 1.0;
                    // Accept remote roles ONLY when they are location-agnostic
                    // ("Remote", "Fully Remote / Worldwide"). A place-tagged remote
                    // role ("Remote, Canada", "Remote - USA", "Remote, Bangalore")
                    // is tied to a DIFFERENT location than the one the user typed,
                    // so it must be dropped — the naive /remote/ test kept them all,
                    // flooding a "Hyderabad" search with foreign jobs.
                    const isAgnosticRemote = isPureRemote(job.location || "");
                    if (!isCityMatch && !isAgnosticRemote) continue;
                }

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
                    // Alias so frontend components reading either field work consistently
                    selection_chance: shortlist.chance,
                    selection_reason: shortlist.reason,
                    domain_match: domainMatch,
                };

                if (domainMatch) {
                    scoredPrimary.push(enrichedJob);
                } else {
                    scoredCross.push(enrichedJob);
                }
            }

            // Ordering WITHIN each pool: exact-domain matches (e.g. DS/ML for a
            // Data Scientist) float ABOVE related-domain roles (backend/analytics),
            // then the harder-penalized match_score (PhD / seniority / tier-1
            // penalties), then relevance_score as a final tiebreak. The
            // primary/cross SPLIT itself is still decided by domainMatch above.
            const isExactDomain = (j: any) => (j.job_domain === userDomain ? 1 : 0);
            const byScore = (a: any, b: any) =>
                isExactDomain(b) - isExactDomain(a) ||
                (b.match_score || 0) - (a.match_score || 0) ||
                (b.relevance_score || 0) - (a.relevance_score || 0);
            scoredPrimary.sort(byScore);
            scoredCross.sort(byScore);

            // Apply the configured relevance floor; relax it (then drop it) when the
            // primary pool would otherwise be too thin. Uses the tunable thresholds
            // from relevanceScorer instead of a magic number.
            let primaryFiltered = scoredPrimary.filter(j => (j.relevance_score || 0) >= MIN_PRIMARY_RELEVANCE);
            if (primaryFiltered.length < MIN_PRIMARY_JOBS) {
                primaryFiltered = scoredPrimary.filter(j => (j.relevance_score || 0) >= RELAXED_PRIMARY_RELEVANCE);
            }
            if (primaryFiltered.length < MIN_PRIMARY_JOBS) {
                primaryFiltered = scoredPrimary;
            }

            // Cap each pool so the API response stays reasonable. Raised so the
            // feed can surface the full in-region pool (hundreds of jobs).
            const MAX_PRIMARY = 600;
            const MAX_CROSS   = 300;

            const responseData = {
                primary_jobs: primaryFiltered.slice(0, MAX_PRIMARY),
                cross_domain_jobs: scoredCross.slice(0, MAX_CROSS),
                meta: {
                    user_domain: userDomain,
                    user_domain_label: JOB_DOMAIN_LABELS[userDomain] || userDomain,
                    user_experience_years: userExp,
                    user_seniority: userSeniorityStr,
                    relevance_threshold: MIN_PRIMARY_RELEVANCE,
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
            // Evict oldest entries once we exceed the cap (Map preserves insertion order)
            while (routeCache.size > MAX_CACHE_ENTRIES) {
                const oldestKey = routeCache.keys().next().value;
                if (oldestKey === undefined) break;
                routeCache.delete(oldestKey);
            }
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
