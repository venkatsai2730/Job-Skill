import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { tavily } from "@tavily/core";

const router = Router();

// All chat routes require authentication
router.use(authenticateToken);

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const BASE_SYSTEM_PROMPT = `
You are JobSkill AI – a powerful career coach assistant built into the JobSkill platform.

YOUR CAPABILITIES:
✅ Analyze resumes and give ATS scores
✅ Find REAL jobs using live web search (results are provided to you)
✅ Write LinkedIn messages and cold emails
✅ Suggest profile improvements
✅ Give interview tips
✅ Skill gap analysis and learning path recommendations
✅ Salary negotiation coaching
✅ Cover letter and resume writing

RULES:
- Be confident, helpful, and concise
- Format responses with emojis and bullet points
- Give concrete examples and numbers when possible
`;

const JOB_SEARCH_SYSTEM_ADDENDUM = `
🚨 CRITICAL JOB SEARCH RULES:
- You have been given REAL job search results from the web below
- ONLY show jobs from the search results provided — NEVER make up or fabricate job listings
- If no relevant jobs are found in the results, say "I couldn't find matching jobs right now, try a more specific query"

📋 FOR EACH JOB, DISPLAY IN THIS FORMAT:
---
**[Job Number]. [Job Title]**
🏢 Company: [Company Name]
📍 Location: [Location] | 🏠 Work Mode: [Remote/Office/Hybrid if available]
💼 Type: [Full-time/Part-time/Internship if available]
🔗 [Apply Here](actual_url_link)

📝 Key Responsibilities: [2-3 bullet points from the snippet]
✅ Requirements: [2-3 key requirements from the snippet]
---

IMPORTANT FORMATTING RULES:
- Always use markdown link format: [link text](url) — NEVER paste raw URLs
- Use **bold** for headings and job titles
- Use bullet points (- or *) for lists

AFTER LISTING ALL JOBS, ALWAYS PROVIDE:

📨 **Draft Application Message** (for the best matching job):
Write a ready-to-send LinkedIn connection message or email that the user can copy-paste. Make it professional, concise (under 100 words), and personalized to the specific role.

📝 **Resume/Profile Update Suggestions**:
Based on the job requirements found, suggest 3-5 specific changes the user should make to their resume or LinkedIn profile to increase their chances. Include:
- Keywords to add
- Skills to highlight
- Experience points to rephrase

💡 **Application Tips**: Give 2-3 specific tips for standing out when applying to these roles.
`;

const GENERAL_SYSTEM_ADDENDUM = `
- If the user asks about jobs but no search results are provided, tell them to be more specific (e.g., "Find React developer jobs in Hyderabad")
- Never fabricate job listings, companies, or salary data
- If you don't have real data, be honest and offer to help with resume/interview prep instead
`;

// Keywords that indicate a job search query
const JOB_SEARCH_KEYWORDS = [
    "find job", "job search", "jobs", "hiring", "openings", "vacancies",
    "looking for work", "find me", "search for", "positions", "career opportunities",
    "naukri", "linkedin jobs", "indeed", "remote jobs", "fresher jobs",
    "internship", "full-time", "part-time", "work from home", "job in",
    "developer jobs", "engineer jobs", "analyst jobs", "manager jobs",
    "jobs in hyderabad", "jobs in bangalore", "jobs in mumbai", "jobs in delhi",
    "react jobs", "python jobs", "java jobs", "frontend jobs", "backend jobs",
    "software jobs", "data science jobs", "devops jobs",
];

function isJobSearchQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return JOB_SEARCH_KEYWORDS.some((kw) => lower.includes(kw));
}

// POST /api/chat
router.post("/", async (req: AuthRequest, res: Response) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            res.status(400).json({ error: "Messages array is required" });
            return;
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: "Groq API key not configured" });
            return;
        }

        const lastMessage = messages[messages.length - 1]?.content || "";
        let systemContent = BASE_SYSTEM_PROMPT;
        let isJobSearch = false;

        // If the user is searching for jobs, use Tavily to search the web first
        if (isJobSearchQuery(lastMessage) && process.env.TAVILY_API_KEY) {
            isJobSearch = true;
            try {
                console.log("🔍 Searching jobs for:", lastMessage);
                const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
                const searchResults = await tvly.search(
                    `${lastMessage} latest jobs 2026 site:linkedin.com OR site:naukri.com OR site:indeed.com OR site:glassdoor.com`,
                    { maxResults: 8 }
                );

                if (searchResults.results && searchResults.results.length > 0) {
                    console.log(`✅ Found ${searchResults.results.length} results`);
                    const formattedResults = searchResults.results.map((r: any, i: number) => ({
                        index: i + 1,
                        title: r.title,
                        url: r.url,
                        snippet: r.content?.substring(0, 300),
                    }));

                    systemContent += JOB_SEARCH_SYSTEM_ADDENDUM;
                    systemContent += `\n\n📋 LIVE JOB SEARCH RESULTS:\n${JSON.stringify(formattedResults, null, 2)}`;
                } else {
                    console.log("⚠️ No search results found");
                    systemContent += GENERAL_SYSTEM_ADDENDUM;
                }
            } catch (searchError: any) {
                console.error("Tavily search error:", searchError.message);
                systemContent += GENERAL_SYSTEM_ADDENDUM;
            }
        } else {
            systemContent += GENERAL_SYSTEM_ADDENDUM;
        }

        // Build the messages array
        const groqMessages = [
            { role: "system", content: systemContent },
            ...messages.map((m: any) => ({
                role: m.role,
                content: m.content,
            })),
        ];

        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: groqMessages,
                temperature: isJobSearch ? 0.3 : 0.7,
                max_tokens: isJobSearch ? 2048 : 1024,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error("Groq API error:", response.status, errorData);
            res.status(response.status).json({
                error: errorData?.error?.message || `Groq API returned ${response.status}`,
            });
            return;
        }

        const data = await response.json() as any;
        const assistantMessage = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

        res.json({
            message: {
                role: "assistant",
                content: assistantMessage,
            },
        });
    } catch (error: any) {
        console.error("Chat error:", error);
        res.status(500).json({ error: "Failed to get response from AI" });
    }
});

export default router;
