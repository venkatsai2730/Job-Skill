import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { Shield, LayoutDashboard, MessageSquare, Briefcase, FileText, Linkedin, Settings, Gift, LogOut, ChevronDown, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get<{ count: number }>("/api/notifications/unread-count")
      .then(d => setUnreadCount(d.count)).catch(() => {});
    const interval = setInterval(() => {
      api.get<{ count: number }>("/api/notifications/unread-count")
        .then(d => setUnreadCount(d.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    navigate("/auth");
  };

  const displayName = user?.fullName || user?.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen app-bg flex flex-col">
      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-50 glass border-b border-border h-16 shrink-0">
        <div className="w-full px-6 lg:px-10 h-full">
          <div className="flex items-center justify-between h-full">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-sm shadow-blue-500/20">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-base text-foreground hidden sm:inline">JobSkill AI</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 ml-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                      ? "bg-blue-500/10 text-blue-500"
                      : "text-gray-600 hover:bg-gray-50 hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full bg-gray-50 border border-border">
                <Gift className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-foreground">{user?.dailyCreditsUsed ?? 0}/{user?.dailyCreditsLimit ?? 5}</span>
                <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((user?.dailyCreditsUsed ?? 0) / (user?.dailyCreditsLimit ?? 5)) * 100}%` }} />
                </div>
              </div>

              <Link to="/pricing" className="hidden sm:inline text-sm font-medium text-blue-500 hover:underline">
                Upgrade →
              </Link>

              {/* Notification Bell */}
              <button className="relative p-2 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] border-2 border-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-display font-bold text-xs">
                    {initials}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600 hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-12 z-50 w-56 bg-white rounded-xl border border-gray-200 shadow-lg shadow-black/8 py-1.5">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-foreground text-sm font-semibold">{displayName}</p>
                        <p className="text-gray-600 text-xs">{user?.email}</p>
                      </div>
                      <Link
                        to="/dashboard/settings"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:text-foreground hover:bg-gray-50 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4" /> Settings
                      </Link>
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
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

      {/* MOBILE BOTTOM NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-border flex justify-around py-2 px-2">
        {navItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? "text-blue-500" : "text-gray-400"}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label.replace("AI ", "")}
            </Link>
          );
        })}
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 pb-16 md:pb-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
