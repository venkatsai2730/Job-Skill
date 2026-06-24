import { ParsedSections } from "./advanced-scorer.js";
import { LATEX_TEMPLATES } from "./latex-templates.js";

/**
 * ── LATEX GENERATOR ──
 * Injects ATS-optimized ParsedSections data into high-quality LaTeX templates.
 */

export function generateLatex(sections: ParsedSections, templateId: string = "classic-academic", userInfo: any = {}): string {
    const templateObj = LATEX_TEMPLATES[templateId] || LATEX_TEMPLATES["classic-academic"];
    let tex = templateObj.code;

    // 1. Personal Info
    tex = tex.replace(/\{\{NAME\}\}/g, escapeLatex(userInfo.name || (sections as any).name || "YOUR NAME"));
    tex = tex.replace(/\{\{PHONE\}\}/g, escapeLatex(userInfo.phone || (sections as any).phone || "(123) 456-7890"));
    tex = tex.replace(/\{\{EMAIL\}\}/g, escapeLatex(userInfo.email || (sections as any).email || "email@example.com"));

    // Inject URLs from sections.links if available, fall back to userInfo
    const sLinks = (sections as any).links || {};
    const linkedinUrl = sLinks.linkedin || userInfo.linkedin || "";
    const githubUrl   = sLinks.github   || userInfo.github   || "";
    const portfolioUrl = sLinks.portfolio || userInfo.portfolio || "";
    tex = tex.replace(/\{\{LINKEDIN\}\}/g, escapeLatexUrl(linkedinUrl));
    tex = tex.replace(/\{\{GITHUB\}\}/g,   escapeLatexUrl(githubUrl));
    tex = tex.replace(/\{\{PORTFOLIO\}\}/g, escapeLatexUrl(portfolioUrl));

    // 2. Summary
    tex = tex.replace(/\{\{SUMMARY\}\}/g, escapeLatex(sections.summary || ""));

    // 3. Experience (Bulleted List)
    const expTex = sections.experience.map(exp => {
        let block = `\\noindent\n\\textbf{${escapeLatex(exp.title)}} $|$ \\textit{${escapeLatex(exp.company)}} \\hfill ${escapeLatex(exp.dates)}\\\\`;
        if (exp.bullets && exp.bullets.length > 0) {
            block += `\n\\vspace{-2pt}\n\\begin{itemize}\n\\setlength{\\itemsep}{1pt}\n\\setlength{\\parskip}{0pt}\n`;
            exp.bullets.forEach(b => {
                block += `    \\item ${escapeLatex(b)}\n`;
            });
            block += `\\end{itemize}\n\\vspace{2pt}`;
        } else {
            block += `\n\\vspace{4pt}`;
        }
        return block;
    }).join("\n");
    tex = tex.replace(/\{\{EXPERIENCE\}\}/g, expTex);

    // 4. Education
    const eduTex = sections.education.map(edu => {
        let block = `\\noindent\n\\textbf{${escapeLatex(edu.degree)}} $|$ \\textit{${escapeLatex(edu.school)}} \\hfill ${escapeLatex(edu.dates)}\\\\`;
        if (edu.gpa) block += `\nGPA: ${escapeLatex(edu.gpa)}\\\\`;
        if (edu.courses && edu.courses.length > 0) {
            block += `\nRelevant Coursework: ${escapeLatex(edu.courses.join(", "))}\n\\vspace{4pt}`;
        } else {
            block += `\n\\vspace{4pt}`;
        }
        return block;
    }).join("\n");
    tex = tex.replace(/\{\{EDUCATION\}\}/g, eduTex);

    // 5. Skills
    const skillsTex = sections.skills.map(skill => {
        return `\\noindent\n\\textbf{${escapeLatex(skill.category)}:} ${escapeLatex(skill.items.join(", "))}\n\\vspace{2pt}`;
    }).join("\n");
    tex = tex.replace(/\{\{SKILLS\}\}/g, skillsTex);

    // 6. Projects
    const projTex = sections.projects.map((proj: any) => {
        const urlPart = proj.url ? ` \\href{${escapeLatexUrl(proj.url)}}{\\underline{Link}}` : "";
        let block = `\\noindent\n\\textbf{${escapeLatex(proj.name)}}${urlPart} \\hfill ${proj.dates ? escapeLatex(proj.dates) : ""}\\\\`;
        if (proj.description) {
            block += `\n\\vspace{-2pt}\n\\begin{itemize}\n\\setlength{\\itemsep}{1pt}\n\\setlength{\\parskip}{0pt}\n`;
            block += `    \\item ${escapeLatex(proj.description)}\n`;
            block += `\\end{itemize}\n\\vspace{2pt}`;
        } else {
            block += `\n\\vspace{4pt}`;
        }
        return block;
    }).join("\n");
    tex = tex.replace(/\{\{PROJECTS\}\}/g, projTex);

    return tex;
}

// URL-safe escaper for use inside \href{URL}{...} — only escapes chars that break LaTeX URL parsing
function escapeLatexUrl(url: string): string {
    if (!url) return "";
    return url.replace(/%/g, "\\%").replace(/#/g, "\\#");
}

// Helper to prevent LaTeX compilation errors from special characters
function escapeLatex(str: string): string {
    if (!str) return "";
    return str
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\$/g, '\\$')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}
