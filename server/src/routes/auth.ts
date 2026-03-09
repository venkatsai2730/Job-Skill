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

        // Create user via Supabase Admin (skips email verification)
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm — no verification email
            user_metadata: { full_name: fullName || "" },
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

// POST /api/auth/google — generate Google OAuth URL directly
router.post("/google", async (req: Request, res: Response) => {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            res.status(500).json({ error: "Google OAuth not configured" });
            return;
        }

        const redirectUri = process.env.CLIENT_URL + "/auth/callback";
        const scope = encodeURIComponent("openid email profile");
        const state = Math.random().toString(36).substring(7);

        const googleAuthUrl =
            `https://accounts.google.com/o/oauth2/v2/auth` +
            `?client_id=${clientId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code` +
            `&scope=${scope}` +
            `&access_type=offline` +
            `&prompt=consent` +
            `&state=${state}`;

        res.json({ url: googleAuthUrl });
    } catch (error: any) {
        console.error("Google auth error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/auth/google/callback — exchange code for tokens, create/find user
router.post("/google/callback", async (req: Request, res: Response) => {
    try {
        const { code } = req.body;

        if (!code) {
            res.status(400).json({ error: "Authorization code required" });
            return;
        }

        const clientId = process.env.GOOGLE_CLIENT_ID!;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
        const redirectUri = process.env.CLIENT_URL + "/auth/callback";

        // Exchange authorization code for tokens
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenResponse.json() as any;

        if (tokenData.error) {
            console.error("Google token error:", tokenData);
            res.status(400).json({ error: tokenData.error_description || "Failed to exchange code" });
            return;
        }

        // Get user info from Google
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const googleUser = await userInfoResponse.json() as any;

        if (!googleUser.email) {
            res.status(400).json({ error: "Could not get email from Google" });
            return;
        }

        // Check if user exists in Supabase, or create them
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        let userId: string;
        const existingUser = existingUsers?.users?.find(u => u.email === googleUser.email);

        if (existingUser) {
            userId = existingUser.id;
        } else {
            // Create new user in Supabase (with a random secure password since they use Google)
            const randomPassword = Math.random().toString(36).slice(-12) + "A1!";
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: googleUser.email,
                password: randomPassword,
                email_confirm: true,
                user_metadata: {
                    full_name: googleUser.name || "",
                    avatar_url: googleUser.picture || "",
                    provider: "google",
                },
            });

            if (createError) {
                console.error("Create user error:", createError);
                res.status(400).json({ error: createError.message });
                return;
            }
            userId = newUser.user.id;

            // Also create their profile
            await supabaseAdmin.from("profiles").insert({
                user_id: userId,
                display_name: googleUser.name || "",
                avatar_url: googleUser.picture || "",
            });
        }

        const token = generateToken(userId, googleUser.email);

        res.json({
            token,
            user: {
                id: userId,
                email: googleUser.email,
                fullName: googleUser.name || "",
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

export default router;
