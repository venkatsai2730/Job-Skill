# JobSkill AI — Chrome Extension (Manifest V3)

AI-powered job application autofill and 1-click tracking for Greenhouse, Lever, Workday, Ashby, LinkedIn, Indeed, and more.

---

## 🚀 How to Install in Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left.
4. Select the `extension/` folder inside this project:
   `c:\Users\21bec\OneDrive\Desktop\Job_skill_dark\extension`
5. The **JobSkill AI — Autofill & 1-Click Job Copilot** extension is now installed and active!

---

## ⚡ Features

1. **Auto-Detects ATS Job Application Forms:**
   - Greenhouse (`boards.greenhouse.io`)
   - Lever (`jobs.lever.co`)
   - Workday (`myworkdayjobs.com`)
   - Ashby (`jobs.ashbyhq.com`)
   - LinkedIn Jobs & Easy Apply
   - Generic standard career forms

2. **Smart 1-Click Autofill:**
   - Detects and populates name, email, phone, location, LinkedIn, GitHub, portfolio URL.
   - Answers compliance questions (work authorization, visa sponsorship, notice period).
   - Fires synthetic framework events (`input`, `change`, `blur`) so React/Angular/Vue ATS systems recognize the filled state.

3. **1-Click Job Clipper:**
   - Injects a floating **JobSkill Copilot** widget on ATS pages.
   - Click **Track** to save the job posting directly to your Kanban pipeline board.

4. **AI ATS Assistant in Popup:**
   - Paste custom application questions (e.g. *"Why do you want to work at Stripe?"*) to generate tailored answers on the fly.
