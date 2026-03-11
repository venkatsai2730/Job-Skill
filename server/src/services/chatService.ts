// ═══════════════════════════════════════════════════════════════
// Multi-Model AI Service — Llama 4 Scout, Maverick, Gemini 2.5 Pro, Codestral
// ═══════════════════════════════════════════════════════════════

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
    | "code_gen";

const SYSTEM_PROMPTS: Record<string, string> = {
    chat: `You are JobSkill AI — an Elite Career Coach and Job Search Assistant for India & Global markets.

### CORE CAPABILITIES:
1. **📊 Resume Audit**: Deep scan, ATS score (0-100), Top 3 Critical Fixes
2. **📄 ATS Check**: Readability analysis, missing keywords
3. **💼 Find Jobs**: Recommend 3-5 roles with "Why you fit" and "Where to apply"
4. **🔗 LinkedIn**: Custom Headline and About section
5. **🧠 Skill Gap**: Compare skills vs 2026 market, 3-step roadmap
6. **✍️ Cover Letter**: Generate tailored cover letters
7. **📋 Screening Q&A**: Answer common screening questions
8. **💻 Code Help**: Technical interview prep and code review

### RULES:
- USE THE DATA provided in chat history — never say "I don't have your resume" if text is present
- Be PERSONAL — address user by name if found in resume
- Always end with a suggestion for next steps
- Format responses with markdown for readability`,

    cover_letter: `You are an expert cover letter writer. Generate professional, tailored cover letters.

### RULES:
- Length: 300-400 words
- Tone: Match the requested tone (formal/friendly/confident)
- Structure: Opening hook → Why this company → Matching skills → Closing with enthusiasm
- Mention specific company values/projects when provided
- Highlight 3-4 key matching skills from the resume
- Never use generic filler — every sentence must add value
- Output ONLY the cover letter text, no explanations`,

    screening: `You are a screening question answering assistant. Answer job application screening questions using the user's profile data.

### RULES:
- Be concise and professional
- Use specific data from the user's profile (years of exp, skills, etc.)
- For salary questions, give a range based on market data
- For "why this company" questions, research the company and give genuine reasons
- Never fabricate experience — only use what's in the profile
- Output as JSON array: [{ "question": "...", "answer": "..." }]`,

    job_match: `You are a job matching AI. Score how well a candidate matches a job posting.

### SCORING CRITERIA (100 points):
- Skills Match: 40%
- Experience Match: 25%
- Location Match: 15%
- Education Match: 10%
- Salary Match: 10%

### OUTPUT FORMAT (JSON only):
{
  "match_score": 87,
  "breakdown": { "skills": 92, "experience": 85, "location": 100, "education": 70, "salary": 80 },
  "missing_skills": ["Docker", "GraphQL"],
  "strong_points": ["React", "Node.js", "3 yrs exp"],
  "recommendation": "Apply immediately — strong match!"
}`,

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
};

// ── Model Configuration ─────────────────────────────────────
const MODELS = {
    scout: "meta-llama/llama-4-scout-17b-16e-instruct",
    maverick: "meta-llama/llama-4-maverick-17b-128e-instruct",
    gemini: "gemini-2.5-pro-preview-06-05",
    codestral: "codestral-latest",
};

const FEATURE_MODEL_MAP: Record<AIFeature, { provider: string; model: string }> = {
    chat: { provider: "groq", model: MODELS.scout },
    resume_image: { provider: "groq", model: MODELS.scout },
    cover_letter: { provider: "groq", model: MODELS.maverick },
    agent: { provider: "groq", model: MODELS.scout },
    screening: { provider: "groq", model: MODELS.scout },
    notification: { provider: "groq", model: MODELS.scout },
    resume_pdf: { provider: "gemini", model: MODELS.gemini },
    job_match: { provider: "gemini", model: MODELS.gemini },
    code_gen: { provider: "mistral", model: MODELS.codestral },
};

// ═══════════════════════════════════════════════════════════════
// Provider Implementations
// ═══════════════════════════════════════════════════════════════

async function callGroq(messages: any[], model: string, systemPrompt: string, maxTokens = 4000) {
    // Llama 4 Scout supports vision natively — pass image_url parts through
    const cleanMessages = messages.map(m => {
        if (typeof m.content === "string") return { role: m.role, content: m.content };

        if (Array.isArray(m.content)) {
            const parts: any[] = [];
            for (const p of m.content) {
                if (p.type === "text") parts.push({ type: "text", text: p.text });
                if (p.type === "image") {
                    // Llama 4 Scout vision via Groq uses image_url format
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
            temperature: 0.4,
            stream: false,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Groq (${model}): ${err.error?.message || res.status}`);
    }
    const data = await res.json();
    return {
        reply: data.choices[0].message.content,
        provider: "groq",
        model,
        tokens: data.usage?.total_tokens || 0,
    };
}

async function callGemini(messages: any[], model: string, systemPrompt: string, maxTokens = 4000) {
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
                generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4, topP: 0.9 },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                ],
            }),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Gemini (${model}): ${err.error?.message || res.status}`);
    }
    const data = await res.json();
    return {
        reply: data.candidates[0].content.parts[0].text,
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

export async function getAIReply(messages: any[], feature: AIFeature = "chat") {
    const config = FEATURE_MODEL_MAP[feature];
    const systemPrompt = SYSTEM_PROMPTS[feature] || SYSTEM_PROMPTS.chat;

    // Auto-detect images → use Scout vision if feature is chat
    const hasImages = messages.some(m =>
        Array.isArray(m.content) && m.content.some((p: any) => p.type === "image")
    );
    if (hasImages && feature === "chat") {
        // Route to Scout vision
        return callGroq(messages, MODELS.scout, systemPrompt, 4000);
    }

    const providerFn = config.provider === "gemini" ? callGemini
        : config.provider === "mistral" ? callMistral
            : callGroq;

    // Primary attempt
    try {
        return await providerFn(messages, config.model, systemPrompt);
    } catch (err: any) {
        console.warn(`[AI] Primary provider failed for ${feature}: ${err.message}`);
    }

    // Fallback chain: try other providers
    const fallbacks = [
        { fn: callGroq, model: MODELS.scout, name: "groq-scout" },
        { fn: callGemini, model: MODELS.gemini, name: "gemini" },
    ].filter(f => f.fn !== providerFn);

    for (const fb of fallbacks) {
        try {
            console.log(`[AI] Falling back to ${fb.name} for ${feature}`);
            return await fb.fn(messages, fb.model, systemPrompt);
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
