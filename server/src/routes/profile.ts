import { Router, Response } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

// All profile routes require authentication
router.use(authenticateToken);

// GET /api/profile
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("user_id", req.user!.userId)
            .single();

        if (error && error.code !== "PGRST116") {
            res.status(400).json({ error: error.message });
            return;
        }

        if (!data) {
            // Create profile if it doesn't exist
            const { data: newProfile, error: createError } = await supabaseAdmin
                .from("profiles")
                .insert({ user_id: req.user!.userId })
                .select()
                .single();

            if (createError) {
                res.status(400).json({ error: createError.message });
                return;
            }

            res.json({ profile: newProfile });
            return;
        }

        res.json({ profile: data });
    } catch (error: any) {
        console.error("Get profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// PUT /api/profile
router.put("/", async (req: AuthRequest, res: Response) => {
    try {
        const { displayName, avatarUrl, jobTitle, location, website, linkedIn, bio } = req.body;

        const updates: Record<string, any> = {};
        if (displayName !== undefined) updates.display_name = displayName;
        if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
        if (jobTitle !== undefined) updates.job_title = jobTitle;
        if (location !== undefined) updates.location = location;
        if (website !== undefined) updates.website = website;
        if (linkedIn !== undefined) updates.linkedin_url = linkedIn;
        if (bio !== undefined) updates.bio = bio;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from("profiles")
            .update(updates)
            .eq("user_id", req.user!.userId)
            .select()
            .single();

        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ profile: data });
    } catch (error: any) {
        console.error("Update profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
