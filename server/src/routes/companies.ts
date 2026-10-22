import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { getAIReply } from "../services/chatService.js";

const router = Router();
router.use(authenticateToken);

interface CompanyProfile {
    name: string;
    domain: string;
    industry: string;
    headquarters: string;
    size: string;
    visaH1B: {
        status: "Sponsors Visas" | "Limited Sponsorship" | "Does Not Sponsor";
        score: number; // 0-100
        filingsPerYear: string;
        greenCardSupport: string;
        notes: string;
    };
    interviewInsights: {
        difficulty: number; // 1-5
        typicalStages: string[];
        codingEmphasis: string;
        systemDesignEmphasis: string;
    };
    salaryBenchmarks: {
        level: string;
        baseRange: string;
        totalCompRange: string;
    }[];
    techStack: string[];
    cultureRating: number; // 1-5
    hiringVelocity: "Aggressive" | "Active" | "Selective" | "Slow";
}

const KNOWN_COMPANIES: Record<string, CompanyProfile> = {
    google: {
        name: "Google (Alphabet)",
        domain: "google.com",
        industry: "Big Tech / AI / Cloud",
        headquarters: "Mountain View, CA",
        size: "180,000+ employees",
        visaH1B: {
            status: "Sponsors Visas",
            score: 96,
            filingsPerYear: "6,500+ petitions/yr",
            greenCardSupport: "Day-1 PERM processing available for full-time roles",
            notes: "One of the largest H1B employers in the US. Robust immigration legal team.",
        },
        interviewInsights: {
            difficulty: 4.2,
            typicalStages: ["Recruiter Screen", "Technical Phone Screen (DSA)", "4-5 Onsite Rounds (Coding, System Design, Googlyness)"],
            codingEmphasis: "Heavy emphasis on clean algorithms, graph traversal, and boundary checks.",
            systemDesignEmphasis: "Plan for planetary scale, eventual consistency, and data sharding.",
        },
        salaryBenchmarks: [
            { level: "L3 (Entry)", baseRange: "$135k - $160k", totalCompRange: "$190k - $225k" },
            { level: "L4 (Mid)", baseRange: "$165k - $195k", totalCompRange: "$260k - $320k" },
            { level: "L5 (Senior)", baseRange: "$205k - $245k", totalCompRange: "$370k - $460k" },
            { level: "L6 (Staff)", baseRange: "$260k - $310k", totalCompRange: "$530k - $680k" },
        ],
        techStack: ["Go", "C++", "Python", "Kubernetes", "Borg", "Spanner", "Angular", "TensorFlow"],
        cultureRating: 4.4,
        hiringVelocity: "Active",
    },
    amazon: {
        name: "Amazon",
        domain: "amazon.com",
        industry: "E-Commerce / Cloud / AI",
        headquarters: "Seattle, WA",
        size: "1,500,000+ employees",
        visaH1B: {
            status: "Sponsors Visas",
            score: 95,
            filingsPerYear: "7,000+ petitions/yr",
            greenCardSupport: "Sponsors PERM generally after 1 year of continuous tenure",
            notes: "Massive annual H1B sponsor across AWS, Prime Video, and Core Retail.",
        },
        interviewInsights: {
            difficulty: 3.9,
            typicalStages: ["Online Assessment (2 Coding + Work Style)", "Technical Screen", "Loop (4-5 rounds including Bar Raiser)"],
            codingEmphasis: "High focus on BFS/DFS, Trees, Sliding Window, and clean object-oriented design.",
            systemDesignEmphasis: "Strict adherence to 16 Leadership Principles with STAR method.",
        },
        salaryBenchmarks: [
            { level: "SDE I (Entry)", baseRange: "$130k - $155k", totalCompRange: "$175k - $205k" },
            { level: "SDE II (Mid)", baseRange: "$160k - $190k", totalCompRange: "$240k - $295k" },
            { level: "SDE III (Senior)", baseRange: "$195k - $235k", totalCompRange: "$340k - $430k" },
            { level: "Principal", baseRange: "$240k - $290k", totalCompRange: "$550k - $750k" },
        ],
        techStack: ["Java", "AWS Services", "TypeScript", "Python", "DynamoDB", "ECS/EKS"],
        cultureRating: 3.8,
        hiringVelocity: "Aggressive",
    },
    microsoft: {
        name: "Microsoft",
        domain: "microsoft.com",
        industry: "Cloud / Enterprise Software / AI",
        headquarters: "Redmond, WA",
        size: "220,000+ employees",
        visaH1B: {
            status: "Sponsors Visas",
            score: 94,
            filingsPerYear: "5,000+ petitions/yr",
            greenCardSupport: "Day-1 PERM processing initiated for eligible full-time hires",
            notes: "Consistently rated one of the most immigrant-friendly employers in the tech industry.",
        },
        interviewInsights: {
            difficulty: 3.8,
            typicalStages: ["Recruiter Chat", "Codility/Teams Technical Screen", "4 Onsite Rounds (Design & Implementation)"],
            codingEmphasis: "Standard LeetCode medium questions with focus on readable, idiomatic code.",
            systemDesignEmphasis: "Distributed microservices, Azure architectures, and caching tiers.",
        },
        salaryBenchmarks: [
            { level: "L59-L60 (Entry)", baseRange: "$120k - $145k", totalCompRange: "$160k - $190k" },
            { level: "L61-L62 (Mid)", baseRange: "$150k - $180k", totalCompRange: "$210k - $270k" },
            { level: "L63-L64 (Senior)", baseRange: "$185k - $225k", totalCompRange: "$310k - $390k" },
            { level: "L65+ (Principal)", baseRange: "$235k - $280k", totalCompRange: "$480k - $650k" },
        ],
        techStack: ["C#", ".NET Core", "TypeScript", "Azure", "Python", "React", "CosmosDB"],
        cultureRating: 4.3,
        hiringVelocity: "Active",
    },
    meta: {
        name: "Meta (Facebook)",
        domain: "meta.com",
        industry: "Social Media / VR / AI",
        headquarters: "Menlo Park, CA",
        size: "67,000+ employees",
        visaH1B: {
            status: "Sponsors Visas",
            score: 93,
            filingsPerYear: "3,800+ petitions/yr",
            greenCardSupport: "Sponsors PERM and Green Card applications proactively",
            notes: "High compensation packages and top-tier visa legal counsel.",
        },
        interviewInsights: {
            difficulty: 4.3,
            typicalStages: ["Recruiter Screen", "1-2 Technical Screens (Speed Coding)", "Onsite (2 Coding, 1-2 System Design, 1 Behavioral)"],
            codingEmphasis: "Requires solving 2 LeetCode medium/hard questions in 45 minutes with bug-free code.",
            systemDesignEmphasis: "Newsfeed, Messenger, or Instagram architecture at billions of daily active users.",
        },
        salaryBenchmarks: [
            { level: "E3 (Entry)", baseRange: "$140k - $165k", totalCompRange: "$195k - $235k" },
            { level: "E4 (Mid)", baseRange: "$175k - $205k", totalCompRange: "$280k - $350k" },
            { level: "E5 (Senior)", baseRange: "$215k - $260k", totalCompRange: "$400k - $520k" },
            { level: "E6 (Staff)", baseRange: "$270k - $330k", totalCompRange: "$620k - $850k" },
        ],
        techStack: ["Hack/PHP", "Python", "React", "PyTorch", "C++", "GraphQL", "Cassandra"],
        cultureRating: 4.1,
        hiringVelocity: "Active",
    },
    stripe: {
        name: "Stripe",
        domain: "stripe.com",
        industry: "Fintech / Payments / Developer Infrastructure",
        headquarters: "San Francisco, CA & Dublin",
        size: "8,000+ employees",
        visaH1B: {
            status: "Sponsors Visas",
            score: 90,
            filingsPerYear: "850+ petitions/yr",
            greenCardSupport: "Comprehensive immigration sponsorship for engineering and product roles",
            notes: "Remote-first culture with generous relocation and sponsorship policies.",
        },
        interviewInsights: {
            difficulty: 4.4,
            typicalStages: ["Recruiter Screen", "Practical Coding (Bug Bash or API Integration)", "Onsite (Integration, Refactoring, System Design, Values)"],
            codingEmphasis: "Realistic coding environment: using your own IDE, looking up docs, writing unit tests.",
            systemDesignEmphasis: "Idempotency, payment state machines, exactly-once processing, and audit logs.",
        },
        salaryBenchmarks: [
            { level: "L1 (Junior)", baseRange: "$145k - $170k", totalCompRange: "$210k - $250k" },
            { level: "L2 (Mid)", baseRange: "$180k - $215k", totalCompRange: "$290k - $360k" },
            { level: "L3 (Senior)", baseRange: "$225k - $275k", totalCompRange: "$420k - $540k" },
            { level: "L4 (Staff)", baseRange: "$280k - $340k", totalCompRange: "$650k - $900k" },
        ],
        techStack: ["Ruby", "Sorbet", "Java", "Go", "TypeScript", "React", "PostgreSQL", "Kafka"],
        cultureRating: 4.2,
        hiringVelocity: "Active",
    },
};

// ── GET /api/companies/insights ── Fetch company insights & visa data
router.get("/insights", async (req: AuthRequest, res: Response) => {
    try {
        const query = (req.query.company as string || "").trim().toLowerCase();

        if (!query) {
            // Return featured companies
            return res.json({
                featured: Object.values(KNOWN_COMPANIES),
                meta: { totalKnown: Object.keys(KNOWN_COMPANIES).length }
            });
        }

        // Check if known in dictionary
        const key = Object.keys(KNOWN_COMPANIES).find(k => query.includes(k) || k.includes(query));
        if (key) {
            return res.json({ company: KNOWN_COMPANIES[key], source: "verified_database" });
        }

        // Otherwise generate real-time company intelligence using AI
        const prompt = `You are a tech recruiter & immigration specialist analyzing the company: "${req.query.company}".
Return a strictly valid JSON object with detailed intelligence in this exact format:
{
  "name": "${req.query.company}",
  "domain": "${query.replace(/[^a-z0-9]/g, "")}.com",
  "industry": "<industry sector>",
  "headquarters": "<city, state/country>",
  "size": "<e.g. 5,000+ employees>",
  "visaH1B": {
    "status": "<Sponsors Visas | Limited Sponsorship | Does Not Sponsor>",
    "score": <number 50-95>,
    "filingsPerYear": "<approximate annual petition volume>",
    "greenCardSupport": "<Green card sponsorship policy overview>",
    "notes": "<1-2 sentence immigration summary>"
  },
  "interviewInsights": {
    "difficulty": <number between 3.0 and 4.8>,
    "typicalStages": ["Stage 1", "Stage 2", "Stage 3"],
    "codingEmphasis": "<summary of technical interview style>",
    "systemDesignEmphasis": "<summary of architecture expectations>"
  },
  "salaryBenchmarks": [
    { "level": "Mid-Level", "baseRange": "$140k - $175k", "totalCompRange": "$180k - $230k" },
    { "level": "Senior", "baseRange": "$180k - $220k", "totalCompRange": "$250k - $340k" }
  ],
  "techStack": ["Primary Tech 1", "Tech 2", "Tech 3", "Tech 4", "Tech 5"],
  "cultureRating": 4.1,
  "hiringVelocity": "Active"
}

Do not include any extra text outside the JSON. Return only the JSON object.`;

        const result = await getAIReply([{ role: "user", content: prompt }], "chat");
        let cleaned = (result.reply || "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
            cleaned = cleaned.slice(start, end + 1);
        }

        const generatedProfile = JSON.parse(cleaned);
        res.json({ company: generatedProfile, source: "ai_intelligence" });
    } catch (err: any) {
        console.error("Company insights error:", err);
        res.status(500).json({ error: "Failed to load company insights" });
    }
});

export default router;
