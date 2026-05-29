// ═══════════════════════════════════════════════════════════════
// Resume Data API — GET / PATCH structured resume data
// Used by the live-edit system to persist AI-generated changes
// ═══════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import {
    normalizeToResumeData,
    denormalizeToSections,
} from "../types/resumePatchTypes.js";
import type { ResumeData } from "../types/resumePatchTypes.js";

const router = Router();

// ── GET /api/resume/data ──────────────────────────────────────
// Returns the normalized ResumeData for the logged-in user
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== "PGRST116") {
            res.status(400).json({ error: error.message });
            return;
        }

        if (!data || !data.parsed_data) {
            res.json({ resume_data: null });
            return;
        }

        const parsedData = data.parsed_data as any;

        // If resume_data was already saved in normalized form, return it
        if (parsedData.resume_data) {
            res.json({ resume_data: parsedData.resume_data });
            return;
        }

        // Otherwise, normalize from legacy sections on-the-fly
        if (parsedData.sections) {
            const normalized = normalizeToResumeData(parsedData.sections);
            res.json({ resume_data: normalized });
            return;
        }

        res.json({ resume_data: null });
    } catch (err: any) {
        console.error("[resumeData] GET error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── PATCH /api/resume/data ────────────────────────────────────
// Accepts a full or partial ResumeData and persists it
// Merges into the existing parsed_data jsonb column
router.patch("/", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const resumeData: ResumeData = req.body.resume_data;

        if (!resumeData) {
            res.status(400).json({ error: "resume_data is required in the request body" });
            return;
        }

        // Get the current resume row
        const { data: currentRow, error: fetchError } = await supabaseAdmin
            .from("resumes")
            .select("id, parsed_data")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (fetchError || !currentRow) {
            res.status(404).json({ error: "No resume found to update." });
            return;
        }

        const existingParsedData = (currentRow.parsed_data as any) || {};

        // Convert ResumeData back to legacy sections for backward compat
        const updatedSections = denormalizeToSections(resumeData);

        // Merge: keep ats, rawText, etc. intact, update sections + store resume_data
        const mergedParsedData = {
            ...existingParsedData,
            sections: updatedSections,
            resume_data: resumeData,   // Also store the normalized form
        };

        const { error: updateError } = await supabaseAdmin
            .from("resumes")
            .update({ parsed_data: mergedParsedData })
            .eq("id", currentRow.id);

        if (updateError) {
            console.error("[resumeData] PATCH update error:", updateError);
            res.status(400).json({ error: updateError.message });
            return;
        }

        res.json({ success: true, message: "Resume data saved." });
    } catch (err: any) {
        console.error("[resumeData] PATCH error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
