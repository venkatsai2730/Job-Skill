// ═══════════════════════════════════════════════════════════════
// Final Response Node — Formats output + suggests next action
//
// Last node in the graph. Ensures response format matches the
// existing API contract expected by the frontend.
// ═══════════════════════════════════════════════════════════════

import { traceNodeExecution } from "../../observability/langfuse.js";
import type { AgentGraphState } from "../state.js";

export async function finalResponseNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "final_response", state);

    let answer = state.finalAnswer || "I wasn't able to process your request. Please try again.";

    // Ensure the response ends with a next-step suggestion
    if (!answer.includes("💡 Next step:") && !answer.includes("💡 Next:")) {
        const nextAction = suggestNextAction(state);
        if (nextAction) {
            answer += `\n\n💡 Next step: ${nextAction}`;
        }
    }

    return {
        finalAnswer: answer,
        nextAction: suggestNextAction(state),
    };
}

// ── Next action suggestions based on intent ───────────────────
function suggestNextAction(state: AgentGraphState): string | null {
    const intent = state.intent?.name || "general_chat";

    const suggestions: Record<string, string> = {
        score_inquiry: "Run `/fix` to auto-improve your weakest bullets",
        fix_bullet: "Run `/score` to see your updated ATS score",
        keyword_gap: "Run `/tailor [JD]` to automatically align your resume",
        skill_gap: "Run `/roadmap` to get a learning plan for missing skills",
        resume_rewrite: "Run `/score` to see the impact on your ATS score",
        job_search: "Run `/match [paste JD]` to deep-compare with a specific job",
        top_matches: "Run `/cover [JD]` to generate a cover letter for your top match",
        job_explanation: "Run `/apply` to generate a full application package",
        cover_letter: "Review and personalize the letter before sending",
        interview_prep: "Run `/mock` to practice with a simulated interview",
        answer_feedback: "Try answering another question with the feedback in mind",
        mock_interview: "Continue the mock session by answering the question above",
        career_roadmap: "Bookmark this roadmap and start with Week 1 tasks",
        linkedin_audit: "Update your LinkedIn profile with the optimized text",
        salary_query: "Run `/jobs [role]` to see current openings at these salary levels",
        general_career: "Run `/roadmap` to create a structured action plan",
        full_job_apply: "Review all materials and submit your application",
    };

    return suggestions[intent] || null;
}
