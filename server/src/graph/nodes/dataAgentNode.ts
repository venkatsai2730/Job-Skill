// ═══════════════════════════════════════════════════════════════
// Data Agent Node — Normalization, enrichment, RAG orchestration
//
// Handles salary normalization, skill extraction from JDs,
// semantic retrieval for job matching, and embedding triggers.
// ═══════════════════════════════════════════════════════════════

import { retrieveSimilarJobs } from "../../rag/retrieve.js";
import { traceNodeExecution, traceRetrieval } from "../../observability/langfuse.js";
import type { AgentGraphState, ToolCallRecord, RetrievalRecord } from "../state.js";

export async function dataAgentNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "data_agent", state);

    const toolCalls: ToolCallRecord[] = [];
    const retrievals: RetrievalRecord[] = [];
    let dataResult: any = null;

    try {
        const startTime = Date.now();

        // 1. Semantic job retrieval via Qdrant (if jobs are part of the plan)
        if (state.plan?.needsRag) {
            const queryText = buildSearchQuery(state);
            const ragStartTime = Date.now();

            const semanticJobs = await retrieveSimilarJobs(queryText, 15);
            const ragLatency = Date.now() - ragStartTime;

            retrievals.push({
                collection: "job_descriptions",
                query: queryText.substring(0, 200),
                topK: 15,
                hits: semanticJobs.length,
                latencyMs: ragLatency,
            });

            traceRetrieval(state.traceId, {
                collection: "job_descriptions",
                query: queryText.substring(0, 200),
                topK: 15,
                hits: semanticJobs.length,
                latencyMs: ragLatency,
                parentNode: "data_agent",
            });

            dataResult = {
                semanticJobs: semanticJobs.map(j => ({
                    text: j.text,
                    score: j.score,
                    title: j.metadata?.title || "",
                    company: j.metadata?.company || "",
                    location: j.metadata?.location || "",
                    skills: j.metadata?.required_skills || [],
                })),
            };
        }

        // 2. Normalize salary data from job contexts
        if (state.jobsContext.length > 0) {
            const normalizedJobs = normalizeJobData(state.jobsContext);
            dataResult = { ...dataResult, normalizedJobs };
        }

        // 3. Extract and aggregate skill requirements
        const skillAggregation = aggregateSkills(state);
        if (skillAggregation.length > 0) {
            dataResult = { ...dataResult, skillAggregation };
        }

        const latency = Date.now() - startTime;
        toolCalls.push({
            tool: "data_processing",
            input: { needsRag: state.plan?.needsRag },
            output: { hasSemanticJobs: !!dataResult?.semanticJobs?.length },
            status: "success",
            latencyMs: latency,
        });
    } catch (err: any) {
        console.warn("[DataAgentNode] Error:", err.message);
        toolCalls.push({
            tool: "data_processing",
            input: {},
            output: { error: err.message },
            status: "error",
            latencyMs: 0,
        });
    }

    return {
        dataContext: dataResult,
        toolCalls,
        retrievals,
        ragContext: dataResult?.semanticJobs
            ? [{ source: "job_descriptions", hits: dataResult.semanticJobs.length }]
            : [],
    };
}

// ── Helpers ───────────────────────────────────────────────────
function buildSearchQuery(state: AgentGraphState): string {
    const parts: string[] = [];

    // Use user skills as search context
    if (state.resumeContext?.userSkills?.length > 0) {
        parts.push(state.resumeContext.userSkills.slice(0, 10).join(" "));
    }

    // Use intent entities
    if (state.intent?.entities?.targetRole) {
        parts.push(state.intent.entities.targetRole);
    }

    // Use message body
    const body = state.userMessage.replace(/^\/\w+\s*/, "").trim();
    if (body) parts.push(body);

    return parts.join(" ") || "software engineer";
}

function normalizeJobData(jobsContext: any[]): any[] {
    return jobsContext.map(jc => {
        const result = jc.result;
        if (!result?.jobs) return jc;

        return {
            ...jc,
            result: {
                ...result,
                jobs: (result.jobs || []).map((j: any) => ({
                    ...j,
                    normalized_salary: normalizeSalary(j),
                })),
            },
        };
    });
}

function normalizeSalary(job: any): string | null {
    if (job.salary_min && job.salary_max) {
        if (job.salary_min > 100000) {
            return `₹${(job.salary_min / 100000).toFixed(1)}L - ₹${(job.salary_max / 100000).toFixed(1)}L`;
        }
        return `$${(job.salary_min / 1000).toFixed(0)}K - $${(job.salary_max / 1000).toFixed(0)}K`;
    }
    return null;
}

function aggregateSkills(state: AgentGraphState): string[] {
    const skillSet = new Set<string>();

    // From job contexts
    for (const jc of state.jobsContext) {
        const jobs = jc.result?.jobs || [];
        for (const job of jobs) {
            for (const skill of (job.matched_skills || [])) {
                skillSet.add(skill);
            }
            for (const skill of (job.skill_gap || [])) {
                skillSet.add(skill);
            }
        }
    }

    return Array.from(skillSet);
}
