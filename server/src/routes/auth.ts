import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../config/supabase.js";

const router = Router();

// Generate JWT token
const generateToken = (userId: string, email: string): string => {
    return jwt.sign({ userId, email }, process.env.JWT_SECRET!, {
        expiresIn: "7d",
    });
};

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
    try {
        const { email, password, fullName } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required" });
            return;
        }

        const generateReferralCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
        const refCode = generateReferralCode();

        // Create user via Supabase Admin (skips email verification)
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm — no verification email
            user_metadata: { 
                full_name: fullName || "",
                referral_code: refCode,
                referred_by: req.body.referredBy || null 
            },
        });

        if (error) {
            // Handle duplicate user
            if (error.message.includes("already been registered")) {
                res.status(409).json({ error: "An account with this email already exists. Try signing in." });
                return;
            }
            res.status(400).json({ error: error.message });
            return;
        }

        const token = generateToken(data.user.id, email);

        res.json({
            token,
            user: {
                id: data.user.id,
                email: data.user.email,
                fullName: data.user.user_metadata?.full_name || "",
            },
        });
    } catch (error: any) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required" });
            return;
        }

        // Verify credentials via Supabase
        const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                res.status(401).json({ error: "Invalid email or password" });
                return;
            }
            res.status(400).json({ error: error.message });
            return;
        }

        const token = generateToken(data.user.id, email);

        res.json({
            token,
            user: {
                id: data.user.id,
                email: data.user.email,
                fullName: data.user.user_metadata?.full_name || "",
            },
        });
    } catch (error: any) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/auth/google
router.post("/google", async (req: Request, res: Response) => {
    try {
        const redirectTo = req.body.redirectTo || process.env.CLIENT_URL + "/dashboard";

        const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo,
                queryParams: {
                    prompt: "select_account",
                },
            },
        });

        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ url: data.url });
    } catch (error: any) {
        console.error("Google auth error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/auth/logout
router.post("/logout", async (req: Request, res: Response) => {
    try {
        await supabaseAdmin.auth.signOut();
        res.json({ message: "Signed out successfully" });
    } catch (error: any) {
        console.error("Logout error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/auth/google/callback
router.post("/google/callback", async (req: Request, res: Response) => {
    try {
        const { access_token, refresh_token } = req.body;

        if (!access_token) {
            res.status(400).json({ error: "Access token required" });
            return;
        }

        // Get user from Supabase session
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);

        if (error || !user) {
            res.status(401).json({ error: "Invalid Google session" });
            return;
        }

        const token = generateToken(user.id, user.email!);

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.user_metadata?.full_name || user.user_metadata?.name || "",
            },
        });
    } catch (error: any) {
        console.error("Google callback error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/auth/me — get current user from JWT
router.get("/me", async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];

        if (!token) {
            res.status(401).json({ error: "No token provided" });
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId: string;
            email: string;
        };

        // Fetch profile from DB
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("user_id", decoded.userId)
            .single();

        res.json({
            user: {
                id: decoded.userId,
                email: decoded.email,
                fullName: profile?.display_name || "",
                plan: profile?.plan || "free",
                dailyCreditsUsed: profile?.daily_credits_used || 0,
                dailyCreditsLimit: profile?.daily_credits_limit || 5,
            },
        });
    } catch (error: any) {
        res.status(403).json({ error: "Invalid or expired token" });
    }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: "Email is required" });
            return;
        }

        const redirectTo = (process.env.CLIENT_URL || "http://localhost:5173") + "/auth";

        await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo,
        });

        // Always return success to prevent email enumeration
        res.json({ message: "If an account exists with this email, a password reset link has been sent." });
    } catch (error: any) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/auth/change-password — requires JWT auth
router.post("/change-password", async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];

        if (!token) {
            res.status(401).json({ error: "No token provided" });
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId: string;
            email: string;
        };

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: "Current and new passwords are required" });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ error: "New password must be at least 6 characters" });
            return;
        }

        // Verify current password by attempting sign in
        const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
            email: decoded.email,
            password: currentPassword,
        });

        if (signInError) {
            res.status(401).json({ error: "Current password is incorrect" });
            return;
        }

        // Update password via admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            decoded.userId,
            { password: newPassword }
        );

        if (updateError) {
            res.status(400).json({ error: updateError.message });
            return;
        }

        res.json({ message: "Password updated successfully" });
    } catch (error: any) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            res.status(403).json({ error: "Invalid or expired token" });
            return;
        }
        console.error("Change password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
