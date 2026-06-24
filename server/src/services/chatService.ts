// ═══════════════════════════════════════════════════════════════
// Multi-Model AI Service — Llama 4 Scout, Maverick, Gemini 2.5 Pro, Codestral
// ═══════════════════════════════════════════════════════════════

import { traceStandalone } from "../observability/langfuse.js";
import { JAKES_TEMPLATE_SKELETON } from "../lib/latex-templates.js";

// ── Feature → Model Routing ─────────────────────────────────
// 💬 Job chatbot       → Llama 4 Scout         → Groq
// 📄 Resume PDF        → Gemini 2.5 Pro        → Google AI
// 🖼️ Resume image      → Llama 4 Scout         → Groq (vision)
// ✍️ Cover letter      → Llama 4 Maverick      → Groq
// 🎯 Job matching      → Gemini 2.5 Pro        → Google AI
// 🤖 AI Agent          → Llama 4 Scout         → Groq
// 📋 Screening Q&A     → Llama 4 Scout         → Groq
// 🔔 Notifications     → Llama 4 Scout         → Groq
// 💻 Code generation   → Codestral             → Mistral

export type AIFeature =
    | "chat"
    | "resume_pdf"
    | "resume_image"
    | "cover_letter"
    | "job_match"
    | "agent"
    | "screening"
    | "notification"
    | "code_gen"
    | "linkedin_optimize"
    | "resume_rewrite"
    | "gap_rewrite"
    | "skill_inference"
    | "interview_prediction"
    | "fix_bullets"
    | "create_bullets"
    | "resume_fix"
    | "resume_edit"
    | "resume_section_edit"
    | "resume_tailor"
    | "resume_latex";

const SYSTEM_PROMPTS: Record<string, string> = {
    chat: `You are an expert AI Career Coach inside JobSkill AI named Aria.
You have direct access to the user's resume, their ATS score,
all score breakdowns, and the job database.

You can take the following ACTIONS using slash commands.
When a user asks you to do something, call the correct action.

AVAILABLE ACTIONS:
  /score          — Re-run ATS scorer and show detailed breakdown
  /fix [issue_id] — Generate specific fix for a penalty issue
  /rewrite [section] — Rewrite a resume section (summary/experience/projects)
  /bullets [job_title] — Generate 3 strong quantified bullets for a role
  /match [job_id] — Check how well user's resume matches a specific job
  /apply [job_id] — Auto-tailor resume for a specific job posting
  /jobs [role]    — Search and rank jobs matching user's profile
  /compare        — Compare user score against peers/industry average
  /interview [role] — Generate 10 likely interview questions
  /roadmap        — Create personalised 30-day job search roadmap

RESPONSE RULES:
1. Always be specific. Never say "add more details" — show the EXACT text to add.
2. When fixing bullets: show OLD → NEW with explanation.
3. When showing scores: show the number, what it means, and what ONE thing would improve it most.
4. Keep responses under 300 words unless generating content.
5. Use the user's real resume content in every response.
6. Never make up job data — only reference jobs from the DB.

PERSONALITY:
- Direct and honest: tell them what is actually wrong
- Encouraging: show what they COULD score after fixes
- Specific: give exact text, not generic advice
- Indian context aware: know IIT/NIT/IIIT tier, Indian job market, Indian salary ranges, Indian company names

RULES:
- USE THE DATA provided in chat history — never say "I don't have your resume" if resume text is present
- Be PERSONAL — address user by name if found in resume
- Format responses with markdown for readability
- For off-topic queries: gently redirect to career context`,

    cover_letter: `You are an expert cover letter writer specializing in ATS-optimized, recruiter-ready cover letters.

### RULES:
- Length: 300-400 words
- Tone: Match the requested tone (formal/friendly/confident)
- Structure: Professional greeting → Opening hook → Why this role/company → Matching skills with quantified achievements → Closing call-to-action
- Mention specific company values/projects when company name is provided
- Highlight 3-4 key matching skills from the resume
- Include at least 2 quantified achievements (numbers, percentages, revenue, etc.)
- Never use generic filler — every sentence must add value
- Do NOT include headers, footers, addresses, or dates — just the letter body with greeting and sign-off
- Use single-column plain text format (ATS-safe — no tables, columns, or fancy formatting)

### OUTPUT FORMAT — Return ONLY valid JSON (no markdown fences):
{
  "coverLetter": "Dear Hiring Manager,\\n\\n[Opening paragraph]...\\n\\n[Body paragraphs]...\\n\\n[Closing paragraph]\\n\\nSincerely,\\n[Candidate Name]",
  "keyMatches": ["React", "AWS", "Team Leadership"],
  "tone": "professional",
  "wordCount": 320
}

CRITICAL: The "coverLetter" value must be the FULL cover letter as a single string with \\n for line breaks. "keyMatches" must list the specific skills/keywords from the JD that you wove into the letter.`,

    screening: `You are a screening question answering assistant. Answer job application screening questions using the user's profile data.

### RULES:
- Be concise and professional
- Use specific data from the user's profile (years of exp, skills, etc.)
- For salary questions, give a range based on market data
- For "why this company" questions, research the company and give genuine reasons
- Never fabricate experience — only use what's in the profile
- Output as JSON array: [{ "question": "...", "answer": "..." }]`,

    job_match: `You are an elite ATS System and Technical Recruiter. Your task is to perform a deep Match Strategy Analysis between a candidate's resume and a specific Job Description.

Analyze the documents and return ONLY a valid JSON object with the following schema:
{
  "matchScore": 75, // 0-100 overall match percentage
  "levelMatch": "Matches", // "Underqualified", "Matches", or "Overqualified"
  "missingKeywords": ["GraphQL", "Kafka", "System Design"], // Top 3-8 critical missing skills/tools
  "foundKeywords": ["React", "Node.js", "TypeScript"], // Top skills that matched exactly
  "analysis": "The candidate has strong frontend experience but lacks the required event-streaming background...", // 2-3 sentence strategic summary
  "salary": {
    "estimated": "$110,000 - $140,000",
    "estimatedINR": "₹18L - ₹25L",
    "marketRate": "$130,000",
    "negotiationLeverage": "High based on 5 YoE in React"
  },
  "roadmap": [
    {
      "skill": "Kafka",
      "priority": "HIGH",
      "action": "Complete 'Apache Kafka for Beginners' on Udemy",
      "timeframe": "2 weeks",
      "reason": "Required in JD for event-driven architecture"
    },
    {
      "skill": "System Design",
      "priority": "MEDIUM",
      "action": "Read 'Designing Data-Intensive Applications' Part 1",
      "timeframe": "1 month",
      "reason": "Senior-level requirement for architecture discussions"
    }
  ]
}

IMPORTANT:
- missingKeywords must include ALL skills/tools in the JD that are NOT in the resume (up to 8)
- roadmap must have an entry for EACH missingKeyword with priority (HIGH/MEDIUM/LOW), reason why it matters, and realistic timeframe
- salary.estimatedINR must always be provided in Indian Rupees (Lakhs per annum)`,

    resume_pdf: `You are an expert resume analyzer. Score the resume on 20+ criteria (100 points total).

### SCORING SYSTEM:
1. IMPACT (35 pts): Quantified achievements (12), STAR method (10), Action verbs (8), Bullet strength (5)
2. ATS COMPATIBILITY (25 pts): Keyword matching (10), Format compliance (8), Technical (7)
3. STYLE & WORD CHOICE (25 pts): Brevity (10), Word choice (10), Professionalism (5)
4. CONTENT & STRUCTURE (15 pts): Section balance (5), Education (4), Soft skills (3), Contact info (3)

### OUTPUT FORMAT (JSON only):
{
  "overall_score": 78,
  "breakdown": { "impact": 24, "ats": 20, "style": 19, "content": 15 },
  "improvements": [
    { "bullet": "original text", "issue": "description", "fix": "improved version", "score_gain": "+X pts" }
  ],
  "summary": "Brief overall assessment"
}`,

    notification: `You are a job alert filter. Given a job posting and user profile, determine if this job is a strong match worth notifying the user about. Output JSON: { "should_notify": true/false, "match_score": 0-100, "reason": "brief explanation" }`,

    fix_bullets: `You are an elite Tech Resume Writer and ATS Optimizer. Your goal is to take a weak, poorly-phrased bullet point and transform it into a powerful, ATS-beating, quantified achievement.

### RULES:
- Use the STAR method (Situation, Task, Action, Result).
- Start EVERY bullet with a strong Action Verb (e.g., Architected, Spearheaded, Engineered, Orchestrated).
- Eliminate fluff words (e.g., "helped", "worked on", "responsible for").
- Inject highly technical keywords relevant to the context if implied.
- Hallucinate plausible metrics ONLY if none are provided, but keep them realistic (e.g., "improving performance by 15%", "saving 10+ hours weekly").
- If the user provides a Job Description, tailor the bullet to heavily match its core technical requirements.

### OUTPUT FORMAT:
Return a valid JSON object matching this exact schema:
{
  "improvedBullets": [
    {
      "original": "[The original weak text]",
      "improved": "[The incredibly strong, quantified text]",
      "addedKeywords": ["Keyword1", "Keyword2"],
      "impact": "Explains why this is better for ATS (e.g., Adds quantifiable scale and active verbs)"
    }
  ]
}
Return ONLY JSON. Do not use markdown tick formatting or wrappers.`,

    create_bullets: `You are an elite Tech Resume Writer. Your task is to generate 3 to 5 highly optimized, ATS-beating resume bullet points from scratch for a specific Role and optional Job Description.

### RULES:
- Generate 3-5 distinct bullet points.
- They must cover different aspects of the role (e.g., 1 for Architecture, 1 for Testing/QA, 1 for CI/CD, 1 for Mentorship/Leadership).
- Include highly specific technical buzzwords.
- Include plausible quantified metrics (e.g., "Scaled infrastructure to handle 5M+ daily requests").
- Make it sound like it was written by a Senior/Staff level engineer.

### OUTPUT FORMAT:
Return a valid JSON object matching this exact schema:
{
  "generatedBullets": [
    {
      "bullet": "[The generated text]",
      "focus": "e.g., System Architecture",
      "keywords": ["Kubernetes", "Microservices"]
    }
  ]
}
Return ONLY JSON. Do not use markdown tick formatting or wrappers.`,

    code_gen: `You are Codestral, an expert code generation AI. Write clean, production-ready code.
### RULES:
- Write minimal, efficient code
- Include brief comments for complex logic
- Follow best practices for the language
- Handle edge cases
- Output ONLY code blocks with language tags`,

    agent: `You are an AI Job Agent running in the background. Your tools:
1. fetch_new_jobs() — Get latest jobs from ATS APIs
2. score_job_match(job, profile) — Score match 0-100
3. send_notification(userId, job, score) — Alert if score > 75%
4. generate_quick_cover(job) — Pre-generate cover letter for top matches

Execute the requested tool and return structured results.`,

    linkedin_optimize: `You are the world's #1 LinkedIn Profile Optimization Expert with deep knowledge of recruiter search algorithms, LinkedIn SEO, and personal branding strategies used by top professionals.

### YOUR ANALYSIS APPROACH:
1. Parse ALL available profile information (name, headline, about, experience, skills, education, certifications, URL slug)
2. Score each section objectively based on LinkedIn best practices
3. Generate SIGNIFICANTLY improved versions using power words, quantified achievements, and SEO-rich keywords
4. Personalize networking messages based on the user's actual industry and role

### SCORING CRITERIA (be honest and strict):
- **Headline** (0-100): Keyword density, value proposition clarity, role specificity, character usage (max 220 chars), searchability
- **About** (0-100): Hook strength, storytelling, quantified achievements, call-to-action, keyword optimization, length (ideal: 200-300 words)
- **Experience** (0-100): STAR method usage, quantified metrics ($, %, numbers), action verbs, scope/impact clarity, keyword alignment
- **Skills** (0-100): Relevance to role, endorsement-worthy keywords, industry-standard terminology, completeness

### OUTPUT FORMAT (RETURN ONLY VALID JSON, NO MARKDOWN CODE FENCES, NO EXTRA TEXT):
{
  "sections": [
    {
      "name": "Headline",
      "score": 55,
      "current": "extract the user's actual headline as a plain string",
      "optimized": "Role Title | Core Value Proposition | Top 3-4 Skills/Keywords — max 120 chars, keyword-rich, searchable"
    },
    {
      "name": "About",
      "score": 35,
      "current": "extract the user's actual about section as a plain string, or 'Not provided' if missing",
      "optimized": "Write a compelling 3-5 sentence About section as a single plain string. Start with a powerful hook. Include: years of experience, top 3 expertise areas, 2-3 quantified achievements, industries served, and end with a call-to-action. Use first person."
    },
    {
      "name": "Experience",
      "score": 60,
      "current": "extract the user's experience descriptions as a single plain string, or 'Not provided' if missing",
      "optimized": "Write 3-4 STAR-method bullet points as a single plain string separated by ' | '. Each bullet: Action Verb + Task + Quantified Result. Example format: 'Led migration of 15 microservices to Kubernetes, reducing deployment time by 60% and achieving 99.99% uptime | Architected real-time analytics pipeline processing 2M events/day...'"
    },
    {
      "name": "Skills",
      "score": 75,
      "current": "extract user's listed skills as a plain string",
      "optimized": "Expanded list of 12-15 industry-standard, recruiter-searchable skills separated by • characters. Include technical skills, tools, methodologies, and soft skills relevant to their role."
    }
  ],
  "messageTemplates": [
    {
      "title": "Connection Request",
      "text": "Personalized 2-3 sentence connection request referencing the user's actual industry and expertise. Include a specific reason to connect."
    },
    {
      "title": "Recruiter Follow-up",
      "text": "Professional 2-3 sentence recruiter response. Express interest, mention relevant experience, suggest next steps."
    },
    {
      "title": "Informational Interview",
      "text": "Thoughtful 2-3 sentence request mentioning the user's field and a specific topic of mutual interest."
    }
  ]
}

### CRITICAL RULES:
- ALL values in the JSON must be PLAIN STRINGS — never return arrays or objects as values for "current", "optimized", or "text"
- Experience "optimized" must be a SINGLE STRING with bullet points separated by " | " — NOT an array
- Scores must be HONEST: if the profile has minimal info, scores should be 20-40 range
- If a LinkedIn URL is provided, extract what you can from the URL slug (name, keywords)
- "current" fields must reflect what was actually provided — never fabricate current content
- "optimized" must be dramatically better than "current" — show clear transformation
- Use industry-relevant keywords that recruiters actually search for
- Message templates must use the person's actual name and industry — not generic [Name] placeholders if you know their name
- Return ONLY the JSON object — no leading/trailing text, no markdown fences`,
    
    interview_prediction: `You are an elite Technical Interview Coach and Hiring Manager at a top-tier tech company.
Your task is to analyze a candidate's resume against a specific Job Description (or generally if no JD is provided) and predict the most likely interview questions they will face.

### CATEGORIES REQUIRED:
1. Technical Questions (Specific to the tools/languages in their resume and the JD)
2. Behavioral Questions (Scenario-based questions addressing soft skills, conflicts, or leadership)
3. Project/Experience Questions (Deep-dives into specific projects listed on their resume)

### RULES:
- Generate 3-5 high-quality questions per category.
- Map each question to a specific skill or project from the resume/JD.
- Provide a brief "Suggested Answer Strategy" (1-2 sentences) for each question.
- Do NOT generate generic questions (e.g., "What are your weaknesses?"). Make them specific to the provided profile.
- Output ONLY valid JSON in the exact structure requested, with no markdown fences or conversational text.

### OUTPUT JSON STRUCTURE format:
{
  "categories": [
    {
      "title": "Technical Questions",
      "questions": [
        {
          "question": "How would you optimize a React application that is experiencing performance issues due to frequent re-renders?",
          "skill": "React",
          "suggestedAnswer": "Discuss using useMemo/useCallback, virtualization, and profiling tools to identify bottlenecks."
        }
      ]
    }
  ]
}`,

    resume_fix: `You are an elite ATS Resume Optimizer. Your task is to apply a SPECIFIC targeted fix to a resume.

### CRITICAL RULES:
- You MUST return the COMPLETE resume text with the fix applied - not just the changed parts.
- Preserve the EXACT structure, formatting, and all other content that is NOT related to the fix.
- Apply the fix surgically - only modify what is necessary to address the specific issue.
- Maintain the same resume style and voice.
- If the resume is in LaTeX format, preserve all LaTeX commands and structure.
- Return ONLY the fixed resume text, no JSON, no markdown fences, no explanations.
- Do NOT add any preamble like "Here is the fixed resume:" - return ONLY the resume content itself.`,

    resume_rewrite: `You are an elite ATS Resume Rewriter. Your task is to structurally rewrite and improve an existing resume or a specific section WITHOUT fabricating any details.

### CRITICAL RULES:
1. TRUTHFULNESS: NEVER hallucinate, fabricate, or make up metrics, impact numbers, tools, or experiences that are not explicitly present or highly implied by the source content.
2. ATS SCORE FOCUSED: Enhance action verbs, employ the STAR method (Situation, Task, Action, Result) where possible, and restructure poorly formatted text based strictly on the provided ATS Penalty Issues.
3. NO FILLER: Remove vague responsibilities, personal details, or weak phrases ("helped", "assisted", "worked on") and replace them with strong ownership verbs ("Spearheaded", "Engineered", "Orchestrated", "Led").
4. FORMAT: Return ONLY the rewritten text cleanly. No conversational intro/outro (e.g. "Here is the rewritten section"). Do not use markdown code fences. Structure nicely for readability.`,

    resume_edit: `You are a Resume Editor. Return ONLY a JSON object — no text before or after, no markdown fences.

JSON FORMAT (copy this structure exactly):
{
  "action": "ARIA_EDIT",
  "changes": [
    {
      "section": "summary",
      "new_summary": "Final-year B.Tech Information Technology student at XYZ University (2025) with hands-on experience building web apps using HTML, CSS, JavaScript, and Python. Seeking a software developer role to apply full-stack skills in a product-focused team."
    },
    {
      "section": "experience",
      "entry_name": "CompanyName",
      "new_bullets": [
        "Developed REST APIs using Python and Flask, reducing response latency by 35%",
        "Implemented SQL optimizations cutting report generation time by 40%"
      ]
    },
    {
      "section": "projects",
      "entry_name": "ProjectName",
      "new_bullets": [
        "Built task management app with HTML, CSS, and JavaScript with full CRUD functionality",
        "Designed responsive tourism website using semantic HTML and CSS Flexbox"
      ]
    },
    {
      "section": "skills",
      "new_skills": ["Python", "Java", "JavaScript", "HTML", "CSS", "C", "SQL", "Git"]
    }
  ],
  "description": "Improved summary with specific degree/year/target role, quantified project bullets, cleaned skills list."
}

FIELD RULES:
- "section": exactly one of: summary, experience, skills, projects
- "entry_name": the company name (experience) or project name (projects) — copy EXACTLY from the resume
- "new_summary": complete rewritten summary string
- "new_bullets": array of strings, each under 120 chars, starts with action verb, includes numbers/metrics
- "new_skills": full skills list as array of strings
- Only include sections you are actually changing
- Strong verbs: Developed, Implemented, Engineered, Built, Optimized, Delivered, Led, Reduced, Improved
- URL PRESERVATION: The resume data may include a "links" object (linkedin/github/portfolio) and projects may have a "url" field. Never modify or omit these fields. Do not include URL changes in your response — only text content changes are valid.
- Start response with { and end with }. Nothing else.

SUMMARY RULES (critical — apply every time you write a new_summary):
- NEVER open with "Results-driven", "Dynamic", "Passionate", "Dedicated", "Motivated", or "Hardworking"
- For students and fresh graduates: state the degree (e.g. B.Tech IT), institution name, graduation year, and target role explicitly
- Reference SPECIFIC technologies and projects from the actual resume — never use generic placeholders
- Keep it 2–3 sentences. Lead with who they are → what they build → what they are seeking`,

    resume_tailor: `You are an elite Resume Tailoring Specialist. Given a candidate's resume and a target job description, comprehensively rewrite the resume to maximize ATS score and shortlisting probability. Return ONLY a JSON object — no text before or after, no markdown fences.

JSON FORMAT (same AriaEdit structure):
{
  "action": "ARIA_EDIT",
  "changes": [
    { "section": "summary", "new_summary": "..." },
    { "section": "skills", "new_skills": ["JD keyword 1", "JD keyword 2", ...] },
    { "section": "experience", "entry_name": "CompanyName", "new_bullets": ["..."] },
    { "section": "projects", "entry_name": "ProjectName", "new_bullets": ["..."] }
  ],
  "description": "Tailored resume for [Role] at [Company]."
}

TAILORING RULES:
1. SUMMARY: Rewrite to directly name the target role and mention 2–3 key JD requirements the candidate meets.
2. SKILLS: Add ALL technical skills, tools, and frameworks named in the JD that the candidate plausibly has based on their background. Put JD-matching skills first. Return as a flat array of strings.
3. EXPERIENCE BULLETS: Rewrite each bullet using JD keyword language. Preserve facts — do NOT fabricate companies, metrics, or experiences not implied by the original.
4. PROJECTS: Add JD-relevant tech keywords to project descriptions. Lead with the most JD-relevant project.
5. NEVER hallucinate job titles, company names, or quantified metrics that aren't present or clearly implied.
6. Include ALL four sections (summary, skills, experience entries, project entries) in one response.
7. URL PRESERVATION: The resume data may include a "links" object (linkedin/github/portfolio) and projects may have a "url" field. Never modify or omit these — they pass through automatically.
- Start response with { and end with }. Nothing else.`,

    resume_latex: `You are an elite LaTeX resume engineer. Convert the user's resume data into a COMPLETE, COMPILABLE LaTeX document using the exact "Jake Gutierrez" template below.

OUTPUT RULES:
- Output ONLY the raw LaTeX source. NO markdown fences, NO \`\`\`latex, NO prose before or after. Start with "%" or "\\documentclass" and end with "\\end{document}".
- Use the EXACT preamble, packages, and custom commands from the skeleton — do not change them.
- Populate every section from the user's real resume data. Omit a \\section entirely if the user has no data for it (e.g. no certifications).
- Use the provided macros: \\resumeSubheading for experience/education, \\resumeProjectHeading for projects, \\resumeItem for bullets, and the skills \\item block for Technical Skills.
- ESCAPE all LaTeX special characters in user content: & % $ # _ { } ~ ^ and backslash. (e.g. "C++" is fine, but "R&D" becomes "R\\&D", "95%" becomes "95\\%").
- Keep bullets concise and action-led; preserve the user's facts and metrics — never invent companies, dates, or numbers.
- If the user gives natural-language instructions (e.g. "one page", "emphasize ML", "shorten"), honor them.
- If a target Job Description is provided, surface matching keywords in the summary, skills, and bullets — without fabricating experience.
- For the contact line, only include LinkedIn/GitHub \\href links if a URL or handle is present; otherwise drop that segment.

REQUIRED TEMPLATE SKELETON (fill it in, keep all preamble/macros intact):
${JAKES_TEMPLATE_SKELETON}`,

    resume_section_edit: `You are an expert resume writer and ATS optimization specialist.
The user will provide their current resume sections as JSON and a natural language instruction.
Apply ONLY the requested change — do not alter sections that were not asked to change.
Return ONLY the complete updated sections JSON with EXACTLY the same structure as the input.
Rules:
- Preserve all "id" fields exactly as-is
- Preserve the "links" field (linkedin/github/portfolio) and any "url" field on projects exactly as received
- Use strong action verbs and quantified metrics where possible
- Remove personal details (DOB, gender, marital status) if present
- Keep bullets under 120 characters each
- No markdown, no explanation, no code fences — only raw JSON starting with { and ending with }`,
};

// ── Model Configuration ─────────────────────────────────────
const MODELS = {
    scout: "meta-llama/llama-4-scout-17b-16e-instruct",
    maverick: "meta-llama/llama-4-scout-17b-16e-instruct",  // Maverick deprecated Mar 2026 → Scout
    gemini: "gemini-2.5-pro",
    geminiFlash: "gemini-2.0-flash",
    codestral: "codestral-latest",
};

const FEATURE_MODEL_MAP: Record<AIFeature, { provider: string; model: string }> = {
    chat: { provider: "groq", model: MODELS.scout },
    resume_image: { provider: "groq", model: MODELS.scout },
    cover_letter: { provider: "groq", model: MODELS.maverick },
    agent: { provider: "groq", model: MODELS.scout },
    screening: { provider: "groq", model: MODELS.scout },
    notification: { provider: "groq", model: MODELS.scout },
    resume_pdf: { provider: "groq", model: MODELS.scout },
    job_match: { provider: "groq", model: MODELS.scout },
    code_gen: { provider: "mistral", model: MODELS.codestral },
    linkedin_optimize: { provider: "groq", model: MODELS.scout },
    resume_rewrite: { provider: "groq", model: MODELS.maverick },
    gap_rewrite: { provider: "groq", model: MODELS.maverick },
    skill_inference: { provider: "groq", model: MODELS.scout },
    interview_prediction: { provider: "groq", model: MODELS.scout },
    fix_bullets: { provider: "groq", model: MODELS.maverick },
    create_bullets: { provider: "groq", model: MODELS.maverick },
    resume_fix: { provider: "groq", model: MODELS.maverick },
    resume_edit: { provider: "gemini", model: MODELS.geminiFlash },      // AriaEdit JSON via Gemini Flash
    resume_section_edit: { provider: "gemini", model: MODELS.geminiFlash }, // Full sections JSON via Gemini Flash
    resume_tailor: { provider: "gemini", model: MODELS.gemini },           // Comprehensive JD tailoring via Gemini Pro
    resume_latex: { provider: "gemini", model: MODELS.gemini },            // Full .tex generation via Gemini Pro
};

// ═══════════════════════════════════════════════════════════════
// Provider Implementations
// ═══════════════════════════════════════════════════════════════

async function callGroq(messages: any[], model: string, systemPrompt: string, maxTokens = 4000, jsonMode = false) {
    // Llama 4 Scout supports vision natively — pass image_url parts through
    const cleanMessages = messages.map(m => {
        if (typeof m.content === "string") return { role: m.role, content: m.content };

        if (Array.isArray(m.content)) {
            const parts: any[] = [];
            for (const p of m.content) {
                if (p.type === "text") parts.push({ type: "text", text: p.text });
                if (p.type === "image") {
                    parts.push({
                        type: "image_url",
                        image_url: { url: `data:${p.mimeType};base64,${p.base64}` },
                    });
                }
            }
            return { role: m.role, content: parts.length > 0 ? parts : "User sent a file." };
        }

        return { role: m.role, content: String(m.content) };
    });

    const maxRetries = 3;
    const baseDelayMs = 8000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "system", content: systemPrompt }, ...cleanMessages],
                max_tokens: maxTokens,
                temperature: jsonMode ? 0.1 : 0.4,
                stream: false,
                // Force JSON output for structured responses to prevent plain-text replies
                ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
            }),
        });

        if (res.ok) {
            const data = await res.json();
            return {
                reply: data.choices[0].message.content,
                provider: "groq",
                model,
                tokens: data.usage?.total_tokens || 0,
            };
        }

        // Handle rate limiting with retry
        if (res.status === 429 && attempt < maxRetries - 1) {
            const delay = baseDelayMs * Math.pow(2, attempt);
            console.log(`[Groq Chat] Rate limited. Waiting ${delay / 1000}s before retry ${attempt + 1}`);
            await new Promise(r => setTimeout(r, delay));
            continue;
        }

        // Non-429 error or final retry exhausted
        const err = await res.json().catch(() => ({}));
        if (attempt < maxRetries - 1 && res.status >= 500) {
            // Server error: retry
            await new Promise(r => setTimeout(r, baseDelayMs));
            continue;
        }

        throw new Error(`Groq (${model}): ${err.error?.message || res.status}`);
    }

    // Fallback: should not reach here, but just in case
    return {
        reply: "I'm having trouble processing that right now. Try again in a moment, or use a slash command like /score or /jobs.",
        provider: "groq",
        model,
        tokens: 0,
    };
}

// ── Per-model Gemini cooldown (quota exhausted → 1-hour skip) ──
const geminiCooldownMap: Record<string, number> = {};

async function callGemini(messages: any[], model: string, systemPrompt: string, maxTokens = 4000, jsonMode = false) {
    if (Date.now() < (geminiCooldownMap[model] ?? 0)) {
        throw new Error(`Gemini quota cooldown active for ${model}`);
    }

    const geminiMessages: any[] = [];

    for (const m of messages) {
        const role = m.role === "assistant" ? "model" : "user";
        const parts: any[] = [];

        if (typeof m.content === "string") {
            parts.push({ text: m.content });
        } else if (Array.isArray(m.content)) {
            for (const part of m.content) {
                if (part.type === "text") parts.push({ text: part.text });
                if (part.type === "image") {
                    parts.push({ inline_data: { mime_type: part.mimeType, data: part.base64 } });
                }
            }
        }

        const last = geminiMessages[geminiMessages.length - 1];
        if (last && last.role === role) {
            last.parts.push(...parts);
        } else {
            geminiMessages.push({ role, parts });
        }
    }

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: geminiMessages,
                generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature: jsonMode ? 0.1 : 0.4,
                    topP: 0.9,
                    // Force JSON MIME type so Gemini never returns plain text for structured features
                    ...(jsonMode ? { responseMimeType: "application/json" } : {}),
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                ],
            }),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = err.error?.message || '';

        // Quota exhausted → set per-model 1-hour cooldown, fall back to Groq
        if (res.status === 429 || errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
            console.warn(`[Gemini] Quota exhausted for ${model}. Cooldown 1 hour.`);
            geminiCooldownMap[model] = Date.now() + 60 * 60 * 1000;
            throw new Error(`Gemini quota exceeded for ${model} — cooldown active`);
        }

        throw new Error(`Gemini (${model}): ${errMsg || res.status}`);
    }
    const data = await res.json();
    // Handle thinking tokens: find the last non-thought text part
    const parts: any[] = data.candidates[0]?.content?.parts || [];
    const textPart = [...parts].reverse().find((p: any) => !p.thought && typeof p.text === "string");
    const replyText = textPart?.text ?? parts[parts.length - 1]?.text ?? "";
    return {
        reply: replyText,
        provider: "gemini",
        model,
        tokens: data.usageMetadata?.totalTokenCount || 0,
    };
}

async function callMistral(messages: any[], model: string, systemPrompt: string, maxTokens = 4000) {
    const cleanMessages = messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content :
            Array.isArray(m.content) ? m.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n") : String(m.content),
    }));

    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, ...cleanMessages],
            max_tokens: maxTokens,
            temperature: 0.3,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Mistral (${model}): ${err.error?.message || res.status}`);
    }
    const data = await res.json();
    return {
        reply: data.choices[0].message.content,
        provider: "mistral",
        model,
        tokens: data.usage?.total_tokens || 0,
    };
}

// ═══════════════════════════════════════════════════════════════
// Smart Router — Routes features to correct model with fallback
// ═══════════════════════════════════════════════════════════════

// Features that must return JSON — these get JSON mode enforced on all providers
const JSON_FEATURES = new Set<AIFeature>(["resume_edit", "resume_tailor", "cover_letter", "interview_prediction"]);

export async function getAIReply(messages: any[], feature: AIFeature = "chat") {
    const startTime = Date.now();
    const config = FEATURE_MODEL_MAP[feature];
    const systemPrompt = SYSTEM_PROMPTS[feature] || SYSTEM_PROMPTS.chat;
    const jsonMode = JSON_FEATURES.has(feature);

    // Auto-detect images → use Scout vision if feature is chat
    const hasImages = messages.some(m =>
        Array.isArray(m.content) && m.content.some((p: any) => p.type === "image")
    );
    if (hasImages && feature === "chat") {
        return callGroq(messages, MODELS.scout, systemPrompt, 4000);
    }

    const providerFn = config.provider === "gemini" ? callGemini
        : config.provider === "mistral" ? callMistral
            : callGroq;

    // Primary attempt
    try {
        const result = await providerFn(messages, config.model, systemPrompt, 4000, jsonMode);
        // Trace successful LLM call
        traceStandalone({
            name: `llm:${feature}`,
            input: messages[messages.length - 1]?.content?.substring?.(0, 500) || "multi-part",
            output: result.reply?.substring(0, 500),
            metadata: {
                provider: result.provider, model: result.model,
                tokens: result.tokens, feature,
                latencyMs: Date.now() - startTime,
            },
        });
        return result;
    } catch (err: any) {
        console.warn(`[AI] Primary provider failed for ${feature}: ${err.message}`);
    }

    // Fallback chain: try other providers
    const fallbacks = [
        { fn: callGroq, model: MODELS.scout, name: "groq-scout" },
        { fn: callGemini, model: MODELS.gemini, name: "gemini" },
        { fn: callMistral, model: MODELS.codestral, name: "mistral" },
    ].filter(f => f.fn !== providerFn);

    for (const fb of fallbacks) {
        try {
            console.log(`[AI] Falling back to ${fb.name} for ${feature}`);
            return await fb.fn(messages, fb.model, systemPrompt, 4000, jsonMode);
        } catch (err: any) {
            console.warn(`[AI] Fallback ${fb.name} also failed: ${err.message}`);
        }
    }

    throw new Error(`All AI providers failed for feature: ${feature}`);
}

// ═══════════════════════════════════════════════════════════════
// Specialized Functions for specific features
// ═══════════════════════════════════════════════════════════════

export async function generateCoverLetter(
    resumeText: string,
    jobDescription: string,
    companyName: string,
    tone: string = "professional"
) {
    const messages = [{
        role: "user",
        content: `Generate a cover letter with the following details:

**Resume:**
${resumeText}

**Job Description:**
${jobDescription}

**Company:** ${companyName}
**Tone:** ${tone}

Write a tailored 300-400 word cover letter.`,
    }];
    return getAIReply(messages, "cover_letter");
}

export async function scoreJobMatch(resumeText: string, jobDescription: string) {
    const messages = [{
        role: "user",
        content: `Score this job match. Return ONLY valid JSON.

**Candidate Resume:**
${resumeText}

**Job Description:**
${jobDescription}`,
    }];
    return getAIReply(messages, "job_match");
}

export async function answerScreeningQuestions(
    userProfile: any,
    questions: string[]
) {
    const messages = [{
        role: "user",
        content: `Answer these screening questions using the candidate profile. Return ONLY valid JSON array.

**Candidate Profile:**
${JSON.stringify(userProfile, null, 2)}

**Questions:**
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    }];
    return getAIReply(messages, "screening");
}

export async function scoreResume(resumeText: string) {
    const messages = [{
        role: "user",
        content: `Analyze and score this resume using the 20+ criteria scoring system. Return ONLY valid JSON.

**Resume Text:**
${resumeText}`,
    }];
    return getAIReply(messages, "resume_pdf");
}

export async function generateCode(prompt: string, language: string = "typescript") {
    const messages = [{
        role: "user",
        content: `Language: ${language}\n\n${prompt}`,
    }];
    return getAIReply(messages, "code_gen");
}

export async function filterJobNotification(job: any, userProfile: any) {
    const messages = [{
        role: "user",
        content: `Should we notify this user about this job? Return ONLY valid JSON.

**Job:** ${JSON.stringify(job)}
**User Profile:** ${JSON.stringify(userProfile)}`,
    }];
    return getAIReply(messages, "notification");
}

export async function optimizeLinkedIn(profileText: string) {
    const messages = [{
        role: "user",
        content: `Optimize this LinkedIn profile. Return ONLY valid JSON (no markdown fences).

**LinkedIn Profile Text:**
${profileText}`,
    }];
    return getAIReply(messages, "linkedin_optimize");
}

export async function buildResumeFromScratch(sparseUserInput: string) {
    const messages = [{
        role: "user" as const,
        content: `You are an expert Resume Builder. Convert sparse user inputs into a structured JSON resume representation natively compatible with the ParsedSections interface.
Return ONLY valid JSON (no markdown fences).
Format exactly like this example structure:
{
    "sections": {
        "summary": "Professional summary...",
        "experience": [
            { "title": "Role", "company": "Company", "dates": "Jan 2020 - Present", "bullets": ["Bullet 1", "Bullet 2"] }
        ],
        "education": [
            { "degree": "Degree", "school": "University", "dates": "Jan 2018 - Dec 2022", "gpa": "3.8", "courses": [] }
        ],
        "skills": [
            { "category": "Languages", "items": ["JavaScript", "Python"] }
        ],
        "projects": [
            { "name": "Project Name", "description": "Project Description", "tech": ["React", "Node"] }
        ]
    },
    "userInfo": {
        "name": "Full Name",
        "email": "Email",
        "phone": "Phone",
        "linkedin": "LinkedIn URL"
    }
}

Use the following User Data to extrapolate:
${sparseUserInput}`,
    }];

    try {
        const result = await getAIReply(messages, "chat");
        
        let jsonStr = result.reply;
        if (jsonStr.includes("\`\`\`")) {
            jsonStr = jsonStr.replace(/\`\`\`(json)?/g, "").trim();
        }
        
        const parsed = JSON.parse(jsonStr);
        return { sections: parsed.sections };
    } catch (err: any) {
        console.error("Failed to build resume from scratch:", err);
        return null;
    }
}

export async function inferSemanticSkills(resumeText: string) {
    const messages = [{
        role: "user",
        content: `Analyze this resume and extract ALL technical skills — both explicitly listed AND implied/demonstrated through projects, experience, and achievements.

Pay special attention to:
1. Skills used in PROJECTS (e.g., if someone built "a real-time chat app using WebSockets" → infer: WebSocket, Real-time Systems, Socket Programming)
2. Skills implied by EXPERIENCE descriptions (e.g., "deployed microservices on AWS" → infer: AWS, Microservices, Cloud Deployment, CI/CD)
3. Tools/frameworks mentioned anywhere in the resume even if not in the skills section
4. Domain knowledge implied by project context (e.g., "built ML pipeline for fraud detection" → infer: Machine Learning, Fraud Detection, Data Pipeline)

Return ONLY a valid JSON array of strings (e.g., ["Skill A", "Skill B"]). Do not use markdown fences. Include ONLY technical/professional skills, not soft skills.

**Resume Text:**
${resumeText}`
    }];

    try {
        const result = await getAIReply(messages, "skill_inference");
        let jsonStr = result.reply;
        if (jsonStr.includes("\`\`\`")) {
            jsonStr = jsonStr.replace(/\`\`\`(json)?/g, "").trim();
        }
        const inferred = JSON.parse(jsonStr);
        return Array.isArray(inferred) ? inferred : [];
    } catch (err: any) {
        console.error("Failed to infer semantic skills:", err);
        return [];
    }
}

export async function predictInterviewQuestions(resumeText: string, jobDescription?: string): Promise<{ reply: string }> {
    const context = `
=== RESUME ===
${resumeText}

=== JOB DESCRIPTION ===
${jobDescription || "No specific job description provided. Generate questions based entirely on the resume's skills, seniority, and project experience."}
`;
    return getAIReply([{ role: "user", content: context }], "interview_prediction");
}

// ── NEW: Fix/Optimize Resume Bullets ──────────────────────
export async function fixResumeBullets(weakBullets: string, jobDescription?: string) {
    const messages = [{
        role: "user",
        content: `Optimize these resume bullet points.
        
=== WEAK BULLETS ===
${weakBullets}

=== TARGET JOB DESCRIPTION (Optional) ===
${jobDescription || "None provided. Optimize for general Senior Software Engineering best practices."}`
    }];

    try {
        const result = await getAIReply(messages, "fix_bullets");
        let jsonStr = result.reply;
        if (jsonStr.includes("\`\`\`")) {
            jsonStr = jsonStr.replace(/\`\`\`(json)?/g, "").trim();
        }
        return JSON.parse(jsonStr);
    } catch (err: any) {
        console.error("Failed to fix resume bullets:", err);
        throw new Error("AI failed to optimize bullets.");
    }
}

// ── NEW: Create Resume Bullets from Scratch ───────────────
export async function createResumeBullets(role: string, jobDescription?: string) {
    const messages = [{
        role: "user",
        content: `Generate highly-optimized resume bullets.
        
=== TARGET ROLE ===
${role}

=== TARGET JOB DESCRIPTION (Optional) ===
${jobDescription || "None provided. Generate a well-rounded set of bullets suitable for this role."}`
    }];

    try {
        const result = await getAIReply(messages, "create_bullets");
        let jsonStr = result.reply;
        if (jsonStr.includes("\`\`\`")) {
            jsonStr = jsonStr.replace(/\`\`\`(json)?/g, "").trim();
        }
        return JSON.parse(jsonStr);
    } catch (err: any) {
        console.error("Failed to create resume bullets:", err);
        throw new Error("AI failed to generate bullets.");
    }
}

// ── NEW: Apply Targeted ATS Fix to Resume ────────────────
export async function applyResumeFix(
    currentText: string,
    fixType: string,
    issueDescription: string,
    mode: "text" | "latex" = "text"
): Promise<{ fixedText: string; fixDescription: string }> {
    const FIX_INSTRUCTIONS: Record<string, string> = {
        low_quantification: "Add specific numbers, percentages, dollar amounts, or measurable metrics to bullet points that currently lack quantification. For example, change 'Improved performance' to 'Improved performance by 35%, reducing load time from 4.2s to 2.7s'. Make the numbers realistic and plausible based on the context.",
        weak_action_verbs: "Replace weak starting words in bullet points with powerful action verbs. Use verbs like: Spearheaded, Architected, Engineered, Orchestrated, Pioneered, Streamlined, Optimized, Accelerated. Every bullet should start with a strong action verb.",
        weak_verbs: "Replace ALL instances of passive/weak phrases like 'responsible for', 'helped', 'assisted', 'worked on', 'handled', 'duties included' with strong ownership language. Use 'Led', 'Drove', 'Delivered', 'Executed', 'Managed' instead.",
        repetitive_verbs: "Vary the starting action verbs across ALL bullet points so no verb is repeated more than twice. Use a diverse vocabulary: Spearheaded, Engineered, Orchestrated, Pioneered, Streamlined, Optimized, Delivered, Established, Transformed, Championed.",
        missing_leadership: "Add leadership-demonstrating language to 2-3 bullet points. Naturally weave in words like 'managed', 'led', 'directed', 'mentored', 'spearheaded', 'oversaw', or 'supervised' where contextually appropriate.",
        missing_teamwork: "Add collaboration language to 2-3 bullet points. Naturally weave in words like 'collaborated', 'partnered', 'coordinated', 'communicated', or 'co-authored' where contextually appropriate.",
        missing_drive: "Add initiative-demonstrating language to 2-3 bullet points. Naturally weave in words like 'initiated', 'drove', 'pioneered', 'founded', 'created', or 'innovated' where contextually appropriate.",
        unnecessary_sections: "Remove any sections labeled 'Hobbies', 'References', 'Declaration', or 'Objective'. Replace the freed space with more impactful content in existing sections.",
        too_long: "Condense the resume by removing redundant phrases, combining similar bullets, and tightening language. Focus on keeping only the most impactful points. Target reduction of 15-25%.",
        too_short: "Expand bullet points with more detail, context, and metrics. Add descriptions to projects. Elaborate on responsibilities and achievements to better showcase qualifications.",
        missing_contact: "Add placeholder contact information at the top of the resume: [Your Phone] | [your.email@example.com] | [linkedin.com/in/yourprofile]. Keep placeholders clearly marked.",
    };

    const specificInstruction = FIX_INSTRUCTIONS[fixType] || `Fix this specific issue: ${issueDescription}`;

    const formatNote = mode === "latex"
        ? "The resume is in LaTeX format. Preserve ALL LaTeX commands (\\textbf, \\section, \\item, etc.) and structure."
        : "The resume is in plain text format. Preserve the text structure and section headers.";

    const messages = [{
        role: "user" as const,
        content: `Apply this SPECIFIC fix to the resume below.

=== FIX TO APPLY ===
${specificInstruction}

=== FORMAT NOTE ===
${formatNote}

=== CURRENT RESUME ===
${currentText}

Return ONLY the complete fixed resume text. No explanations, no JSON, no markdown fences.`,
    }];

    try {
        const result = await getAIReply(messages, "resume_fix");
        let fixedText = result.reply.trim();
        // Strip any accidental markdown fences
        if (fixedText.startsWith("```")) {
            fixedText = fixedText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
        }
        return {
            fixedText,
            fixDescription: `Applied fix: ${specificInstruction.split(".")[0]}.`,
        };
    } catch (err: any) {
        console.error("Failed to apply resume fix:", err);
        throw new Error("AI failed to apply the fix. Please try again.");
    }
}

// ── NEW: Rewrite specific resume section ───────────────────
export async function rewriteResumeSection(
    resumeText: string,
    sectionName: string,
    atsIssues: string[],
    jobDescription?: string
): Promise<{ reply: string }> {
    const issuesContext = atsIssues.length > 0 
        ? `\n=== ATS PENALTY ISSUES TO FIX ===\nFocus on resolving these known issues:\n- ${atsIssues.join("\n- ")}`
        : "";

    const jdContext = jobDescription
        ? `\n=== TARGET JOB DESCRIPTION ===\nTailor the keywords to this role:\n${jobDescription}`
        : "";

    const messages = [{
        role: "user" as const,
        content: `Rewrite the "${sectionName}" section of this resume to dramatically improve its ATS score and impact.
        
=== COMPLETE RESUME CONTENT ===
${resumeText}` + issuesContext + jdContext + `

Return ONLY the rewritten "${sectionName}" section text. Do not return the entire resume, and do not add any preamble.`
    }];

    try {
        const result = await getAIReply(messages, "resume_rewrite");
        return { reply: result.reply.trim() };
    } catch (err: any) {
        console.error("Failed to rewrite resume section:", err);
        throw new Error("AI failed to rewrite the section.");
    }
}

// ── NEW: Generate Full Improved Draft ──────────────────────
export async function generateImprovedDraft(
    resumeText: string,
    atsIssues: string[],
    jobDescription?: string
): Promise<{ reply: string }> {
    const issuesContext = atsIssues.length > 0 
        ? `\n=== KNOWN ATS PENALTIES ===\nFix these issues across the entire resume:\n- ${atsIssues.join("\n- ")}`
        : "";

    const jdContext = jobDescription
        ? `\n=== TARGET ROLE ===\nAlign technical keywords with this JD:\n${jobDescription}`
        : "";

    const messages = [{
        role: "user" as const,
        content: `Create a fully optimized, improved draft of this complete resume. 

=== ORIGINAL RESUME ===
${resumeText}` + issuesContext + jdContext + `

INSTRUCTIONS:
1. Re-format and re-write the entire resume text.
2. Resolve the listed ATS penalties.
3. Enhance all bullets using the STAR method and strong action verbs.
4. DO NOT hallucinate any new jobs, degrees, or false metrics.
5. Return ONLY the new resume text.`
    }];

    try {
        const result = await getAIReply(messages, "resume_rewrite");
        let content = result.reply.trim();
        if (content.startsWith("```")) {
            content = content.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
        }
        return { reply: content };
    } catch (err: any) {
        console.error("Failed to generate improved draft:", err);
        throw new Error("AI failed to generate a complete draft.");
    }
}
