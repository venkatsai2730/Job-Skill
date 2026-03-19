import fs from "fs";

let code = fs.readFileSync('c:/Users/SRINU/OneDrive/Desktop/Job-Skill/server/src/services/chatService.ts', 'utf8');

code = code.replace(
    /\|\s*"resume_rewrite";/,
    `| "resume_rewrite"\n    | "resume_builder";`
);

code = code.replace(
    /\]\r?\n\s*\}\r?\n\`,\r?\n\};/,
    `]
  }
\`,
    resume_builder: \`You are an elite ATS Resume Writer. Your task is to generate a fully optimized, professional resume in plain text based on the user's raw information and their chosen template style.

REQUIREMENTS:
1. ONLY return the generated resume text. No markdown fences, no conversational filler.
2. Structure exactly with these headers (all caps) so our parser works:
   - SUMMARY
   - WORK EXPERIENCE
   - EDUCATION
   - SKILLS
   - PROJECTS
3. For Work Experience and Projects, generate strong, STAR-method bullet points containing quantified metrics (%, $, numbers) based on the raw user data.
4. Adapt the tone and focus to the provided "template type" (e.g. emphasize leadership for Executive, emphasize education/projects for Fresher).
5. Add relevant industry keywords that the user might have missed but are logically implied by their experience.
\`,
};`
);

code = code.replace(
    /resume_rewrite:\s*\{\s*provider:\s*"groq",\s*model:\s*MODELS\.maverick\s*\},\r?\n\};/,
    `resume_rewrite: { provider: "groq", model: MODELS.maverick },
    resume_builder: { provider: "gemini", model: MODELS.gemini },
};`
);

fs.writeFileSync('c:/Users/SRINU/OneDrive/Desktop/Job-Skill/server/src/services/chatService.ts', code);
console.log("TypeScript file successfully patched!");
