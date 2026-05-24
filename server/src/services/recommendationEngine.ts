// ═══════════════════════════════════════════════════════════════
// Career-Track Recommendation Engine — Specialized Matching Heuristics
// ═══════════════════════════════════════════════════════════════

export type CareerTrack = "ML_AI" | "DATA_ANALYTICS" | "BACKEND_SYSTEMS" | "FRONTEND" | "GENERAL_SWE";

/**
 * Classifies a set of skills and job title into a standard Career Track.
 */
export function classifyCareerTrack(skills: string[], title: string): CareerTrack {
    const titleLower = (title || "").toLowerCase();
    const skillsSet = new Set(skills.map(s => s.toLowerCase().replace(/[\s.]+/g, '')));

    // 1. Strict Title-based Classifications (Highest Priority)
    if (/\b(ml|machine\s+learning|ai|artificial\s+intelligence|deep\s+learning|nlp|computer\s+vision|llm|sagemaker|transformers|pytorch|tensorflow)\b/i.test(titleLower)) {
        return "ML_AI";
    }
    if (/\b(data\s+scientist|data\s+science)\b/i.test(titleLower)) {
        // Distinguish modeling scientists (ML) from analytics scientists (BI/Analytics)
        const hasMLSkills = ["pytorch", "tensorflow", "xgboost", "machinelearning", "llm", "rag", "sagemaker", "keras", "deeplearning"].some(
            s => skillsSet.has(s)
        );
        return hasMLSkills ? "ML_AI" : "DATA_ANALYTICS";
    }
    if (/\b(data\s+analyst|analytics|bi|tableau|powerbi|business\s+intelligence|dashboard|looker)\b/i.test(titleLower)) {
        return "DATA_ANALYTICS";
    }
    if (/\b(frontend|front-end|react|angular|vue|ui|ux|designer|web\s+developer)\b/i.test(titleLower)) {
        return "FRONTEND";
    }
    if (/\b(backend|back-end|database|cloud|devops|sre|platform|infra|systems|kubernetes|docker|aws|azure|gcp|platform\s+engineer)\b/i.test(titleLower)) {
        return "BACKEND_SYSTEMS";
    }

    // 2. Skill-based fallbacks (Count occurrences of track keywords)
    let mlCount = 0;
    let analyticsCount = 0;
    let backendCount = 0;
    let frontendCount = 0;

    const ML_KWS = [
        "tensorflow", "pytorch", "xgboost", "machinelearning", "deeplearning", "ml", "nlp", 
        "transformers", "llm", "llms", "rag", "langchain", "huggingface", "sagemaker", "anomaly", 
        "forecasting", "timeseries", "scikit", "numpy", "pandas", "opencv"
    ];
    const ANALYTICS_KWS = [
        "tableau", "powerbi", "excel", "bi", "analytics", "dashboard", "looker", "powerpoint", "sql"
    ];
    const BACKEND_KWS = [
        "node", "express", "django", "flask", "fastapi", "spring", "java", "golang", "rust", "cpp", 
        "c++", "csharp", "postgresql", "mysql", "mongodb", "redis", "kafka", "docker", "kubernetes", "aws", "gcp"
    ];
    const FRONTEND_KWS = [
        "react", "angular", "vue", "next", "javascript", "typescript", "html", "css", "tailwind", "sass", "vite"
    ];

    ML_KWS.forEach(s => { if (skillsSet.has(s)) mlCount++; });
    ANALYTICS_KWS.forEach(s => { if (skillsSet.has(s)) analyticsCount++; });
    BACKEND_KWS.forEach(s => { if (skillsSet.has(s)) backendCount++; });
    FRONTEND_KWS.forEach(s => { if (skillsSet.has(s)) frontendCount++; });

    const max = Math.max(mlCount, analyticsCount, backendCount, frontendCount);
    if (max === 0) return "GENERAL_SWE";

    if (max === mlCount) return "ML_AI";
    if (max === analyticsCount) return "DATA_ANALYTICS";
    if (max === frontendCount) return "FRONTEND";
    return "BACKEND_SYSTEMS";
}

/**
 * Classifies a job into a standard Career Track.
 */
export function classifyJobTrack(title: string, description: string, skills: string[]): CareerTrack {
    const combinedText = ((description || "") + " " + (skills || []).join(" ")).toLowerCase();
    const tokenSkills = combinedText.split(/\s+/).slice(0, 150);
    return classifyCareerTrack(tokenSkills, title);
}

/**
 * Computes career track alignment score.
 * Returns a boost/penalty amount and a descriptive reason.
 */
export function scoreTrackAlignment(
    userSkills: string[],
    userTitle: string,
    job: { title: string; description: string; skills: string[]; company: string }
): { scoreModifier: number; trackReason: string; userTrack: CareerTrack; jobTrack: CareerTrack } {
    const userTrack = classifyCareerTrack(userSkills, userTitle);
    const jobTrack = classifyJobTrack(job.title, job.description, job.skills);

    const TRACK_LABELS: Record<CareerTrack, string> = {
        "ML_AI": "Machine Learning & AI",
        "DATA_ANALYTICS": "Data Analytics & BI",
        "BACKEND_SYSTEMS": "Backend & Systems",
        "FRONTEND": "Web & Frontend",
        "GENERAL_SWE": "General Software Engineering"
    };

    if (userTrack === jobTrack) {
        return {
            scoreModifier: 20,
            trackReason: `Excellent career track alignment (${TRACK_LABELS[userTrack]})`,
            userTrack,
            jobTrack
        };
    }

    // Heavy mismatch penalties for specialized fields
    if (userTrack === "ML_AI" && (jobTrack === "FRONTEND" || jobTrack === "DATA_ANALYTICS")) {
        return {
            scoreModifier: -35,
            trackReason: `Career track mismatch (${TRACK_LABELS[jobTrack]} role vs ${TRACK_LABELS[userTrack]} profile)`,
            userTrack,
            jobTrack
        };
    }

    if (userTrack === "FRONTEND" && (jobTrack === "ML_AI" || jobTrack === "DATA_ANALYTICS")) {
        return {
            scoreModifier: -35,
            trackReason: `Career track mismatch (${TRACK_LABELS[jobTrack]} role vs ${TRACK_LABELS[userTrack]} profile)`,
            userTrack,
            jobTrack
        };
    }

    if (userTrack === "DATA_ANALYTICS" && (jobTrack === "FRONTEND" || jobTrack === "ML_AI")) {
        return {
            scoreModifier: -30,
            trackReason: `Career track mismatch (${TRACK_LABELS[jobTrack]} role vs ${TRACK_LABELS[userTrack]} profile)`,
            userTrack,
            jobTrack
        };
    }

    return {
        scoreModifier: 0,
        trackReason: `Acceptable cross-domain fit (${TRACK_LABELS[userTrack]} user vs ${TRACK_LABELS[jobTrack]} role)`,
        userTrack,
        jobTrack
    };
}
