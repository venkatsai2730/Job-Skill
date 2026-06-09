// ═══════════════════════════════════════════════════════════════
// Model Policy — Centralized model routing for Multi-LLM system
//
// Determines which model to use for each task type, with
// fallback chains, escalation rules, and cost awareness.
// ═══════════════════════════════════════════════════════════════

// ── Model Definitions ─────────────────────────────────────────
export interface ModelConfig {
    id: string;
    provider: "groq" | "gemini" | "mistral";
    name: string;
    maxTokens: number;
    costPerMToken: number;   // Relative cost score (1-10)
    latencyTier: "fast" | "medium" | "slow";
    strengths: string[];
}

export const MODELS: Record<string, ModelConfig> = {
    LLAMA_SCOUT: {
        id: "meta-llama/llama-4-scout-17b-16e-instruct",
        provider: "groq",
        name: "Llama 4 Scout",
        maxTokens: 8192,
        costPerMToken: 1,
        latencyTier: "fast",
        strengths: ["classification", "extraction", "quick_tasks", "tool_planning"],
    },
    GEMINI_PRO: {
        id: "gemini-2.5-pro-preview-05-06",
        provider: "gemini",
        name: "Gemini 2.5 Pro",
        maxTokens: 65536,
        costPerMToken: 5,
        latencyTier: "medium",
        strengths: ["analysis", "structured_output", "resume_scoring", "deep_reasoning"],
    },
    LLAMA_MAVERICK: {
        id: "meta-llama/llama-4-maverick-17b-128e-instruct",
        provider: "groq",
        name: "Llama 4 Maverick",
        maxTokens: 8192,
        costPerMToken: 2,
        latencyTier: "fast",
        strengths: ["creative_writing", "cover_letters", "interview_questions", "career_advice"],
    },
    CODESTRAL: {
        id: "codestral-latest",
        provider: "mistral",
        name: "Codestral",
        maxTokens: 32768,
        costPerMToken: 3,
        latencyTier: "medium",
        strengths: ["code_generation", "technical_analysis", "debugging"],
    },
};

// ── Task → Model Mapping ──────────────────────────────────────
const TASK_MODEL_MAP: Record<string, string[]> = {
    // Fast classification tasks → Scout
    intent_classification: ["LLAMA_SCOUT"],
    skill_extraction: ["LLAMA_SCOUT"],
    entity_extraction: ["LLAMA_SCOUT"],
    tool_planning: ["LLAMA_SCOUT"],
    seniority_classification: ["LLAMA_SCOUT"],

    // Deep analysis → Gemini Pro
    resume_scoring: ["GEMINI_PRO", "LLAMA_MAVERICK"],
    resume_analysis: ["GEMINI_PRO", "LLAMA_MAVERICK"],
    job_matching: ["GEMINI_PRO", "LLAMA_MAVERICK"],
    keyword_gap: ["GEMINI_PRO", "LLAMA_SCOUT"],
    skill_gap: ["GEMINI_PRO", "LLAMA_SCOUT"],

    // Creative writing → Maverick
    cover_letter: ["LLAMA_MAVERICK", "GEMINI_PRO"],
    resume_rewrite: ["LLAMA_MAVERICK", "GEMINI_PRO"],
    linkedin_audit: ["LLAMA_MAVERICK", "GEMINI_PRO"],
    career_roadmap: ["LLAMA_MAVERICK", "GEMINI_PRO"],
    interview_questions: ["LLAMA_MAVERICK", "GEMINI_PRO"],
    interview_feedback: ["LLAMA_MAVERICK", "GEMINI_PRO"],
    mock_interview: ["LLAMA_MAVERICK", "GEMINI_PRO"],
    salary_insights: ["LLAMA_MAVERICK", "GEMINI_PRO"],

    // Generic chat → Scout (fast) with Maverick upgrade
    chat: ["LLAMA_SCOUT", "LLAMA_MAVERICK"],
    synthesis: ["LLAMA_MAVERICK", "GEMINI_PRO"],

    // Code-related → Codestral
    code_review: ["CODESTRAL", "GEMINI_PRO"],
    technical_question: ["CODESTRAL", "GEMINI_PRO"],

    // Bullet fixing → Gemini for precision
    fix_bullets: ["GEMINI_PRO", "LLAMA_MAVERICK"],
    create_bullets: ["LLAMA_MAVERICK", "GEMINI_PRO"],
    resume_fix: ["GEMINI_PRO", "LLAMA_MAVERICK"],
};

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Select the best model for a given task type.
 *
 * @param taskType - The type of task (e.g., "chat", "resume_scoring")
 * @param opts.preferFast - If true, prefer lower-latency models
 * @param opts.preferQuality - If true, prefer higher-quality models
 * @returns ModelConfig for the primary model
 */
export function selectModelForTask(
    taskType: string,
    opts?: { preferFast?: boolean; preferQuality?: boolean }
): ModelConfig {
    const chain = TASK_MODEL_MAP[taskType] || TASK_MODEL_MAP["chat"];
    const primaryKey = chain[0];
    const model = MODELS[primaryKey];

    if (!model) {
        console.warn(`[ModelPolicy] Unknown model key: ${primaryKey}, falling back to Scout`);
        return MODELS.LLAMA_SCOUT;
    }

    // Override with preference
    if (opts?.preferFast && model.latencyTier !== "fast") {
        const fastAlternative = chain.find(k => MODELS[k]?.latencyTier === "fast");
        if (fastAlternative) return MODELS[fastAlternative];
    }

    if (opts?.preferQuality && model.costPerMToken < 5) {
        const qualityAlternative = chain.find(k => (MODELS[k]?.costPerMToken || 0) >= 5);
        if (qualityAlternative) return MODELS[qualityAlternative];
    }

    return model;
}

/**
 * Get the full fallback chain for a task type.
 * Returns models in priority order (primary → fallback1 → fallback2).
 */
export function getFallbackChain(taskType: string): ModelConfig[] {
    const chain = TASK_MODEL_MAP[taskType] || TASK_MODEL_MAP["chat"];
    return chain
        .map(key => MODELS[key])
        .filter(Boolean);
}

/**
 * Determine if a failure should trigger escalation to a stronger model.
 *
 * @returns The next model to try, or null if no escalation possible.
 */
export function shouldEscalateToStrongerModel(
    taskType: string,
    currentModelId: string,
    failureReason: string
): ModelConfig | null {
    const chain = TASK_MODEL_MAP[taskType] || TASK_MODEL_MAP["chat"];

    // Find current model's position in the chain
    const currentIdx = chain.findIndex(key => MODELS[key]?.id === currentModelId);
    if (currentIdx < 0 || currentIdx >= chain.length - 1) return null;

    // Only escalate for specific failure types
    const escalatableReasons = [
        "rate_limited",
        "timeout",
        "context_too_long",
        "quality_issue",
        "parsing_failed",
    ];

    const shouldEscalate = escalatableReasons.some(r =>
        failureReason.toLowerCase().includes(r)
    );

    if (!shouldEscalate) return null;

    const nextKey = chain[currentIdx + 1];
    return MODELS[nextKey] || null;
}

/**
 * Map existing chatService feature names to task types.
 * This ensures backward compatibility during migration.
 */
export function featureToTaskType(feature: string): string {
    const mapping: Record<string, string> = {
        "chat": "chat",
        "fix_bullets": "fix_bullets",
        "create_bullets": "create_bullets",
        "resume_fix": "resume_fix",
        "resume_rewrite": "resume_rewrite",
        "interview_prediction": "interview_questions",
        "cover_letter": "cover_letter",
        "linkedin_audit": "linkedin_audit",
    };
    return mapping[feature] || "chat";
}
