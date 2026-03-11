import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const AuthCallback = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuth();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Supabase returns tokens in the URL hash fragment
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const access_token = params.get("access_token");
                const refresh_token = params.get("refresh_token");

                // Supabase sets error in hash fragment if OAuth fails (e.g., provider disabled, denied)
                const oauthError = params.get("error");
                const oauthErrorDesc = params.get("error_description");
                if (oauthError) {
                    const msg = oauthErrorDesc
                        ? decodeURIComponent(oauthErrorDesc.replace(/\+/g, " "))
                        : oauthError;
                    setError(`Google sign-in failed: ${msg}`);
                    toast.error(`Google sign-in failed: ${msg}`);
                    setTimeout(() => navigate("/auth"), 3000);
                    return;
                }

                if (!access_token) {
                    setError("No access token found in callback URL");
                    setTimeout(() => navigate("/auth"), 3000);
                    return;
                }

                // Exchange Supabase token for our custom JWT via existing server endpoint
                const data = await api.post<{ token: string; user: any }>("/api/auth/google/callback", {
                    access_token,
                    refresh_token,
                });

                setAuth(data.token, data.user);
                toast.success("Welcome! ✦");
                navigate("/dashboard");
            } catch (err: any) {
                setError(err.message || "Authentication failed");
                toast.error("Authentication failed. Redirecting to login...");
                setTimeout(() => navigate("/auth"), 3000);
            }
        };

        handleCallback();
    }, [navigate, setAuth]);

    return (
        <div className="min-h-screen bg-page flex items-center justify-center">
            {error ? (
                <div className="text-center">
                    <p className="text-red-500 text-base mb-2">{error}</p>
                    <p className="text-white-60 text-sm">Redirecting to login...</p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-blue-electric border-t-transparent rounded-full animate-spin" />
                    <p className="text-white-60 text-sm">Completing sign in...</p>
                </div>
            )}
        </div>
    );
};

export default AuthCallback;
