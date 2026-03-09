import { motion } from "framer-motion";
import { User, CreditCard, Key, Bell, Download, Shield, Globe, Trash2, Copy, Check, Eye, EyeOff, Camera, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "api", label: "API Keys", icon: Key },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "export", label: "Export Data", icon: Download },
];

interface ProfileData {
  display_name?: string;
  job_title?: string;
  location?: string;
  website?: string;
  linkedin_url?: string;
  bio?: string;
  plan?: string;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedIn, setLinkedIn] = useState("");
  const [bio, setBio] = useState("");
  const [plan, setPlan] = useState("free");

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.get<{ profile: ProfileData }>("/api/profile");
        const p = data.profile;
        if (p) {
          setDisplayName(p.display_name || user?.fullName || "");
          setJobTitle(p.job_title || "");
          setLocation(p.location || "");
          setWebsite(p.website || "");
          setLinkedIn(p.linkedin_url || "");
          setBio(p.bio || "");
          setPlan(p.plan || "free");
        }
      } catch {
        // Fallback to auth context data
        setDisplayName(user?.fullName || "");
      }
    };
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.put("/api/profile", {
        displayName,
        jobTitle,
        location,
        website,
        linkedIn,
        bio,
      });
      toast.success("Profile updated successfully! ✦");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const userInitials = (displayName || user?.fullName || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-6 lg:p-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Settings</h1>
        <p className="text-white-60 text-base">Manage your account, preferences, and integrations.</p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar tabs */}
        <div className="lg:w-56 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                  ? "bg-blue-electric/10 text-blue-electric shadow-sm"
                  : "text-white-60 hover:bg-surface-2 hover:text-foreground"
                  }`}
              >
                <tab.icon className="w-4.5 h-4.5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── PROFILE ── */}
            {activeTab === "profile" && (
              <div className="space-y-8">
                {/* Avatar section */}
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-6">Profile Information</h3>
                  <div className="flex items-center gap-6 mb-8">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-electric to-cyan-spark flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg shadow-blue-electric/20">
                        {userInitials}
                      </div>
                      <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-surface-2 transition-colors">
                        <Camera className="w-3.5 h-3.5 text-white-60" />
                      </button>
                    </div>
                    <div>
                      <p className="text-foreground font-semibold text-lg">{displayName || user?.fullName || "User"}</p>
                      <p className="text-white-60 text-sm">{user?.email || ""}</p>
                      <p className="text-blue-electric text-sm mt-1">{plan === "free" ? "Free Plan" : plan === "pro" ? "Pro Plan" : "Team Plan"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-foreground text-sm font-medium mb-2 block">Full Name</label>
                      <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground text-base outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all" />
                    </div>
                    <div>
                      <label className="text-foreground text-sm font-medium mb-2 block">Email Address</label>
                      <input type="email" value={user?.email || ""} disabled className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground/60 text-base outline-none cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-foreground text-sm font-medium mb-2 block">Job Title</label>
                      <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Software Engineer" className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground text-base outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all placeholder:text-white-30" />
                    </div>
                    <div>
                      <label className="text-foreground text-sm font-medium mb-2 block">Location</label>
                      <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. San Francisco, CA" className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground text-base outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all placeholder:text-white-30" />
                    </div>
                    <div>
                      <label className="text-foreground text-sm font-medium mb-2 block">Website</label>
                      <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground text-base outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all placeholder:text-white-30" />
                    </div>
                    <div>
                      <label className="text-foreground text-sm font-medium mb-2 block">LinkedIn</label>
                      <input type="url" value={linkedIn} onChange={(e) => setLinkedIn(e.target.value)} placeholder="linkedin.com/in/yourprofile" className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground text-base outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all placeholder:text-white-30" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="bg-blue-electric hover:bg-blue-bright text-white px-8 py-3 rounded-xl font-medium text-sm transition-all hover:shadow-lg hover:shadow-blue-electric/20 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button className="text-white-60 hover:text-foreground px-6 py-3 rounded-xl font-medium text-sm transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Bio */}
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-2">Professional Bio</h3>
                  <p className="text-white-60 text-sm mb-4">This appears on your public profile and shared resumes.</p>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    maxLength={300}
                    className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground text-base outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all resize-none"
                  />
                  <p className="text-white-30 text-sm mt-2">{bio.length} / 300 characters</p>
                </div>
              </div>
            )}

            {/* ── BILLING ── */}
            {activeTab === "billing" && (
              <div className="space-y-6">
                {/* Current plan */}
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="font-display font-semibold text-foreground text-lg">Current Plan</h3>
                      <p className="text-white-60 text-base mt-1">You're on the Free plan with 5 AI chats per day.</p>
                    </div>
                    <span className="bg-blue-electric/10 text-blue-electric text-sm px-4 py-1.5 rounded-full font-semibold">Free</span>
                  </div>
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white-60">Monthly usage</span>
                      <span className="text-foreground font-mono font-semibold">42 / 150 credits</span>
                    </div>
                    <div className="h-3 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-electric to-cyan-spark rounded-full" style={{ width: "28%" }} />
                    </div>
                    <p className="text-white-30 text-sm mt-2">Resets on March 1, 2026</p>
                  </div>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-2 bg-blue-electric hover:bg-blue-bright text-white px-8 py-3 rounded-xl font-medium text-sm transition-all hover:shadow-lg hover:shadow-blue-electric/20"
                  >
                    Upgrade to Pro <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>

                {/* Plan comparison */}
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-6">Plan Comparison</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { name: "Free", price: "$0", features: ["5 AI chats/day", "1 ATS scan/day", "Basic resume editor", "2 job matches/day"], current: true },
                      { name: "Pro", price: "$19/mo", features: ["Unlimited AI chats", "Unlimited ATS scans", "AI resume rewriter", "Unlimited job matches", "Priority support"], current: false },
                      { name: "Team", price: "$49/mo", features: ["Everything in Pro", "Team dashboard", "Shared templates", "Analytics & reports", "SSO & admin tools"], current: false },
                    ].map((plan) => (
                      <div key={plan.name} className={`rounded-xl p-5 border-2 ${plan.name === "Pro" ? "border-blue-electric bg-blue-electric/5" : "border-gray-200/60"}`}>
                        <p className="font-display font-bold text-foreground text-base">{plan.name}</p>
                        <p className="font-mono font-bold text-2xl text-foreground mt-1 mb-4">{plan.price}</p>
                        <ul className="space-y-2">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-white-60">
                              <Check className="w-4 h-4 text-blue-electric shrink-0" /> {f}
                            </li>
                          ))}
                        </ul>
                        <button className={`w-full mt-5 py-2.5 rounded-lg font-medium text-sm transition-all ${plan.current ? "bg-surface-2 text-white-60 cursor-default" :
                          plan.name === "Pro" ? "bg-blue-electric hover:bg-blue-bright text-white" : "border border-gray-200 text-foreground hover:bg-surface-2"
                          }`}>
                          {plan.current ? "Current Plan" : "Upgrade"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment history */}
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-4">Payment History</h3>
                  <div className="text-center py-8">
                    <CreditCard className="w-10 h-10 text-white-30 mx-auto mb-3" />
                    <p className="text-white-60 text-base">No payment history yet</p>
                    <p className="text-white-30 text-sm mt-1">Upgrade to Pro to see your billing history here.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── API KEYS ── */}
            {activeTab === "api" && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg">API Keys</h3>
                  <p className="text-white-60 text-base mt-1 mb-6">Use API keys for programmatic access to JobSkill AI.</p>

                  {/* Existing key */}
                  <div className="bg-surface-2 border border-gray-200 rounded-xl p-5 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-foreground font-medium text-sm">Production Key</p>
                        <p className="text-white-30 text-xs">Created Feb 14, 2026</p>
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 text-xs px-2.5 py-1 rounded-full font-medium">Active</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono text-foreground">
                        {showKey ? "sk_live_a8f7g6h5j4k3l2m1n0o9p8q7r6" : "sk_live_••••••••••••••••••••••••••••"}
                      </code>
                      <button onClick={() => setShowKey(!showKey)} className="p-2.5 rounded-lg border border-gray-200 hover:bg-surface-2 transition-colors">
                        {showKey ? <EyeOff className="w-4 h-4 text-white-60" /> : <Eye className="w-4 h-4 text-white-60" />}
                      </button>
                      <button onClick={handleCopy} className="p-2.5 rounded-lg border border-gray-200 hover:bg-surface-2 transition-colors">
                        {copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-white-60" />}
                      </button>
                      <button className="p-2.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  <button className="bg-blue-electric hover:bg-blue-bright text-white px-6 py-3 rounded-xl font-medium text-sm transition-all hover:shadow-lg hover:shadow-blue-electric/20 flex items-center gap-2">
                    <Key className="w-4 h-4" /> Generate New Key
                  </button>
                </div>

                {/* API docs */}
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-2">API Documentation</h3>
                  <p className="text-white-60 text-base mb-4">Learn how to integrate JobSkill AI into your workflow.</p>
                  <div className="bg-gray-900 rounded-xl p-5 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono">
                      {`curl -X POST https://api.jobskill.ai/v1/ats-scan \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"resume_url": "https://..."}'`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-2">Email Notifications</h3>
                  <p className="text-white-60 text-base mb-6">Choose what emails you'd like to receive.</p>
                  <div className="divide-y divide-gray-100">
                    {[
                      { label: "Daily credit reset reminders", desc: "Get reminded when your daily credits reset", enabled: true },
                      { label: "Weekly progress summary", desc: "A recap of your weekly job search activity", enabled: true },
                      { label: "New job match alerts", desc: "Notified when new jobs match your profile", enabled: false },
                      { label: "Achievement unlocks", desc: "Celebrate milestones in your job search", enabled: true },
                      { label: "AI coaching tips", desc: "Personalized tips to improve your profile", enabled: false },
                      { label: "Product updates", desc: "New features and improvements", enabled: true },
                    ].map((n) => (
                      <div key={n.label} className="flex items-center justify-between py-5">
                        <div>
                          <p className="text-foreground text-base font-medium">{n.label}</p>
                          <p className="text-white-60 text-sm mt-0.5">{n.desc}</p>
                        </div>
                        <div className={`w-12 h-6 rounded-full cursor-pointer transition-colors shrink-0 ml-6 ${n.enabled ? "bg-blue-electric" : "bg-gray-200"}`}>
                          <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-sm transition-transform ${n.enabled ? "translate-x-6" : "translate-x-0.5"}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-2">Push Notifications</h3>
                  <p className="text-white-60 text-base mb-4">Browser push notifications for real-time updates.</p>
                  <button className="bg-surface-2 hover:bg-surface-3 text-foreground px-6 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2">
                    <Bell className="w-4 h-4" /> Enable Push Notifications
                  </button>
                </div>
              </div>
            )}

            {/* ── SECURITY ── */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-2">Change Password</h3>
                  <p className="text-white-60 text-base mb-6">Update your password to keep your account secure.</p>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="text-foreground text-sm font-medium mb-2 block">Current Password</label>
                      <input type="password" placeholder="••••••••" className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground text-base outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all" />
                    </div>
                    <div>
                      <label className="text-foreground text-sm font-medium mb-2 block">New Password</label>
                      <input type="password" placeholder="••••••••" className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground text-base outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all" />
                    </div>
                    <div>
                      <label className="text-foreground text-sm font-medium mb-2 block">Confirm New Password</label>
                      <input type="password" placeholder="••••••••" className="w-full bg-surface-2 border border-gray-200 rounded-xl px-4 py-3 text-foreground text-base outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all" />
                    </div>
                    <button className="bg-blue-electric hover:bg-blue-bright text-white px-8 py-3 rounded-xl font-medium text-sm transition-all hover:shadow-lg hover:shadow-blue-electric/20 mt-2">
                      Update Password
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-2">Connected Accounts</h3>
                  <p className="text-white-60 text-base mb-6">Social accounts linked to your profile.</p>
                  <div className="space-y-4">
                    {[
                      { name: "Google", email: "alex@gmail.com", connected: true, icon: "🔵" },
                      { name: "LinkedIn", email: "Not connected", connected: false, icon: "🔗" },
                      { name: "GitHub", email: "Not connected", connected: false, icon: "⚫" },
                    ].map((account) => (
                      <div key={account.name} className="flex items-center justify-between py-3 px-4 bg-surface-2 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{account.icon}</span>
                          <div>
                            <p className="text-foreground font-medium text-sm">{account.name}</p>
                            <p className="text-white-60 text-xs">{account.email}</p>
                          </div>
                        </div>
                        <button className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${account.connected ? "text-red-500 hover:bg-red-50" : "text-blue-electric hover:bg-blue-electric/10"
                          }`}>
                          {account.connected ? "Disconnect" : "Connect"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Danger zone */}
                <div className="bg-white border border-red-200 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-red-600 text-lg mb-2">Danger Zone</h3>
                  <p className="text-white-60 text-base mb-4">Irreversible actions that affect your account.</p>
                  <button className="border border-red-300 text-red-600 hover:bg-red-50 px-6 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> Delete Account
                  </button>
                </div>
              </div>
            )}

            {/* ── EXPORT ── */}
            {activeTab === "export" && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-2">Export Your Data</h3>
                  <p className="text-white-60 text-base mb-6">Download a copy of all your data in your preferred format.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { fmt: "JSON", desc: "Raw data, best for developers", icon: "{ }" },
                      { fmt: "PDF", desc: "Formatted resume and reports", icon: "📄" },
                      { fmt: "CSV", desc: "Spreadsheet-compatible export", icon: "📊" },
                    ].map((item) => (
                      <div key={item.fmt} className="bg-surface-2 rounded-xl p-6 text-center border border-gray-200/60 hover:border-blue-electric/40 transition-colors cursor-pointer">
                        <p className="text-3xl mb-3">{item.icon}</p>
                        <p className="text-foreground font-semibold text-base">{item.fmt}</p>
                        <p className="text-white-60 text-sm mt-1 mb-4">{item.desc}</p>
                        <button className="bg-blue-electric hover:bg-blue-bright text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 w-full">
                          <Download className="w-4 h-4" /> Export
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 shadow-sm">
                  <h3 className="font-display font-semibold text-foreground text-lg mb-2">Data Included</h3>
                  <p className="text-white-60 text-base mb-4">Your export will include:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {["Profile information", "Resume content", "Job applications", "AI chat history", "Skill assessments", "LinkedIn suggestions"].map((item) => (
                      <div key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                        <Check className="w-4 h-4 text-blue-electric shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
