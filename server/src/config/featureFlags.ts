// ═══════════════════════════════════════════════════════════════
// Feature Flags — Gated rollout for Multi-Agent architecture
//
// All flags default to false. Enable via environment variables.
// This ensures zero breakage: the existing system runs unchanged
// until you explicitly flip each flag in .env.
// ═══════════════════════════════════════════════════════════════

function envBool(key: string, fallback = false): boolean {
    const val = process.env[key];
    if (!val) return fallback;
    return val === "true" || val === "1";
}

/** Use LangGraph orchestrator instead of custom ariaAgent loop */
export const USE_LANGGRAPH = envBool("USE_LANGGRAPH");

/** Enable Qdrant vector DB for semantic retrieval (RAG) */
export const USE_QDRANT_RAG = envBool("USE_QDRANT_RAG");

/** Enable Langfuse observability tracing */
export const USE_LANGFUSE = envBool("USE_LANGFUSE");

/** Enable hybrid relational + semantic job ranking */
export const USE_HYBRID_JOB_RANKING = envBool("USE_HYBRID_JOB_RANKING");

// Log active flags on startup
const activeFlags = [
    USE_LANGGRAPH && "LANGGRAPH",
    USE_QDRANT_RAG && "QDRANT_RAG",
    USE_LANGFUSE && "LANGFUSE",
    USE_HYBRID_JOB_RANKING && "HYBRID_JOB_RANKING",
].filter(Boolean);

if (activeFlags.length > 0) {
    console.log(`🚩 Active feature flags: ${activeFlags.join(", ")}`);
} else {
    console.log("🚩 All feature flags OFF — running legacy mode");
}
