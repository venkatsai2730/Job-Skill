import { Router, Response } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { getAIReply } from "../services/chatService.js";
import { logActivity } from "../services/activityService.js";

const router = Router();
router.use(authenticateToken);

// ── GET /api/autofill/profile ── Get aggregated profile data for form filling
router.get("/profile", async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        // Fetch user profile and active resume in parallel
        const [profileRes, resumeRes] = await Promise.all([
            supabaseAdmin.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
            supabaseAdmin.from("resumes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        ]);

        const profile = profileRes.data || {};
        const resume = resumeRes.data;
        const parsed = (resume?.parsed_data as any) || {};
        const sections = parsed.sections || {};
        const personal = parsed.personal || {};

        // Parse first & last name
        const rawName = personal.fullName || profile.display_name || profile.full_name || "Applicant";
        const nameParts = rawName.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        // Parse location
        const rawLocation = personal.location || profile.location || "";
        const locParts = rawLocation.split(",").map((s: string) => s.trim());
        const city = locParts[0] || "";
        const state = locParts[1] || "";
        const country = locParts[2] || "United States";

        // Normalise experiences
        const rawExp = parsed.experience || sections.experience || [];
        const workExperience = (Array.isArray(rawExp) ? rawExp : []).map((exp: any) => ({
            company: exp.company || exp.organization || "",
            title: exp.title || exp.role || exp.position || "",
            location: exp.location || "",
            startDate: exp.startDate || exp.dates?.split("-")?.[0]?.trim() || "",
            endDate: exp.endDate || exp.dates?.split("-")?.[1]?.trim() || "Present",
            isCurrent: /present|current/i.test(exp.endDate || exp.dates || ""),
            bullets: exp.bullets || (exp.description ? [exp.description] : []),
            description: (exp.bullets ? exp.bullets.join("\n") : exp.description) || "",
        }));

        // Normalise education
        const rawEdu = parsed.education || sections.education || [];
        const education = (Array.isArray(rawEdu) ? rawEdu : []).map((edu: any) => ({
            school: edu.school || edu.institution || edu.university || "",
            degree: edu.degree || "Bachelor of Science",
            fieldOfStudy: edu.fieldOfStudy || edu.major || "Computer Science",
            graduationYear: edu.graduationYear || edu.dates?.match(/\b(20\d\d)\b/)?.[0] || "",
            gpa: edu.gpa || "",
            location: edu.location || "",
        }));

        // Normalise skills
        let skills: string[] = [];
        if (Array.isArray(parsed.skills)) {
            skills = parsed.skills.flatMap((s: any) => typeof s === "string" ? s : (s.items || []));
        } else if (Array.isArray(sections.skills)) {
            skills = sections.skills.flatMap((s: any) => typeof s === "string" ? s : (s.items || []));
        }

        const autofillData = {
            contact: {
                firstName,
                lastName,
                fullName: rawName,
                email: personal.email || profile.email || req.user?.email || "",
                phone: personal.phone || profile.phone || "",
                address: personal.address || "",
                city,
                state,
                country,
                zipCode: personal.zipCode || personal.postalCode || "",
                linkedinUrl: personal.linkedin || profile.linkedin_url || "",
                githubUrl: personal.github || profile.github_url || "",
                portfolioUrl: personal.website || personal.portfolio || profile.portfolio_url || "",
            },
            workExperience,
            education,
            skills: Array.from(new Set(skills)),
            disclosures: {
                authorizedToWorkInCountry: "Yes",
                requiresSponsorship: "No",
                noticePeriod: "2 weeks",
                willingToRelocate: "Yes",
                gender: "Decline to Self-Identify",
                veteranStatus: "I am not a protected veteran",
                disabilityStatus: "I do not have a disability",
                desiredSalary: "$120,000",
            },
            activeResumeId: resume?.id || null,
            atsScore: resume?.ats_score || null,
        };

        res.json({ success: true, profile: autofillData });
    } catch (err: any) {
        console.error("Autofill profile fetch error:", err);
        res.status(500).json({ error: "Failed to assemble autofill profile" });
    }
});

// ── POST /api/autofill/tailor-for-job ── Generate custom answer / statement
router.post("/tailor-for-job", async (req: AuthRequest, res: Response) => {
    try {
        const { jobTitle, company, questionText, jobDescription } = req.body;

        if (!questionText && !jobDescription) {
            res.status(400).json({ error: "questionText or jobDescription is required" });
            return;
        }

        // Get user resume summary
        const { data: resume } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", req.user!.userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const resumeContext = resume?.parsed_data ? JSON.stringify(resume.parsed_data).slice(0, 2000) : "Experienced software professional with full-stack engineering background.";

        const prompt = questionText
            ? `You are an expert career coach helping a candidate fill out an ATS job application form.
Company: ${company || "Target Company"}
Role: ${jobTitle || "Target Position"}
Application Question: "${questionText}"
Candidate Background: ${resumeContext}

Draft a direct, compelling, professional answer tailored specifically to this question and company.
Keep it between 75 and 150 words. Do not use filler or placeholders. Answer in first-person ('I'). Return ONLY the answer text.`
            : `Draft a 100-word compelling summary of interest for candidate applying to ${company || "the company"} for ${jobTitle || "the position"}.
JD snippet: ${jobDescription?.slice(0, 800) || ""}
Candidate: ${resumeContext}
Return ONLY the summary in first-person.`;

        const aiResult = await getAIReply([{ role: "user", content: prompt }], "chat");
        const answer = (aiResult.reply || "").trim().replace(/^["']|["']$/g, "");

        res.json({ success: true, answer });
    } catch (err: any) {
        console.error("Autofill tailor error:", err);
        res.status(500).json({ error: "Failed to generate tailored application answer" });
    }
});

// ── POST /api/autofill/clip-job ── Clip job from browser into application tracker
router.post("/clip-job", async (req: AuthRequest, res: Response) => {
    try {
        const { title, company, location, salary, jobUrl, description, source } = req.body;

        if (!title || !company) {
            res.status(400).json({ error: "title and company are required" });
            return;
        }

        const userId = req.user!.userId;

        // Add to applications pipeline table
        const { data: appData, error: appError } = await supabaseAdmin
            .from("applications")
            .insert({
                user_id: userId,
                company: company.trim(),
                role: title.trim(),
                status: "Applied",
                date_applied: new Date().toISOString().split("T")[0],
                interview_progress: JSON.stringify({
                    location: location || "Remote",
                    salary: salary || "",
                    job_url: jobUrl || "",
                    source: source || "Chrome Extension",
                    notes: description ? description.slice(0, 500) : "",
                }),
            })
            .select()
            .maybeSingle();

        // Also add or update in jobs table if exists
        try {
            await supabaseAdmin.from("jobs").insert({
                user_id: userId,
                company: company.trim(),
                role: title.trim(),
                location: location || "Remote",
                salary: salary || "",
                status: "Applied",
                job_url: jobUrl || "",
                job_description: description || "",
            });
        } catch (_) {
            // Ignore duplicate job conflict
        }

        await logActivity({
            user_id: userId,
            type: "job_applied",
            title: `Applied to ${title} at ${company} via Extension`,
            meta: {
                company,
                role: title,
                source: source || "Chrome Extension",
            },
        });

        res.status(201).json({
            success: true,
            message: "Job clipped and added to application tracker",
            application: appData,
        });
    } catch (err: any) {
        console.error("Autofill clip job error:", err);
        res.status(500).json({ error: "Failed to clip job" });
    }
});

// ── GET /api/autofill/ats-patterns ── Returns ATS detection selectors
router.get("/ats-patterns", (_req, res) => {
    res.json({
        patterns: {
            greenhouse: {
                matchRegex: "boards\\.greenhouse\\.io|greenhouse",
                fields: {
                    first_name: "#first_name, input[autocomplete='given-name']",
                    last_name: "#last_name, input[autocomplete='family-name']",
                    email: "#email, input[type='email']",
                    phone: "#phone, input[type='tel']",
                    resume_upload: "input[type='file'][id*='resume'], input[type='file']",
                    linkedin: "input[id*='linkedin'], input[name*='linkedin']",
                    website: "input[id*='website'], input[name*='website'], input[id*='portfolio']",
                },
            },
            lever: {
                matchRegex: "jobs\\.lever\\.co|lever",
                fields: {
                    fullName: "input[name='name']",
                    email: "input[name='email']",
                    phone: "input[name='phone']",
                    org: "input[name='org']",
                    resume_upload: "input[type='file'][name='resume']",
                    linkedin: "input[name*='urls[LinkedIn]']",
                    github: "input[name*='urls[GitHub]']",
                    portfolio: "input[name*='urls[Portfolio]']",
                },
            },
            workday: {
                matchRegex: "myworkdayjobs\\.com|workday",
                fields: {
                    first_name: "input[data-automation-id='legalNameSection_firstName']",
                    last_name: "input[data-automation-id='legalNameSection_lastName']",
                    email: "input[data-automation-id='email']",
                    phone: "input[data-automation-id='phone-number']",
                    address: "input[data-automation-id='addressSection_addressLine1']",
                    city: "input[data-automation-id='addressSection_city']",
                    postal: "input[data-automation-id='addressSection_postalCode']",
                },
            },
            ashby: {
                matchRegex: "jobs\\.ashbyhq\\.com|ashbyhq",
                fields: {
                    fullName: "input[name='name'], input[placeholder*='Full Name']",
                    email: "input[type='email']",
                    phone: "input[type='tel']",
                    resume_upload: "input[type='file']",
                    linkedin: "input[placeholder*='LinkedIn'], input[name*='linkedin']",
                },
            },
        },
    });
});

export default router;
