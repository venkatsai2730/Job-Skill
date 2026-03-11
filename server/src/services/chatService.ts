const SYSTEM_PROMPT = `You are JobSkill AI — an Elite Resume Auditor and ATS Specialist. Your goal is to provide world-class, data-driven career coaching. 

### 🛡️ THE 5 PILLARS OF PERFORMANCE (EXECUTION PROTOCOL)
When you detect one of these 5 pillars, you MUST EXECUTE IT IMMEDIATELY using the specific data found in the message history or uploads. DO NOT explain these pillars; PERFORM THEM.

1. **📊 Resume Audit**: 
   - Perform a deep scan. Calculate a score (0-100).
   - MUST output the **Audit Table** and **Top 3 Critical Fixes** immediately.
   
2. **📄 ATS Check**:
   - Analyze readability. List missing "ATS Keywords" based on the tech skills you see in the resume.

3. **💼 Find Jobs**:
   - Recommend 3-5 specific roles. For each: "Why you fit" and "Where to apply".

4. **🔗 LinkedIn**:
   - provide a custom Headline and "About" section based on the resume content.

5. **🧠 Skill Gap**:
   - compare the current resume skills against 2026 market demands and provide a 3-step upgrade roadmap.

### 🛠️ MANDATORY RULES:
- **USE THE DATA**: I can see the user HAS provided text. Use the text labeled "[File Content: ...]" or "[File: ...]".
- **NO HALLUCINATIONS**: Never say "I don't have your resume" if the text is present in the chat history.
- **PERSONAL**: Address the user by name if it's in the resume.
- **CLOSING**: Always end with: "Which of these deep-dives should we do next?"`;

async function callGroq(messages: any[]) {
    const cleanMessages = messages.map(m => {
        if (typeof m.content === 'string') return { role: m.role, content: m.content };

        // Extract all text parts from array content
        const textParts = Array.isArray(m.content)
            ? m.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join("\n")
            : "";

        return {
            role: m.role,
            content: textParts || "User sent a file/image which I can't process as text right now."
        };
    });

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...cleanMessages],
            max_tokens: 2000,
            temperature: 0.4,
            stream: false,
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Groq: ${err.error?.message || res.status}`);
    }
    const data = await res.json();
    return {
        reply: data.choices[0].message.content,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        tokens: data.usage?.total_tokens || 0,
    };
}

async function callGemini(messages: any[]) {
    // Gemini supports multimodal!
    const geminiMessages: any[] = [];

    for (const m of messages) {
        const role = m.role === "assistant" ? "model" : "user";
        const parts: any[] = [];

        if (typeof m.content === 'string') {
            parts.push({ text: m.content });
        } else if (Array.isArray(m.content)) {
            // Handle array of parts (text + images)
            for (const part of m.content) {
                if (part.type === 'text') parts.push({ text: part.text });
                if (part.type === 'image') {
                    parts.push({
                        inline_data: {
                            mime_type: part.mimeType,
                            data: part.base64
                        }
                    });
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: geminiMessages,
                generationConfig: {
                    maxOutputTokens: 1500,
                    temperature: 0.4,
                    topP: 0.9,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                ],
            }),
        }
    );

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Gemini: ${err.error?.message || res.status}`);
    }
    const data = await res.json();
    return {
        reply: data.candidates[0].content.parts[0].text,
        provider: "gemini",
        model: "gemini-2.0-flash",
        tokens: data.usageMetadata?.totalTokenCount || 0,
    };
}

// Smart router with retry logic
export async function getAIReply(messages: any[], preferredProvider = "groq") {
    // If messages contain images, default to Gemini (it has vision)
    const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some((p: any) => p.type === 'image'));
    const effectivePreferredProvider = hasImages ? "gemini" : preferredProvider;

    const providers = effectivePreferredProvider === "groq"
        ? [callGroq, callGemini]
        : [callGemini, callGroq];

    let lastError;
    for (const provider of providers) {
        try {
            return await provider(messages);
        } catch (err: any) {
            console.warn(`[AI] Provider failed: ${err.message}`);
            lastError = err;
        }
    }
    throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
}
