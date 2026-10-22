import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { predictInterviewQuestions, getAIReply } from "../services/chatService.js";
import { supabaseAdmin } from "../config/supabase.js";
import { logActivity } from "../services/activityService.js";

const router = Router();

// Curated high-yield question bank from top-tier tech companies
const CURATED_QUESTIONS = [
    {
        id: "q-sys-1",
        category: "System Design",
        title: "Design a Scalable Distributed Rate Limiter",
        company: "Stripe",
        difficulty: "Medium",
        question: "How would you design a distributed API rate limiter capable of handling millions of requests per second across multiple data centers?",
        concepts: ["Token Bucket", "Sliding Window Log", "Redis Cluster", "Race Conditions", "Clock Skew"],
        starTip: "Discuss trade-offs between strict consistency (centralized Redis with Redis Cell or Lua scripts) vs local caching with periodic sync."
    },
    {
        id: "q-sys-2",
        category: "System Design",
        title: "Design a Global Job Notification & Alert Pipeline",
        company: "LinkedIn",
        difficulty: "Hard",
        question: "Design an alert system that matches new job postings to millions of candidate preferences in real-time and sends push notifications within 30 seconds.",
        concepts: ["Kafka Event Streaming", "Inverted Index", "Fan-out Pattern", "Dead-letter queues", "Notification Deduplication"],
        starTip: "Structure your answer: Capacity estimation, High-level flow, Ingestion vs Matching service, Fault tolerance & backpressure."
    },
    {
        id: "q-sys-3",
        category: "System Design",
        title: "Design a Real-Time Collaborative Document Editor",
        company: "Google",
        difficulty: "Hard",
        question: "Design a collaborative editor like Google Docs supporting real-time concurrent editing, offline reconciliation, and undo/redo.",
        concepts: ["Operational Transformation (OT)", "CRDTs (Conflict-free Replicated Data Types)", "WebSockets", "Snapshot storage"],
        starTip: "Focus on how concurrency conflicts are resolved without server locks."
    },
    {
        id: "q-beh-1",
        category: "Behavioral",
        title: "Handling High-Stakes Disagreement With Leadership",
        company: "Amazon",
        difficulty: "Medium",
        question: "Tell me about a time when you strongly disagreed with a senior engineer or product manager's technical decision. How did you handle it?",
        concepts: ["Disagree and Commit", "Data-driven persuasion", "Blameless collaboration", "Customer Obsession"],
        starTip: "Use STAR: Situation (high-impact project), Task (differing opinion on architecture), Action (benchmark prototypes with empirical metrics), Result (compromise with zero downtime)."
    },
    {
        id: "q-beh-2",
        category: "Behavioral",
        title: "Pivoting After a Critical Production Outage",
        company: "Meta",
        difficulty: "Medium",
        question: "Describe the most impactful production incident you caused or mitigated. What happened, and what permanent guardrails did you put in place?",
        concepts: ["Root Cause Analysis (5 Whys)", "Blameless Post-Mortem", "Circuit Breakers", "Automated Rollbacks"],
        starTip: "Emphasize ownership and long-term systemic improvements over defensive explanations."
    },
    {
        id: "q-beh-3",
        category: "Behavioral",
        title: "Delivering Under Severe Time Constraints & Ambiguity",
        company: "Apple",
        difficulty: "Hard",
        question: "Tell me about a project where specifications were ambiguous and the deadline was non-negotiable. How did you navigate the scope?",
        concepts: ["Ruthless Prioritization", "Stakeholder Alignment", "Iterative MVP", "Risk Mitigation"],
        starTip: "Explain how you phased deliverables: critical path first, secondary polish deferred with clear stakeholder buy-in."
    },
    {
        id: "q-cod-1",
        category: "Coding & DSA",
        title: "LRU Cache Implementation",
        company: "Microsoft",
        difficulty: "Medium",
        question: "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) get and put operations.",
        concepts: ["Doubly Linked List", "Hash Map", "O(1) Eviction", "Thread Safety"],
        starTip: "Explain why a combination of HashMap (pointer to node) and Doubly Linked List enables constant time updates."
    },
    {
        id: "q-cod-2",
        category: "Coding & DSA",
        title: "Top K Frequent Elements in Real-Time Stream",
        company: "Uber",
        difficulty: "Medium",
        question: "Given a continuous stream of search queries or events, how would you find the K most frequent elements at any given timestamp efficiently?",
        concepts: ["Min-Heap", "Count-Min Sketch", "Bucket Sort", "Space Optimization"],
        starTip: "Differentiate exact solutions (Min-Heap with HashMap) vs streaming approximation algorithms for scale."
    },
    {
        id: "q-lead-1",
        category: "Leadership & Culture",
        title: "Mentoring an Underperforming Engineer",
        company: "Netflix",
        difficulty: "Hard",
        question: "How do you approach a peer or junior engineer on your team who is struggling to meet project expectations?",
        concepts: ["Psychological Safety", "Actionable Feedback", "Skill vs Will Analysis", "Pair Programming"],
        starTip: "Demonstrate empathy combined with clear standards and incremental milestone setting."
    }
];

// ═══════════════════════════════════════════════════════════════
// GET /api/interview/question-bank
// ═══════════════════════════════════════════════════════════════
router.get("/question-bank", authenticateToken, (req: AuthRequest, res: Response) => {
    const { category, company, difficulty } = req.query;

    let filtered = [...CURATED_QUESTIONS];
    if (category && typeof category === "string") {
        filtered = filtered.filter(q => q.category.toLowerCase() === category.toLowerCase());
    }
    if (company && typeof company === "string") {
        filtered = filtered.filter(q => q.company.toLowerCase() === company.toLowerCase());
    }
    if (difficulty && typeof difficulty === "string") {
        filtered = filtered.filter(q => q.difficulty.toLowerCase() === difficulty.toLowerCase());
    }

    res.json({
        total: filtered.length,
        questions: filtered,
        categories: ["Coding & DSA", "System Design", "Behavioral", "Leadership & Culture"],
        companies: ["Google", "Amazon", "Meta", "Microsoft", "Apple", "LinkedIn", "Stripe", "Uber", "Netflix"]
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/interview/evaluate-answer
// ═══════════════════════════════════════════════════════════════
router.post("/evaluate-answer", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { question, userAnswer, category, company, role } = req.body;

        if (!question || !userAnswer || userAnswer.trim().length < 15) {
            res.status(400).json({ error: "Please provide both the question and a substantive practice answer." });
            return;
        }

        const prompt = `You are a Senior Principal Interviewer at a Tier-1 tech company evaluating a candidate's practice interview response.

Target Company: ${company || "Top Tech Firm"}
Target Role: ${role || "Software Engineer"}
Category: ${category || "General"}
Question: "${question}"
Candidate Answer: "${userAnswer}"

Evaluate this answer thoroughly. Return a strictly valid JSON object with this exact shape:
{
  "score": <number between 40 and 100>,
  "verdict": "<Strong Hire | Hire | Leaning Hire | Leaning No Hire>",
  "strengths": [
    "<strength 1>",
    "<strength 2>"
  ],
  "areasForImprovement": [
    "<actionable suggestion 1>",
    "<actionable suggestion 2>"
  ],
  "starBreakdown": {
    "situation": "<evaluation of how well situation/context was framed>",
    "action": "<evaluation of candidate's individual technical actions>",
    "result": "<evaluation of business impact or metrics provided>"
  },
  "modelAnswer": "<A polished, impressive 120-180 word model answer illustrating how an elite candidate would articulate this response>"
}

Do not include markdown fences outside the JSON. Return only the JSON object.`;

        const result = await getAIReply([{ role: "user", content: prompt }], "chat");
        let cleaned = (result.reply || "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
            cleaned = cleaned.slice(start, end + 1);
        }

        let evaluation;
        try {
            evaluation = JSON.parse(cleaned);
        } catch {
            evaluation = {
                score: 78,
                verdict: "Hire",
                strengths: ["Clear technical intent", "Addressed the primary question constraint directly"],
                areasForImprovement: ["Add concrete metrics or scale figures to demonstrate impact", "Clarify individual contribution vs team effort"],
                starBreakdown: {
                    situation: "Context was stated clearly.",
                    action: "Actions demonstrated problem-solving initiative.",
                    result: "Consider quantifying final latency, user adoption, or reliability numbers."
                },
                modelAnswer: "In my recent role, we identified that our primary ingestion pipeline suffered latency spikes under peak load. I analyzed thread contention in our Redis caching layer and re-architected the buffering mechanism using Kafka with batch acknowledgments. This reduced P99 latency by 42% and supported 3x traffic with zero dropped messages."
            };
        }

        await logActivity({
            user_id: req.user!.userId,
            type: "mock_interview",
            title: `Practiced interview question: "${question.slice(0, 40)}..."`,
            meta: {
                category,
                company,
                score: evaluation.score,
            },
        });

        res.json({ success: true, evaluation });
    } catch (err: any) {
        console.error("[Interview Evaluate] Error:", err);
        res.status(500).json({ error: "Failed to evaluate interview answer" });
    }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/interview/predict-interview-questions
// ═══════════════════════════════════════════════════════════════
router.post("/predict-interview-questions", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        let { resumeText, jobDescription } = req.body;

        // Auto-fetch resume if not provided
        if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length < 20) {
            try {
                const { data: resumeRow, error } = await supabaseAdmin
                    .from("resumes")
                    .select("parsed_data")
                    .eq("user_id", req.user!.userId)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                if (!error && resumeRow?.parsed_data) {
                    const parsed = resumeRow.parsed_data as any;
                    resumeText = parsed?.rawText || JSON.stringify(parsed?.sections || {});
                }
            } catch (err) {
                console.warn("[Interview Predict] Failed to fetch resume from DB:", err);
            }

            if (!resumeText || resumeText.trim().length < 20) {
                res.status(400).json({
                    error: "resumeText is required. Paste your resume text or upload a resume first."
                });
                return;
            }
        }

        let parsed: any;
        let attempts = 0;
        const maxAttempts = 2;
        let success = false;

        // Retry logic for AI failures
        while (attempts < maxAttempts && !success) {
            attempts++;
            try {
                const result = await predictInterviewQuestions(resumeText.trim(), jobDescription?.trim());
                
                let raw = result.reply;
                raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
                const jsonStart = raw.indexOf("{");
                const jsonEnd = raw.lastIndexOf("}");
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    raw = raw.slice(jsonStart, jsonEnd + 1);
                }
                parsed = JSON.parse(raw);
                
                // Validate the structure
                if (!parsed.categories || !Array.isArray(parsed.categories)) {
                    throw new Error("Invalid structure from AI: missing 'categories' array");
                }
                success = true; // Break out of retry loop
            } catch (err: any) {
                console.warn(`[Interview Predict] Attempt ${attempts}/${maxAttempts} failed:`, err.message);
                if (attempts >= maxAttempts) {
                    console.warn("[Interview Predict] Max attempts reached, falling back to default.", err);
                    parsed = {
                        categories: [
                            {
                                title: "Technical Questions",
                                questions: [
                                    {
                                        question: "Can you describe a challenging technical problem you solved recently?",
                                        skill: "General Technical",
                                        suggestedAnswer: "Use the STAR method to describe a specific bug or architecture problem you resolved."
                                    }
                                ]
                            },
                            {
                                title: "Behavioral Questions",
                                questions: [
                                    {
                                        question: "Tell me about a time you disagreed with a team member.",
                                        skill: "Communication",
                                        suggestedAnswer: "Focus on how you resolved the conflict professionally and what you learned."
                                    }
                                ]
                            }
                        ]
                    };
                    success = true; // Proceed with fallback
                } else {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        res.json({
            categories: parsed.categories
        });
    } catch (err: any) {
        console.error("[Interview Predict] Error:", err);
        res.status(500).json({ error: err.message || "Failed to predict interview questions" });
    }
});

export default router;
