/**
 * faithful-latex — build a COMPLETE standalone LaTeX document whose typography is
 * parameterized by the StyleProfile mined from the user's original PDF. Compiling
 * it (pdflatex, via latex-compile.ts) yields a crisp *vector* PDF (selectable
 * text) that echoes the original's font family, sizes, colors and heading style —
 * unlike the html2canvas raster fallback.
 *
 * Scope: single-column only. Two-column sidebar layouts are intentionally not
 * reproduced here (fragile in LaTeX); callers should fall back to the DOM/raster
 * export for those. Everything is self-contained — it does NOT depend on the
 * repo's LATEX_TEMPLATES.
 */

import type { ParsedSections } from "./advanced-scorer.js";
import type { StyleProfile } from "./resumeStyleProfile.js";

interface UserInfo {
  name?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export function generateFaithfulLatex(sections: ParsedSections, profile: StyleProfile, userInfo: UserInfo = {}): string {
  const p = profile;
  const s = sections as any;

  const bodyPt = clamp(p.sizes.body, 9, 12);
  const namePt = clamp(p.sizes.name, 14, 30);
  const headPt = clamp(p.sizes.sectionHeading, bodyPt + 1, 18);
  const marginIn = clamp(p.page.marginLeft / 72, 0.5, 1.0);
  const upper = p.sectionHeadingStyle.uppercase;

  const fontPkg =
    p.fonts.bodyFamily === "sans-serif"
      ? "\\usepackage{helvet}\n\\renewcommand{\\familydefault}{\\sfdefault}"
      : p.fonts.bodyFamily === "monospace"
        ? "\\usepackage[T1]{fontenc}\n\\renewcommand{\\familydefault}{\\ttdefault}"
        : "\\usepackage{lmodern}"; // serif

  const name = escapeLatex(userInfo.name || s.name || "Your Name");
  const nameBold = p.weights.nameBold ? "\\bfseries" : "";
  const headBold = p.weights.headingBold ? "\\bfseries" : "";

  // Contact line
  const contactBits: string[] = [];
  if (s.location) contactBits.push(escapeLatex(s.location));
  if (s.phone) contactBits.push(escapeLatex(s.phone));
  if (s.email) contactBits.push(`\\href{mailto:${escapeUrl(s.email)}}{${escapeLatex(s.email)}}`);
  const links = s.links || {};
  const link = (url: string, label: string) => (url ? `\\href{${escapeUrl(url)}}{${label}}` : "");
  if (links.linkedin || userInfo.linkedin) contactBits.push(link(links.linkedin || userInfo.linkedin, "LinkedIn"));
  if (links.github || userInfo.github) contactBits.push(link(links.github || userInfo.github, "GitHub"));
  if (links.portfolio || userInfo.portfolio) contactBits.push(link(links.portfolio || userInfo.portfolio, "Portfolio"));
  const contactLine = contactBits.filter(Boolean).join(" \\quad ");

  const sec = (title: string) => `\\section*{${escapeLatex(upper ? title.toUpperCase() : title)}}`;

  const parts: string[] = [];

  if (s.summary) parts.push(`${sec("Professional Summary")}\n${escapeLatex(s.summary)}`);

  if (Array.isArray(s.skills) && s.skills.length) {
    const body = s.skills
      .map((g: any) =>
        g.category && g.category !== "General"
          ? `\\textbf{${escapeLatex(g.category)}:} ${escapeLatex((g.items || []).join(", "))}`
          : escapeLatex((g.items || []).join(", ")),
      )
      .join(" \\\\\n");
    parts.push(`${sec("Skills")}\n${body}`);
  }

  if (Array.isArray(s.experience) && s.experience.length) {
    const body = s.experience
      .map((e: any) => {
        const head = `\\textbf{${escapeLatex([e.title, e.company].filter(Boolean).join(" | "))}} \\hfill ${escapeLatex(e.dates || "")}`;
        const bullets = (e.bullets || []).length ? itemize(e.bullets) : "";
        return `${head}\\\\\n${bullets}`;
      })
      .join("\n\\vspace{3pt}\n");
    parts.push(`${sec("Experience")}\n${body}`);
  }

  if (Array.isArray(s.projects) && s.projects.length) {
    const body = s.projects
      .map((pr: any) => {
        const linkPart = pr.url ? ` \\href{${escapeUrl(pr.url)}}{\\underline{Link}}` : "";
        const tech = (pr.tech || []).length ? ` \\hfill \\textit{${escapeLatex(pr.tech.join(", "))}}` : "";
        const head = `\\textbf{${escapeLatex(pr.name)}}${linkPart}${tech}`;
        const bl = (pr as any).bullets && (pr as any).bullets.length ? (pr as any).bullets : pr.description ? [pr.description] : [];
        return `${head}\\\\\n${bl.length ? itemize(bl) : ""}`;
      })
      .join("\n\\vspace{3pt}\n");
    parts.push(`${sec("Projects")}\n${body}`);
  }

  if (Array.isArray(s.education) && s.education.length) {
    const body = s.education
      .map((ed: any) => {
        let block = `\\textbf{${escapeLatex(ed.degree)}} \\hfill ${escapeLatex(ed.dates || "")}\\\\`;
        if (ed.school) block += `\n\\textit{${escapeLatex(ed.school)}}`;
        if (ed.gpa) block += ` \\hfill Score: ${escapeLatex(ed.gpa)}`;
        if ((ed.courses || []).length) block += `\\\\\nRelevant coursework: ${escapeLatex(ed.courses.join(", "))}`;
        return block;
      })
      .join("\n\\vspace{3pt}\n");
    parts.push(`${sec("Education")}\n${body}`);
  }

  if (Array.isArray(s.certifications) && s.certifications.length) {
    parts.push(`${sec("Certifications")}\n${itemize(s.certifications.map((c: any) => c.text))}`);
  }

  return `\\documentclass[${Math.round(bodyPt)}pt]{article}
\\usepackage[a4paper,margin=${marginIn.toFixed(2)}in]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
${fontPkg}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}
\\definecolor{namecol}{HTML}{${hex(p.colors.name)}}
\\definecolor{headcol}{HTML}{${hex(p.colors.sectionHeading)}}
\\definecolor{bodycol}{HTML}{${hex(p.colors.body)}}
\\titleformat{\\section}{\\color{headcol}${headBold}\\fontsize{${round(headPt)}}{${round(headPt * 1.15)}}\\selectfont}{}{0em}{}[{\\color{headcol}\\titlerule}]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}
\\setlist[itemize]{leftmargin=1.3em,itemsep=1pt,topsep=1pt,parsep=0pt}
\\setlength{\\parindent}{0pt}
\\pagestyle{empty}
\\color{bodycol}
\\begin{document}
\\begin{center}
{\\color{namecol}${nameBold}\\fontsize{${round(namePt)}}{${round(namePt * 1.1)}}\\selectfont ${name}}\\\\[2pt]
{\\small ${contactLine}}
\\end{center}
\\vspace{4pt}

${parts.join("\n\n\\vspace{2pt}\n\n")}

\\end{document}
`;
}

function itemize(bullets: string[]): string {
  const items = bullets.filter(Boolean).map((b) => `  \\item ${escapeLatex(b)}`).join("\n");
  return `\\begin{itemize}\n${items}\n\\end{itemize}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

function hex(c?: string): string {
  return c && /^#?[0-9a-fA-F]{6}$/.test(c) ? c.replace("#", "").toUpperCase() : "222222";
}

function escapeUrl(url: string): string {
  return (url || "").replace(/%/g, "\\%").replace(/#/g, "\\#");
}

function escapeLatex(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\$/g, "\\$")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}
