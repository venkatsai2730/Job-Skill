import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Shield } from "lucide-react";

const AuthCallback = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuth();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Google OAuth redirects with ?code=... in the query string
                const params = new URLSearchParams(window.location.search);
                const code = params.get("code");

                if (!code) {
                    setError("No authorization code found in the callback URL.");
                    toast.error("Authentication failed — no code received.");
                    setTimeout(() => navigate("/auth"), 2500);
                    return;
                }

                // Send the code to our server to exchange for tokens + create user
                const data = await api.post<{ token: string; user: any }>(
                    "/api/auth/google/callback",
                    { code }
                );

                setAuth(data.token, data.user);
                toast.success("Signed in with Google! ✦");
                navigate("/dashboard", { replace: true });
            } catch (err: any) {
                console.error("OAuth callback error:", err);
                setError(err.message || "Authentication failed.");
                toast.error(err.message || "Google sign-in failed");
                setTimeout(() => navigate("/auth"), 2500);
            }
        };

        handleCallback();
    }, []);

    return (
        <div className="min-h-screen bg-page flex flex-col items-center justify-center gap-4">
            {error ? (
                <>
                    <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-red-500" />
                    </div>
                    <p className="text-foreground font-medium">{error}</p>
                    <p className="text-white-60 text-sm">Redirecting to login...</p>
                </>
            ) : (
                <>
                    <div className="w-10 h-10 border-2 border-blue-electric border-t-transparent rounded-full animate-spin" />
                    <p className="text-white-60 text-sm">Completing sign-in...</p>
                </>
            )}
        </div>
    );
};

export default AuthCallback;
