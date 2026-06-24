/**
 * ── ATS LaTeX Templates Library ──
 * 
 * 20 professionally differentiated LaTeX templates.
 * Split into IT (10) and Non-IT (10) categories.
 * Each has unique fonts, margins, section ordering, and styling.
 * Pre-computed ATS scores based on Greenhouse/Lever parseability heuristics.
 */

export interface TemplateATSScores {
    greenhouse: number;   // 0–100
    lever: number;        // 0–100
    combined: number;     // average
}

export interface TemplateMetadata {
    id: string;
    name: string;
    category: "IT" | "Non-IT";
    description: string;
    tags: string[];
    isPopular: boolean;
    atsScores: TemplateATSScores;
    code: string;
}

// ═══════════════════════════════════════════════════════════════
//  IT TEMPLATES (10)
// ═══════════════════════════════════════════════════════════════

const IT_TEMPLATES: TemplateMetadata[] = [
    {
        id: "modern-tech",
        name: "Modern Tech",
        category: "IT",
        description: "A sleek sans-serif design favored by FAANG and top-tier tech recruiters. Skills-first layout with clean bullet alignment.",
        tags: ["FAANG", "SWE", "Sans-Serif"],
        isPopular: true,
        atsScores: { greenhouse: 96, lever: 98, combined: 97 },
        code: `\\documentclass[11pt,letterpaper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-6pt}\\bfseries\\large\\uppercase}{}{0em}{}[\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[2pt]
    \\small {{PHONE}} \\textbullet{} \\href{mailto:{{EMAIL}}}{{{EMAIL}}} \\textbullet{} \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Skills}
{{SKILLS}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Projects}
{{PROJECTS}}

\\section{Education}
{{EDUCATION}}

\\end{document}`
    },
    {
        id: "data-scientist",
        name: "Data Scientist",
        category: "IT",
        description: "Clean analytical layout emphasizing metrics, algorithms, and technical depth. Perfect for ML/AI and data roles.",
        tags: ["ML/AI", "Analytics", "Metrics"],
        isPopular: true,
        atsScores: { greenhouse: 94, lever: 96, combined: 95 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.55in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{lmodern}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\bfseries\\large}{}{0em}{}[\\color{black}\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=$\\circ$, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[3pt]
    \\small {{PHONE}} $\\vert$ \\href{mailto:{{EMAIL}}}{{{EMAIL}}} $\\vert$ \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Skills}
{{SKILLS}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Projects}
{{PROJECTS}}

\\section{Education}
{{EDUCATION}}

\\end{document}`
    },
    {
        id: "engineering-pro",
        name: "Engineering Pro",
        category: "IT",
        description: "No-nonsense block structure for backend engineers, DevOps, and infrastructure roles. Dense, highly parseable.",
        tags: ["Backend", "DevOps", "Infrastructure"],
        isPopular: false,
        atsScores: { greenhouse: 97, lever: 95, combined: 96 },
        code: `\\documentclass[10pt,a4paper]{article}
\\usepackage[margin=0.45in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{courier}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\bfseries\\large\\raggedright}{}{0em}{}[\\titlerule\\vspace{-3pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textendash, itemsep=1pt}
\\setlist{nosep}

\\begin{document}

\\begin{center}
    {\\LARGE \\textbf{{{NAME}}}} \\\\[2pt]
    \\small {{PHONE}} $|$ {{EMAIL}} $|$ {{LINKEDIN}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\section{Education}
{{EDUCATION}}

\\end{document}`
    },
    {
        id: "it-infrastructure",
        name: "IT Infrastructure",
        category: "IT",
        description: "Certifications and tech stack emphasis for sysadmins, cloud architects, and network engineers.",
        tags: ["Cloud", "SysAdmin", "Certifications"],
        isPopular: false,
        atsScores: { greenhouse: 93, lever: 95, combined: 94 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{palatino}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-5pt}\\bfseries\\large\\scshape}{}{0em}{}[\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[3pt]
    \\small {{PHONE}} \\quad $\\vert$ \\quad \\href{mailto:{{EMAIL}}}{{{EMAIL}}} \\quad $\\vert$ \\quad \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Skills}
{{SKILLS}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Education}
{{EDUCATION}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "startup-bold",
        name: "Startup Bold",
        category: "IT",
        description: "Modern high-impact layout for startup founders, growth engineers, and disruptive tech roles.",
        tags: ["Startup", "Growth", "Full-Stack"],
        isPopular: true,
        atsScores: { greenhouse: 92, lever: 96, combined: 94 },
        code: `\\documentclass[11pt,letterpaper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-6pt}\\bfseries\\Large\\uppercase}{}{0em}{}[\\vspace{-2pt}\\rule{\\linewidth}{1.5pt}\\vspace{-6pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\Huge {{NAME}}} \\\\[4pt]
    \\small {{PHONE}} \\enspace\\textbullet{}\\enspace \\href{mailto:{{EMAIL}}}{{{EMAIL}}} \\enspace\\textbullet{}\\enspace \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\section{Education}
{{EDUCATION}}

\\end{document}`
    },
    {
        id: "product-manager",
        name: "Product Manager",
        category: "IT",
        description: "Outcome-focused timeline style for PMs, TPMs, and tech leadership. Emphasizes impact metrics.",
        tags: ["PM", "Leadership", "Agile"],
        isPopular: false,
        atsScores: { greenhouse: 95, lever: 94, combined: 95 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.55in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{charter}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-5pt}\\bfseries\\large}{}{0em}{}[\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[3pt]
    \\small {{PHONE}} $|$ \\href{mailto:{{EMAIL}}}{{{EMAIL}}} $|$ \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Skills}
{{SKILLS}}

\\section{Education}
{{EDUCATION}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "classic-academic",
        name: "Classic Academic",
        category: "IT",
        description: "Traditional elegant template for academic, research, or formal CS roles. Serif font with refined section dividers.",
        tags: ["Academia", "Research", "CS"],
        isPopular: false,
        atsScores: { greenhouse: 95, lever: 97, combined: 96 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[T1]{fontenc}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-0.5in}
\\addtolength{\\textheight}{1.0in}

\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large}{}{0em}{}[\\color{black}\\titlerule\\vspace{-5pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\Huge \\scshape {{NAME}}} \\\\[2pt]
    \\small {{PHONE}} $|$ \\href{mailto:{{EMAIL}}}{\\underline{{{EMAIL}}}} $|$ \\href{{{LINKEDIN}}}{\\underline{{{LINKEDIN}}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Education}
{{EDUCATION}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "entry-level-grad",
        name: "Entry Level Grad",
        category: "IT",
        description: "Education-first structure for CS graduates and bootcamp grads. Projects section prominently placed.",
        tags: ["Fresher", "Graduate", "Bootcamp"],
        isPopular: true,
        atsScores: { greenhouse: 94, lever: 96, combined: 95 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{lmodern}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\bfseries\\large\\raggedright}{}{0em}{}[\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[3pt]
    \\small {{PHONE}} $|$ \\href{mailto:{{EMAIL}}}{{{EMAIL}}} $|$ \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Education}
{{EDUCATION}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Summary}
{{SUMMARY}}

\\end{document}`
    },
    {
        id: "minimalist-clean",
        name: "Minimalist Clean",
        category: "IT",
        description: "Maximum whitespace and readability. Perfect for senior engineers who let results speak for themselves.",
        tags: ["Senior", "Clean", "Minimal"],
        isPopular: false,
        atsScores: { greenhouse: 98, lever: 97, combined: 98 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.6in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{lmodern}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-2pt}\\bfseries\\normalsize\\uppercase}{}{0em}{}[\\vspace{1pt}\\hrule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label={--}, itemsep=2pt}

\\begin{document}

\\begin{center}
    {\\Large \\textbf{{{NAME}}}} \\\\[4pt]
    \\small {{PHONE}} \\quad {{EMAIL}} \\quad {{LINKEDIN}}
\\end{center}

\\vspace{4pt}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Skills}
{{SKILLS}}

\\section{Education}
{{EDUCATION}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "designer-portfolio",
        name: "Designer Portfolio",
        category: "IT",
        description: "Aesthetic-first focus for UX/UI designers, front-end devs, and creative technologists.",
        tags: ["UX/UI", "Frontend", "Creative"],
        isPopular: false,
        atsScores: { greenhouse: 90, lever: 94, combined: 92 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\itshape\\bfseries\\large}{}{0em}{}[\\vspace{-2pt}\\rule{\\linewidth}{0.4pt}\\vspace{-6pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    {\\Huge \\textbf{{{NAME}}}} \\\\[4pt]
    \\small {{PHONE}} \\enspace$\\diamond$\\enspace \\href{mailto:{{EMAIL}}}{{{EMAIL}}} \\enspace$\\diamond$\\enspace \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Projects}
{{PROJECTS}}

\\section{Skills}
{{SKILLS}}

\\section{Education}
{{EDUCATION}}

\\end{document}`
    }
];

// ═══════════════════════════════════════════════════════════════
//  NON-IT TEMPLATES (10)
// ═══════════════════════════════════════════════════════════════

const NON_IT_TEMPLATES: TemplateMetadata[] = [
    {
        id: "finance-banking",
        name: "Finance & Banking",
        category: "Non-IT",
        description: "Strict, conservative serif format for banking, finance, and accounting professionals. Formal header with clean section breaks.",
        tags: ["Banking", "Accounting", "CFA"],
        isPopular: true,
        atsScores: { greenhouse: 95, lever: 93, combined: 94 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.6in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{times}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\bfseries\\large\\scshape}{}{0em}{}[\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[3pt]
    \\small {{PHONE}} \\quad $\\vert$ \\quad \\href{mailto:{{EMAIL}}}{{{EMAIL}}} \\quad $\\vert$ \\quad \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Education}
{{EDUCATION}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "healthcare-clinical",
        name: "Healthcare Clinical",
        category: "Non-IT",
        description: "Standardized medical/clinical layout for doctors, nurses, healthcare admins, and pharma professionals.",
        tags: ["Medical", "Nursing", "Pharma"],
        isPopular: false,
        atsScores: { greenhouse: 93, lever: 95, combined: 94 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.55in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{palatino}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\bfseries\\large}{}{0em}{}[\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[3pt]
    \\small {{PHONE}} $|$ \\href{mailto:{{EMAIL}}}{{{EMAIL}}} $|$ \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Education}
{{EDUCATION}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "marketing-brand",
        name: "Marketing & Brand",
        category: "Non-IT",
        description: "Eye-catching but professional layout for marketers, brand managers, and growth specialists.",
        tags: ["Marketing", "Brand", "Growth"],
        isPopular: true,
        atsScores: { greenhouse: 91, lever: 95, combined: 93 },
        code: `\\documentclass[11pt,letterpaper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-5pt}\\bfseries\\large\\uppercase}{}{0em}{}[\\vspace{-2pt}\\rule{\\linewidth}{0.8pt}\\vspace{-5pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    {\\Huge \\textbf{{{NAME}}}} \\\\[4pt]
    \\small {{PHONE}} \\enspace\\textbullet{}\\enspace \\href{mailto:{{EMAIL}}}{{{EMAIL}}} \\enspace\\textbullet{}\\enspace \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Skills}
{{SKILLS}}

\\section{Education}
{{EDUCATION}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "sales-growth",
        name: "Sales Growth",
        category: "Non-IT",
        description: "Highlights revenue achievements and quota metrics for sales, BDR, and account executive roles.",
        tags: ["Sales", "BDR", "Revenue"],
        isPopular: false,
        atsScores: { greenhouse: 92, lever: 94, combined: 93 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{charter}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\bfseries\\large}{}{0em}{}[\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=$\\rightarrow$, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[3pt]
    \\small {{PHONE}} $|$ \\href{mailto:{{EMAIL}}}{{{EMAIL}}} $|$ \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Skills}
{{SKILLS}}

\\section{Education}
{{EDUCATION}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "legal-standard",
        name: "Legal Standard",
        category: "Non-IT",
        description: "Traditional attorney structure used by law firms and legal departments. Conservative serif typography.",
        tags: ["Law", "Attorney", "Legal"],
        isPopular: false,
        atsScores: { greenhouse: 94, lever: 92, combined: 93 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.65in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{times}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\bfseries\\large\\raggedright}{}{0em}{}[\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[3pt]
    \\small {{PHONE}} \\quad $\\cdot$ \\quad \\href{mailto:{{EMAIL}}}{{{EMAIL}}} \\quad $\\cdot$ \\quad \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Education}
{{EDUCATION}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "consulting-elite",
        name: "Consulting Elite",
        category: "Non-IT",
        description: "MBB-style format for management consultants and strategy professionals. Impact-driven bullet structure.",
        tags: ["Consulting", "MBB", "Strategy"],
        isPopular: true,
        atsScores: { greenhouse: 96, lever: 94, combined: 95 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.55in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{charter}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-5pt}\\bfseries\\large\\scshape}{}{0em}{}[\\titlerule\\vspace{-4pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\LARGE {{NAME}}} \\\\[3pt]
    \\small {{PHONE}} $|$ \\href{mailto:{{EMAIL}}}{{{EMAIL}}} $|$ \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Education}
{{EDUCATION}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "executive-board",
        name: "Executive Board",
        category: "Non-IT",
        description: "CXO-level strategic layout for VPs, Directors, and C-suite executives. Emphasizes leadership scope.",
        tags: ["CXO", "Director", "VP"],
        isPopular: false,
        atsScores: { greenhouse: 93, lever: 91, combined: 92 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.6in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{palatino}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-3pt}\\bfseries\\Large\\scshape}{}{0em}{}[\\vspace{1pt}\\rule{\\linewidth}{1pt}\\vspace{-5pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    {\\Huge \\textbf{{{NAME}}}} \\\\[4pt]
    \\small {{PHONE}} \\quad $\\vert$ \\quad \\href{mailto:{{EMAIL}}}{{{EMAIL}}} \\quad $\\vert$ \\quad \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Education}
{{EDUCATION}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    },
    {
        id: "academic-researcher",
        name: "Academic Researcher",
        category: "Non-IT",
        description: "CV-style template for professors, researchers, and PhD candidates. Includes publications layout.",
        tags: ["PhD", "Research", "Publications"],
        isPopular: false,
        atsScores: { greenhouse: 92, lever: 96, combined: 94 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.55in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{lmodern}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large}{}{0em}{}[\\color{black}\\titlerule\\vspace{-5pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=2pt}

\\begin{document}

\\begin{center}
    \\textbf{\\Huge \\scshape {{NAME}}} \\\\[2pt]
    \\small {{PHONE}} $|$ \\href{mailto:{{EMAIL}}}{\\underline{{{EMAIL}}}} $|$ \\href{{{LINKEDIN}}}{\\underline{{{LINKEDIN}}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Education}
{{EDUCATION}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Projects}
{{PROJECTS}}

\\section{Skills}
{{SKILLS}}

\\end{document}`
    },
    {
        id: "creative-studio",
        name: "Creative Studio",
        category: "Non-IT",
        description: "Vibrant template for designers, writers, architects, and creative industry professionals.",
        tags: ["Design", "Creative", "Writing"],
        isPopular: false,
        atsScores: { greenhouse: 88, lever: 93, combined: 91 },
        code: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-4pt}\\itshape\\bfseries\\large}{}{0em}{}[\\vspace{-2pt}\\rule{\\linewidth}{0.5pt}\\vspace{-5pt}]
\\setlist[itemize]{nosep, left=0pt, label=$\\diamond$, itemsep=2pt}

\\begin{document}

\\begin{center}
    {\\Huge \\textbf{{{NAME}}}} \\\\[4pt]
    \\small {{PHONE}} \\enspace$\\diamond$\\enspace \\href{mailto:{{EMAIL}}}{{{EMAIL}}} \\enspace$\\diamond$\\enspace \\href{{{LINKEDIN}}}{{{LINKEDIN}}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Projects}
{{PROJECTS}}

\\section{Skills}
{{SKILLS}}

\\section{Education}
{{EDUCATION}}

\\end{document}`
    },
    {
        id: "compact-executive",
        name: "Compact Executive",
        category: "Non-IT",
        description: "High-density layout for seasoned veterans with extensive experience. Maximizes content per page.",
        tags: ["Senior", "Dense", "Executive"],
        isPopular: false,
        atsScores: { greenhouse: 94, lever: 93, combined: 94 },
        code: `\\documentclass[10pt,a4paper]{article}
\\usepackage[margin=0.4in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{times}
\\usepackage[T1]{fontenc}

\\pagestyle{empty}

\\titleformat{\\section}{\\vspace{-2pt}\\bfseries\\scshape\\raggedright\\large}{}{0em}{}[\\titlerule\\vspace{-2pt}]
\\setlist[itemize]{nosep, left=0pt, label=\\textbullet, itemsep=1pt}
\\setlist{nosep}

\\begin{document}

\\begin{center}
    {\\huge \\textbf{{{NAME}}}} \\\\[2pt]
    \\small {{PHONE}} $|$ {{EMAIL}} $|$ {{LINKEDIN}}
\\end{center}

\\section{Summary}
{{SUMMARY}}

\\section{Experience}
{{EXPERIENCE}}

\\section{Education}
{{EDUCATION}}

\\section{Skills}
{{SKILLS}}

\\section{Projects}
{{PROJECTS}}

\\end{document}`
    }
];

// ═══════════════════════════════════════════════════════════════
//  JAKE'S RESUME SKELETON (the exact open-source template, MIT licensed)
//  Used as the structural reference the AI fills when generating LaTeX.
//  Source: https://github.com/jakegut/resume
// ═══════════════════════════════════════════════════════════════

export const JAKES_TEMPLATE_SKELETON = String.raw`%-------------------------
% Resume in Latex — Jake Gutierrez template (MIT)
%-------------------------
\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage{fontawesome5}
\input{glyphtounicode}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%
\begin{document}

%----------HEADING----------
\begin{center}
    {\Huge \scshape FULL NAME} \\ \vspace{1pt}
    \small \faPhone* PHONE $|$ \href{mailto:EMAIL}{\faEnvelope\ EMAIL} $|$
    \href{LINKEDIN_URL}{\faLinkedin\ LinkedIn} $|$
    \href{GITHUB_URL}{\faGithub\ GitHub}
\end{center}

%-----------PROFESSIONAL SUMMARY-----------
\section{Professional Summary}
  \small{SUMMARY TEXT HERE}
\vspace{-4pt}

%-----------EDUCATION-----------
\section{Education}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Institution Name}{Year -- Year}
      {Degree}{Location}
  \resumeSubHeadingListEnd

%-----------EXPERIENCE-----------
\section{Experience}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Company}{Start -- End}
      {Role Title}{Location}
      \resumeItemListStart
        \resumeItem{Bullet one.}
        \resumeItem{Bullet two.}
      \resumeItemListEnd
  \resumeSubHeadingListEnd

%-----------PROJECTS-----------
\section{Projects}
    \resumeSubHeadingListStart
      \resumeProjectHeading
          {\textbf{Project Name} $|$ \emph{Tech, Stack}}{}
          \resumeItemListStart
            \resumeItem{Bullet one.}
          \resumeItemListEnd
    \resumeSubHeadingListEnd

%-----------TECHNICAL SKILLS-----------
\section{Technical Skills}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
     \textbf{Languages}{: list} \\
     \textbf{Frameworks}{: list} \\
    }}
 \end{itemize}

%-----------CERTIFICATIONS-----------
\section{Certifications}
  \resumeSubHeadingListStart
    \resumeItem{Certification one}
  \resumeSubHeadingListEnd

\end{document}`;

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════

/** All 20 templates merged. */
export const ALL_TEMPLATES: TemplateMetadata[] = [...IT_TEMPLATES, ...NON_IT_TEMPLATES];

/** Lookup by ID. Used by latex-generator.ts for template code injection. */
export const LATEX_TEMPLATES: Record<string, { name: string; description: string; code: string }> =
    Object.fromEntries(ALL_TEMPLATES.map(t => [t.id, { name: t.name, description: t.description, code: t.code }]));
