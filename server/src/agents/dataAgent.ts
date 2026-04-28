// ═══════════════════════════════════════════════════════════════
// Data Agent — Normalization, enrichment, RAG orchestration
//
// Handles salary normalization, skill extraction, and vector
// retrieval operations. The "data pipeline" intelligence layer.
// ═══════════════════════════════════════════════════════════════

import { retrieveSimilarJobs, retrieveRelatedSkills } from "../rag/retrieve.js";
import { selectModelForTask } from "../agent/modelPolicy.js";

export class DataAgent {
    private modelConfig;

    constructor() {
        this.modelConfig = selectModelForTask("skill_extraction", { preferFast: true });
    }

    getSystemPrompt(): string {
        return `You are the Data Agent within JobSkill AI.
Your job is to normalize, enrich, and process career data.

CAPABILITIES:
- Semantic job retrieval from vector database
- Salary normalization across currencies
- Skill taxonomy mapping
- Experience level classification`;
    }

    getPreferredModel() {
        return this.modelConfig;
    }

    async findSemanticJobs(queryText: string, topK: number = 15): Promise<any[]> {
        return retrieveSimilarJobs(queryText, topK);
    }

    async findRelatedSkills(skillQuery: string): Promise<any[]> {
        return retrieveRelatedSkills(skillQuery, 10);
    }

    normalizeSalary(min: number | null, max: number | null): string | null {
        if (!min && !max) return null;
        if (min && min > 100000) {
            return max
                ? `₹${(min / 100000).toFixed(1)}L - ₹${(max / 100000).toFixed(1)}L`
                : `₹${(min / 100000).toFixed(1)}L+`;
        }
        if (min) {
            return max
                ? `$${(min / 1000).toFixed(0)}K - $${(max / 1000).toFixed(0)}K`
                : `$${(min / 1000).toFixed(0)}K+`;
        }
        return null;
    }
}

export const dataAgent = new DataAgent();
