import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { Shield, LayoutDashboard, MessageSquare, Briefcase, FileText, Linkedin, Settings, Gift, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "AI Chat", icon: MessageSquare, path: "/dashboard/chat" },
  { label: "Jobs", icon: Briefcase, path: "/dashboard/jobs" },
  { label: "Resume", icon: FileText, path: "/dashboard/resume" },
  { label: "LinkedIn", icon: Linkedin, path: "/dashboard/linkedin" },
  { label: "Settings", icon: Settings, path: "/dashboard/settings" },
];

const DashboardLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    navigate("/auth");
  };

  const displayName = user?.fullName || user?.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* ─── TOP NAVBAR ─── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border/60 h-16 shrink-0">
        <div className="w-full px-6 lg:px-10 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-blue-electric flex items-center justify-center shadow-sm shadow-blue-electric/20">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-base text-foreground hidden sm:inline">JobSkill AI</span>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-1 ml-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                      ? "bg-blue-electric/10 text-blue-electric"
                      : "text-white-60 hover:bg-surface-2 hover:text-foreground"
                      }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Credits */}
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-2 border border-border/40">
                <Gift className="w-4 h-4 text-blue-electric" />
                <span className="text-sm font-medium text-foreground">{user?.dailyCreditsUsed ?? 0}/{user?.dailyCreditsLimit ?? 5}</span>
                <div className="w-14 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-electric rounded-full" style={{ width: `${((user?.dailyCreditsUsed ?? 0) / (user?.dailyCreditsLimit ?? 5)) * 100}%` }} />
                </div>
              </div>

              <Link to="/pricing" className="hidden sm:inline text-sm font-medium text-blue-electric hover:underline">
                Upgrade →
              </Link>

              {/* User */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-2 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-electric to-cyan-spark flex items-center justify-center text-white font-display font-bold text-xs">
                    {initials}
                  </div>
                  <ChevronDown className="w-4 h-4 text-white-60 hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-12 z-50 w-56 bg-white rounded-xl border border-gray-200/80 shadow-lg py-1.5">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-foreground text-sm font-semibold">{displayName}</p>
                        <p className="text-white-60 text-xs">{user?.email}</p>
                      </div>
                      <Link
                        to="/dashboard/settings"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white-60 hover:text-foreground hover:bg-surface-2 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4" /> Settings
                      </Link>
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
                        onClick={handleSignOut}
                      >
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MOBILE BOTTOM NAV ─── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-border/60 flex justify-around py-2 px-2">
        {navItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? "text-blue-electric" : "text-white-30"
                }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label.replace("AI ", "")}
            </Link>
          );
        })}
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 pb-16 md:pb-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
