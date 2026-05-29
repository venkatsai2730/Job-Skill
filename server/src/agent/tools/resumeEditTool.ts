// ═══════════════════════════════════════════════════════════════
// Resume Edit Tool — Generates structured ResumePatch via LLM
// Used by the Aria agent when the user wants to edit their resume
// ═══════════════════════════════════════════════════════════════

import { getAIReply } from "../../services/chatService.js";
import { normalizeToResumeData, validateResumePatch } from "../../types/resumePatchTypes.js";
import type { ResumeData, ResumePatch } from "../../types/resumePatchTypes.js";
import type { AgentTool, AgentContext } from "./index.js";

// ── Helper: Get resume data in normalized form ────────────────
function getResumeDataFromContext(ctx: AgentContext): ResumeData | null {
    const pd = ctx.resumeData;
    if (!pd) return null;

    // If resume_data already exists in normalized form, use it
    if (pd.resume_data) return pd.resume_data as ResumeData;

    // If we have sections, normalize from legacy ParsedSections
    if (pd.sections) return normalizeToResumeData(pd.sections);

    // Try to normalize the data directly if it looks like ParsedSections
    if (pd.summary !== undefined || pd.experience !== undefined) {
        return normalizeToResumeData(pd);
    }

    return null;
}

// ── Build the user message containing the resume state ────────
function buildResumeStateMessage(resumeData: ResumeData, userRequest: string, section?: string, jobDescription?: string): string {
    // Build a compact representation of the resume for the LLM
    const expSummary = resumeData.experience.map((e, i) =>
        `  [${i}] id="${e.id}" title="${e.title}" company="${e.company}" (${e.start_date} - ${e.end_date})\n` +
        e.bullets.map((b, bi) => `      bullet[${bi}]: "${b}"`).join("\n")
    ).join("\n");

    const projSummary = resumeData.projects.map((p, i) =>
        `  [${i}] id="${p.id}" name="${p.name}" tech=[${p.tech_stack.join(", ")}]\n` +
        (p.bullets.length > 0 ? p.bullets.map((b, bi) => `      bullet[${bi}]: "${b}"`).join("\n") : `      description: "${p.description}"`)
    ).join("\n");

    const eduSummary = resumeData.education.map((e, i) =>
        `  [${i}] id="${e.id}" degree="${e.degree}" institution="${e.institution}" year="${e.year}"`
    ).join("\n");

    let msg = `CURRENT RESUME STATE:
Summary: "${resumeData.summary}"

Experience:
${expSummary || "  (none)"}

Education:
${eduSummary || "  (none)"}

Skills: [${resumeData.skills.join(", ")}]

Projects:
${projSummary || "  (none)"}

USER REQUEST: "${userRequest}"`;

    if (section) {
        msg += `\n\nFocus on the "${section}" section.`;
    }
    if (jobDescription) {
        msg += `\n\nTarget Job Description:\n${jobDescription}`;
    }

    msg += `\n\nReturn ONLY the JSON patch object. No markdown, no text, no code fences.`;

    return msg;
}

// ═══════════════════════════════════════════════════════════════
// Resume Edit Tools — Exported for the tool registry
// ═══════════════════════════════════════════════════════════════
export const resumeEditTools: AgentTool[] = [
    {
        name: "edit_resume",
        description: "Generate structured resume edits (patches) that can be applied to the live resume preview",
        parameters: {
            userRequest: "string — what the user wants to change",
            section: "string? — specific section to edit (summary, experience, skills, etc.)",
            jobDescription: "string? — target JD for tailoring",
        },
        execute: async (args: any, ctx: AgentContext): Promise<any> => {
            const resumeData = getResumeDataFromContext(ctx);
            if (!resumeData) {
                return { error: "No resume found. Please upload a resume first." };
            }

            const userRequest = args.userRequest || ctx.message || "";
            const jobDescription = args.jobDescription || "";

            // Build the user message with full resume state
            const userMessage = buildResumeStateMessage(
                resumeData,
                userRequest,
                args.section,
                jobDescription
            );

            try {
                // Use 'resume_edit' feature — this uses the dedicated system prompt
                // from chatService.ts that instructs the LLM to return ONLY JSON
                const result = await getAIReply([
                    { role: "user", content: userMessage },
                ], "resume_edit");

                // Extract JSON from the response
                let rawJson: string = result.reply;

                // Strip markdown code fences if present
                rawJson = rawJson.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

                // Find the JSON object
                const jsonStart = rawJson.indexOf("{");
                const jsonEnd = rawJson.lastIndexOf("}");
                if (jsonStart === -1 || jsonEnd === -1) {
                    console.error("[edit_resume] No JSON object found in LLM response:", rawJson.substring(0, 300));
                    return {
                        error: "parse_failed",
                        raw_suggestion: result.reply,
                        message: "Could not generate structured patch. Here are the suggested edits:\n\n" + result.reply,
                    };
                }

                const jsonStr = rawJson.slice(jsonStart, jsonEnd + 1);
                let parsed;
                try {
                    parsed = JSON.parse(jsonStr);
                } catch (parseErr) {
                    console.error("[edit_resume] JSON parse failed:", parseErr, "\nRaw:", jsonStr.substring(0, 500));
                    return {
                        error: "parse_failed",
                        raw_suggestion: result.reply,
                        message: "Could not parse the AI response. Here are the suggested edits:\n\n" + result.reply,
                    };
                }

                const validated = validateResumePatch(parsed);

                if (!validated) {
                    console.error("[edit_resume] Patch validation failed:", JSON.stringify(parsed).substring(0, 500));
                    return {
                        error: "validation_failed",
                        raw_suggestion: result.reply,
                        message: "Generated patch was invalid. Here are the suggested edits:\n\n" + result.reply,
                    };
                }

                console.log("[edit_resume] ✅ Successfully generated patch with", validated.patches.length, "changes");

                // Return the validated patch
                return {
                    resume_patch: validated,
                    message: validated.explanation,
                };
            } catch (err: any) {
                console.error("[edit_resume] LLM call failed:", err.message);
                return {
                    error: "llm_failed",
                    message: "Failed to generate resume edits. Please try again.",
                };
            }
        },
    },
];
