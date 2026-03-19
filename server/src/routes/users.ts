import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";

const router = Router();
router.use(authenticateToken);

// GET /api/users/referral
router.get("/referral", async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        // 1. Fetch user's own referral code
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (userError || !userData?.user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        const referralCode = userData.user.user_metadata?.referral_code || null;
        
        // 2. Count how many users have signed up using this referral code
        let inviteCount = 0;
        if (referralCode) {
            // Find any profiles where referred_by matches this user's referral code
            // Or use an admin query to check user_metadata across Auth table
            const { data: usersWithCode } = await supabaseAdmin.auth.admin.listUsers();
            if (usersWithCode && usersWithCode.users) {
                const referredUsers = usersWithCode.users.filter(u => 
                    u.user_metadata?.referred_by === referralCode
                );
                inviteCount = referredUsers.length;
            }
        }

        res.json({
            referralCode,
            inviteLink: referralCode ? `${process.env.CLIENT_URL || "http://localhost:5173"}/auth?ref=${referralCode}` : null,
            inviteCount
        });

    } catch (error: any) {
        console.error("Referral fetch error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
