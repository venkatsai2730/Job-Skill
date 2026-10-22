import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { getAIReply } from "../services/chatService.js";
import { supabaseAdmin } from "../config/supabase.js";
import { logActivity } from "../services/activityService.js";

const router = Router();
router.use(authenticateToken);

// In-memory fallback if DB table row has transient issue
const inMemoryContactsCache: Record<string, any[]> = {};

// ═══════════════════════════════════════════════════════════════
// POST /api/networking/generate-message
// ═══════════════════════════════════════════════════════════════
router.post("/generate-message", async (req: AuthRequest, res: Response) => {
    try {
        const { messageType, targetCompany, targetRole, recipientName, recipientTitle, sharedContext, channel } = req.body;

        if (!targetCompany || !targetRole) {
            res.status(400).json({ error: "targetCompany and targetRole are required." });
            return;
        }

        // Fetch resume snippet to personalize achievements
        const { data: resume } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", req.user!.userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const candidateSkills = resume?.parsed_data?.skills ? JSON.stringify(resume.parsed_data.skills).slice(0, 300) : "Full-stack software engineering";
        const isLinkedInNote = channel === "linkedin_connection_note";

        const prompt = `You are a career networking strategist helping a job seeker reach out to an industry insider.

Message Type: ${messageType || "referral_request"}
Recipient: ${recipientName || "Team Lead"} (${recipientTitle || "Engineering Leader"})
Company: ${targetCompany}
Target Role: ${targetRole}
Shared Connection / Context: ${sharedContext || "Shared passion for technology & mutual admiration of the company's engineering culture"}
Candidate Skills: ${candidateSkills}
Channel: ${channel || "linkedin_dm"}

GUIDELINES:
1. Tone: Respectful, warm, concise, and non-entitled.
2. Value Proposition: Highlight genuine alignment and concise credibility.
3. Call to Action: Low-friction ask (e.g., 5-minute advice chat or passing resume to hiring team).
${isLinkedInNote ? "4. CRITICAL: The message MUST BE STRICTLY UNDER 280 CHARACTERS for a LinkedIn connection note." : "4. Keep the body between 70 and 130 words. Subject line included if email."}

Return a valid JSON object with:
{
  "subject": "<Compelling email subject line or empty string if LinkedIn note>",
  "message": "<The exact message body with no placeholders>",
  "tips": [
    "<1 tactical tip for when to send this>",
    "<1 tip on how to follow up>"
  ]
}

Return ONLY the JSON.`;

        const result = await getAIReply([{ role: "user", content: prompt }], "chat");
        let cleaned = (result.reply || "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
            cleaned = cleaned.slice(start, end + 1);
        }

        const generated = JSON.parse(cleaned);

        await logActivity({
            user_id: req.user!.userId,
            type: "chat_message",
            title: `Generated networking outreach for ${targetCompany}`,
            meta: {
                company: targetCompany,
                role: targetRole,
                type: messageType,
            },
        });

        res.json({ success: true, ...generated });
    } catch (err: any) {
        console.error("Networking message generation error:", err);
        res.status(500).json({ error: "Failed to generate outreach message" });
    }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/networking/contacts
// ═══════════════════════════════════════════════════════════════
router.get("/contacts", async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        // Try to load from user_memories
        const { data } = await supabaseAdmin
            .from("user_memories")
            .select("value")
            .eq("user_id", userId)
            .eq("key", "networking_contacts")
            .maybeSingle();

        const contacts = data?.value || inMemoryContactsCache[userId] || [];
        res.json({ contacts });
    } catch (err: any) {
        console.error("Get contacts error:", err);
        const contacts = inMemoryContactsCache[req.user!.userId] || [];
        res.json({ contacts });
    }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/networking/contacts
// ═══════════════════════════════════════════════════════════════
router.post("/contacts", async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { name, company, role, linkedinUrl, status, notes } = req.body;

        if (!name || !company) {
            res.status(400).json({ error: "Name and company are required" });
            return;
        }

        const newContact = {
            id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: name.trim(),
            company: company.trim(),
            role: role?.trim() || "Team Member",
            linkedinUrl: linkedinUrl || "",
            status: status || "Identified", // Identified | Reached Out | In Conversation | Referral Submitted
            notes: notes || "",
            createdAt: new Date().toISOString(),
            lastContacted: new Date().toISOString().split("T")[0],
        };

        // Fetch existing
        let currentContacts: any[] = inMemoryContactsCache[userId] || [];
        try {
            const { data } = await supabaseAdmin
                .from("user_memories")
                .select("value")
                .eq("user_id", userId)
                .eq("key", "networking_contacts")
                .maybeSingle();

            if (data?.value && Array.isArray(data.value)) {
                currentContacts = data.value;
            }
        } catch (_) {}

        currentContacts = [newContact, ...currentContacts];
        inMemoryContactsCache[userId] = currentContacts;

        // Upsert to user_memories
        try {
            await supabaseAdmin.from("user_memories").upsert({
                user_id: userId,
                key: "networking_contacts",
                value: currentContacts,
                updated_at: new Date().toISOString(),
            }, { onConflict: "user_id,key" });
        } catch (dbErr) {
            console.warn("Failed to persist networking contact to DB, using cache:", dbErr);
        }

        res.status(201).json({ success: true, contact: newContact });
    } catch (err: any) {
        console.error("Save contact error:", err);
        res.status(500).json({ error: "Failed to save contact" });
    }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/networking/contacts/:id
// ═══════════════════════════════════════════════════════════════
router.delete("/contacts/:id", async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;

        let currentContacts: any[] = inMemoryContactsCache[userId] || [];
        try {
            const { data } = await supabaseAdmin
                .from("user_memories")
                .select("value")
                .eq("user_id", userId)
                .eq("key", "networking_contacts")
                .maybeSingle();

            if (data?.value && Array.isArray(data.value)) {
                currentContacts = data.value;
            }
        } catch (_) {}

        currentContacts = currentContacts.filter(c => c.id !== id);
        inMemoryContactsCache[userId] = currentContacts;

        try {
            await supabaseAdmin.from("user_memories").upsert({
                user_id: userId,
                key: "networking_contacts",
                value: currentContacts,
                updated_at: new Date().toISOString(),
            }, { onConflict: "user_id,key" });
        } catch (_) {}

        res.json({ success: true, message: "Contact removed" });
    } catch (err: any) {
        console.error("Delete contact error:", err);
        res.status(500).json({ error: "Failed to delete contact" });
    }
});

export default router;
