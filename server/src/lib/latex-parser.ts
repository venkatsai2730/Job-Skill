import { ParsedSections } from "./advanced-scorer.js";

/**
 * ── LATEX PARSER ──
 * Extracts sections and bullet points from standard ATS LaTeX templates.
 */

export function parseLatex(latexStr: string): ParsedSections {
    const sections: ParsedSections = {
        summary: "",
        experience: [],
        education: [],
        skills: [],
        projects: []
    };

    // Remove comments
    let text = latexStr.replace(/%.*$/gm, '');

    // 1. Extract Summary
    const summaryMatch = text.match(/\\section{[*]?\s*(?:SUMMARY|PROFILE|OBJECTIVE)\s*}[\s\S]*?(?=\\section{|\\end{document})/i);
    if (summaryMatch) {
        sections.summary = cleanLatexTags(summaryMatch[0].replace(/\\section{.*?}/i, '')).trim();
    }

    // 2. Extract Skills
    const skillsMatch = text.match(/\\section{[*]?\s*(?:SKILLS|TECHNOLOGIES|TECHNICAL SKILLS)\s*}[\s\S]*?(?=\\section{|\\end{document})/i);
    if (skillsMatch) {
        const skillsText = cleanLatexTags(skillsMatch[0].replace(/\\section{.*?}/i, ''));
        // Basic split by newlines or commas
        const items = skillsText.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 1);
         if(items.length > 0) {
            sections.skills.push({ category: "Technical Skills", items });
         }
    }

    // 3. Extract Experience blocks (looking for \textbf and \item)
    const expMatch = text.match(/\\section{[*]?\s*(?:EXPERIENCE|EMPLOYMENT|WORK HISTORY)\s*}[\s\S]*?(?=\\section{|\\end{document})/i);
    if (expMatch) {
       const expSection = expMatch[0].replace(/\\section{.*?}/i, '');
       // A very rough heuristic: split by \noindent or \textbf to find companies
       // For a robust system, we would parse the AST, but Regex works for 90% of ATS templates.
       const roles = expSection.split(/(?=\\textbf{.*?}|\\resumeSubheading|\\begin{itemize})/);
       
       let currentRole = { title: "", company: "", dates: "", bullets: [] as string[] };
       
       for(const chunk of roles) {
           if(chunk.includes('\\item')) {
               // Extract bullets
               const bullets = chunk.match(/\\item\s+(.*?)(?=\\item|\\end{itemize}|$)/gs);
               if(bullets) {
                   currentRole.bullets.push(...bullets.map(b => cleanLatexTags(b.replace('\\item', '').trim())));
               }
           } else {
               // Extract title/company roughly
               const strongMatch = chunk.match(/\\textbf{(.*?)}/);
               if(strongMatch && !currentRole.company) {
                   currentRole.company = strongMatch[1];
               } else if (strongMatch && currentRole.company) {
                   currentRole.title = strongMatch[1];
               }
               
               const dateMatch = chunk.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\w\s,]*\d{4}/i);
               if(dateMatch) currentRole.dates = dateMatch[0];
           }

           if(currentRole.company && currentRole.bullets.length > 0) {
               sections.experience.push({ ...currentRole });
               currentRole = { title: "", company: "", dates: "", bullets: [] };
           }
       }
    }

    // We do similar rough regex for Education/Projects but omitted for brevity in this mock parser.
    return sections;
}

function cleanLatexTags(str: string): string {
    return str
        .replace(/\\(?:textbf|textit|underline|href|small|normalsize|large|Huge|scshape){(.*?)}/g, '$1')
        .replace(/\\[a-zA-Z]+/g, '') // remove remaining commands
        .replace(/[{}]/g, '') // remove stray braces
        .replace(/\s+/g, ' ')
        .trim();
}
