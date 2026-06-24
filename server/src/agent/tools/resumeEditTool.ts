// ═══════════════════════════════════════════════════════════════
// Resume Edit Tool — Generates AriaEdit via LLM (simple schema)
// Uses entry names instead of UUIDs — far more reliable.
// ═══════════════════════════════════════════════════════════════

import { getAIReply } from "../../services/chatService.js";
import { normalizeToResumeData, validateAriaEdit } from "../../types/resumePatchTypes.js";
import type { ResumeData, AriaEdit } from "../../types/resumePatchTypes.js";
import type { AgentTool, AgentContext } from "./index.js";

function isLegacyParsedSections(rd: any): boolean {
    // ParsedSections has skills as SkillGroup[] ({ category, items }) or experience with .dates
    if (Array.isArray(rd.skills) && rd.skills.length > 0 && typeof rd.skills[0] === "object" && "items" in rd.skills[0]) return true;
    if (Array.isArray(rd.experience) && rd.experience.length > 0 && "dates" in rd.experience[0]) return true;
    return false;
}

function getResumeDataFromContext(ctx: AgentContext): ResumeData | null {
    const pd = ctx.resumeData;
    if (!pd) return null;
    if (pd.resume_data) {
        // resume_data from frontend is ParsedSections (legacy) — detect and normalize
        return isLegacyParsedSections(pd.resume_data)
            ? normalizeToResumeData(pd.resume_data)
            : pd.resume_data as ResumeData;
    }
    if (pd.sections) return normalizeToResumeData(pd.sections);
    if (pd.summary !== undefined || pd.experience !== undefined) return normalizeToResumeData(pd);
    return null;
}

// Build a compact, human-readable resume summary for the LLM
// Uses NAMES not UUIDs — the LLM references entries by company/project name
function buildResumeContext(resumeData: ResumeData, userRequest: string, jobDescription?: string): string {
    const expLines = (resumeData.experience || []).map((e, i) =>
        `  Experience [${i}]: ${e.title} at ${e.company} (${e.start_date} – ${e.end_date})\n` +
        (e.bullets || []).map((b, bi) => `    Bullet ${bi}: "${b}"`).join("\n")
    ).join("\n");

    const projLines = (resumeData.projects || []).map((p, i) =>
        `  Project [${i}]: ${p.name}${(p as any).url ? ` (${(p as any).url})` : ""} (${(p.tech_stack || []).join(", ")})\n` +
        ((p.bullets || []).length > 0
            ? (p.bullets || []).map((b, bi) => `    Bullet ${bi}: "${b}"`).join("\n")
            : `    Description: "${p.description}"`)
    ).join("\n");

    const skillsStr = Array.isArray(resumeData.skills)
        ? resumeData.skills.filter((s: any) => typeof s === "string").join(", ")
        : "";

    const linksData = (resumeData as any).links;
    const linksStr = linksData
        ? Object.entries(linksData).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(", ")
        : "";

    let msg = `CURRENT RESUME:
${linksStr ? `Links: [${linksStr}] — DO NOT MODIFY THESE\n` : ""}Summary: "${resumeData.summary}"

Experience:
${expLines || "  (none)"}

Skills: [${skillsStr}]

Projects:
${projLines || "  (none)"}

USER REQUEST: "${userRequest}"`;

    if (jobDescription) msg += `\n\nTAILORING TARGET — Match these keywords and requirements:\n${jobDescription.substring(0, 3000)}`;
    return msg;
}

// Try every top-level { ... } block in the response for a valid AriaEdit
function extractAriaEdit(raw: string): AriaEdit | null {
    const text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    let depth = 0, start = -1;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === "{") { if (depth === 0) start = i; depth++; }
        else if (text[i] === "}") {
            depth--;
            if (depth === 0 && start !== -1) {
                try {
                    const candidate = JSON.parse(text.slice(start, i + 1));
                    const validated = validateAriaEdit(candidate);
                    if (validated) return validated;
                } catch { /* try next block */ }
                start = -1;
            }
        }
    }
    return null;
}

export const resumeEditTools: AgentTool[] = [
    {
        name: "edit_resume",
        description: "Apply AI-generated improvements to the user's resume sections",
        parameters: {
            userRequest: "string — what the user wants to change",
            section: "string? — specific section (summary, experience, skills, projects)",
            jobDescription: "string? — target JD for tailoring",
        },
        execute: async (args: any, ctx: AgentContext): Promise<any> => {
            const resumeData = getResumeDataFromContext(ctx);
            if (!resumeData) {
                return { error: "No resume found. Please upload a resume first." };
            }

            const userRequest = args.userRequest || ctx.message || "";
            const context = buildResumeContext(resumeData, userRequest, args.jobDescription);

            try {
                const result = await getAIReply(
                    [{ role: "user", content: context }],
                    "resume_edit"
                );

                let ariaEdit = extractAriaEdit(result.reply);

                if (!ariaEdit) {
                    // Retry once with an explicit JSON-only reminder
                    console.warn("[edit_resume] First attempt returned no valid JSON, retrying...");
                    const retry = await getAIReply(
                        [{ role: "user", content: context + '\n\nIMPORTANT: Return ONLY the JSON. Your response must start with { and end with }. No other text.' }],
                        "resume_edit"
                    );
                    ariaEdit = extractAriaEdit(retry.reply);
                }

                if (ariaEdit) {
                    console.log(`[edit_resume] ✅ Generated ${ariaEdit.changes.length} change(s): ${ariaEdit.description}`);
                    return { aria_edit: ariaEdit, message: ariaEdit.description };
                }

                console.error("[edit_resume] Both attempts failed. Raw:", result.reply.substring(0, 200));
                return { error: "parse_failed", message: "Could not generate structured edits. Please try again." };

            } catch (err: any) {
                console.error("[edit_resume] LLM call failed:", err.message);
                return { error: "llm_failed", message: "Failed to generate resume edits. Please try again." };
            }
        },
    },
];
