import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Shield, Mail, Lock, User, Eye, EyeOff, Star, Quote } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth, user, loading: authLoading } = useAuth();

  // If already authenticated, redirect to dashboard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-electric border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const data = await api.post<{ token: string; user: any }>("/api/auth/login", {
          email,
          password,
        });
        setAuth(data.token, data.user);
        toast.success("Welcome back! ✦");
        navigate("/dashboard");
      } else {
        await api.post<{ token: string; user: any }>("/api/auth/signup", {
          email,
          password,
          fullName: name,
        });
        // Do NOT auto-login — require explicit login with credentials
        toast.success("Account created! Please sign in with your credentials.");
        setName("");
        setPassword("");
        // Keep email so user doesn't have to re-type it
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const data = await api.post<{ url: string }>("/api/auth/google", {
        redirectTo: window.location.origin + "/auth/callback",
      });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast.error(error.message || "Google sign-in failed");
    }
  };

  return (
    <PageTransition>
      <Helmet>
        <title>{isLogin ? "Sign In - JobSkill" : "Create Account - JobSkill"}</title>
        <meta name="description" content="Sign in or create an account to start building ATS-friendly resumes and tracking your job applications with AI." />
      </Helmet>
      <div className="min-h-screen bg-page flex relative overflow-hidden">
        {/* Gradient bg */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, hsl(250 89% 67% / 0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, hsl(280 75% 68% / 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, hsl(180 85% 60% / 0.06) 0%, transparent 50%)",
          }}
        />

        {/* ─── LEFT PANEL: Review / Branding ─── */}
        <div className="hidden lg:flex flex-col justify-center w-[50%] relative px-16 py-12">
          {/* Decorative blobs */}
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-blue-electric/10 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-10 right-0 w-60 h-60 rounded-full bg-violet-pulse/10 blur-[80px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative z-10 max-w-lg"
          >
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 mb-12">
              <div className="w-10 h-10 rounded-xl bg-blue-electric flex items-center justify-center shadow-lg shadow-blue-electric/25">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-foreground">JobSkill AI</span>
            </Link>

            {/* Headline */}
            <h2 className="font-display font-bold text-3xl xl:text-4xl leading-tight text-foreground mb-4">
              Your career{" "}
              <span className="bg-gradient-to-r from-blue-electric to-violet-pulse bg-clip-text text-transparent">
                breakthrough
              </span>{" "}
              starts here
            </h2>
            <p className="text-white-60 text-base leading-relaxed mb-10 max-w-sm">
              Join thousands of professionals who landed interviews faster with AI-powered career coaching.
            </p>

            {/* Review card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-surface-1 rounded-2xl p-7 border border-white/[0.06] shadow-[0_8px_30px_rgba(124,101,255,0.1),0_2px_8px_rgba(0,0,0,0.2)]"
            >
              <Quote className="w-8 h-8 text-blue-electric/20 mb-4" />
              <p className="text-foreground text-base leading-relaxed mb-6">
                "JobSkill AI completely transformed my job search. I went from getting ghosted to <span className="font-semibold text-blue-electric">4 offers in just 3 weeks</span>. The AI resume suggestions were absolute game-changers — my ATS score jumped from 45% to 92%."
              </p>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-electric to-violet-pulse flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0">
                  SK
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-semibold text-sm">Sarah K.</p>
                  <p className="text-white-60 text-xs">Product Manager @ Google</p>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Stats badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="flex items-center gap-6 mt-8"
            >
              <div className="flex -space-x-2">
                {["SK", "MJ", "PS", "DL"].map((initials, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-surface-1 flex items-center justify-center text-[9px] font-bold text-white"
                    style={{
                      background: [
                        "linear-gradient(135deg, #635bff, #7c6bff)",
                        "linear-gradient(135deg, #3b82f6, #2563eb)",
                        "linear-gradient(135deg, #06b6d4, #0891b2)",
                        "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                      ][i],
                    }}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">12,847+ professionals</p>
                <p className="text-white-60 text-xs">landed their dream jobs</p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* ─── RIGHT PANEL: Login Form ─── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-12 relative z-10">
          {/* Mobile logo */}
          <Link to="/" className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-electric flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">JobSkill AI</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-surface-1 rounded-2xl p-8 border border-white/[0.06] shadow-[0_8px_40px_rgba(124,101,255,0.1),0_2px_8px_rgba(0,0,0,0.2)] w-full max-w-md"
          >
            <h1 className="font-display font-bold text-2xl text-foreground text-center mb-1">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-white-60 text-sm text-center mb-6">
              {isLogin ? "Sign in to continue your career journey" : "Start your AI-powered career journey"}
            </p>

            {/* Google button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleAuth}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-white/[0.06] bg-surface-2 text-foreground text-sm font-medium hover:border-blue-electric/50 hover:bg-surface-3 transition-all mb-5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </motion.button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-white-30 text-xs uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {!isLogin && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white-30" />
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-2 border border-white/[0.06] text-foreground placeholder:text-white-30 text-sm focus:outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all"
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white-30" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-2 border border-white/[0.06] text-foreground placeholder:text-white-30 text-sm focus:outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white-30" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-11 pl-10 pr-11 rounded-xl bg-surface-2 border border-white/[0.06] text-foreground placeholder:text-white-30 text-sm focus:outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white-30 hover:text-white-60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {isLogin && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) {
                        toast.error("Please enter your email address first");
                        return;
                      }
                      try {
                        const data = await api.post<{ message: string }>("/api/auth/forgot-password", { email });
                        toast.success(data.message);
                      } catch (error: any) {
                        toast.error(error.message || "Failed to send reset email");
                      }
                    }}
                    className="text-blue-electric text-xs hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full h-11 rounded-xl bg-blue-electric hover:bg-blue-bright text-primary-foreground font-medium text-sm transition-all hover:shadow-[0_0_30px_rgba(99,91,255,0.3)] disabled:opacity-50"
              >
                {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              </motion.button>
            </form>

            <p className="text-white-60 text-sm text-center mt-6">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-electric hover:underline font-medium"
              >
                {isLogin ? "Sign up free" : "Sign in"}
              </button>
            </p>

            {!isLogin && (
              <p className="text-white-30 text-xs text-center mt-3">
                🎁 Get 5 free AI chats daily — no credit card needed
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Auth;
