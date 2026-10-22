import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Chrome, Download, Key, Copy, Check, Zap,
  CheckCircle2, AlertCircle, Sparkles, Shield,
  ArrowRight, Play, ExternalLink
} from "lucide-react";
import { api } from "@/lib/api";

export default function ExtensionPortal() {
  const [authToken, setAuthToken] = useState("");
  const [copiedToken, setCopiedToken] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Simulator State
  const [simFirstName, setSimFirstName] = useState("");
  const [simLastName, setSimLastName] = useState("");
  const [simEmail, setSimEmail] = useState("");
  const [simPhone, setSimPhone] = useState("");
  const [simLinkedin, setSimLinkedin] = useState("");
  const [simGithub, setSimGithub] = useState("");
  const [simWorkAuth, setSimWorkAuth] = useState("No");
  const [simSponsorship, setSimSponsorship] = useState("Yes");
  const [simFilled, setSimFilled] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token") || "";
    setAuthToken(token);
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await api.get<{ profile: any }>("/api/autofill/profile");
      setProfileData(res.profile);
    } catch (err) {
      console.error("Failed to fetch autofill profile:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(authToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleRunSimulation = () => {
    if (!profileData) return;
    const c = profileData.contact || {};
    const d = profileData.disclosures || {};

    setSimFirstName(c.firstName || "Applicant");
    setSimLastName(c.lastName || "Smith");
    setSimEmail(c.email || "applicant@example.com");
    setSimPhone(c.phone || "+1 (555) 234-5678");
    setSimLinkedin(c.linkedinUrl || "https://linkedin.com/in/applicant");
    setSimGithub(c.githubUrl || "https://github.com/applicant");
    setSimWorkAuth(d.authorizedToWorkInCountry || "Yes");
    setSimSponsorship(d.requiresSponsorship || "No");
    setSimFilled(true);
  };

  const handleClearSimulation = () => {
    setSimFirstName("");
    setSimLastName("");
    setSimEmail("");
    setSimPhone("");
    setSimLinkedin("");
    setSimGithub("");
    setSimWorkAuth("No");
    setSimSponsorship("Yes");
    setSimFilled(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Chrome Autofill Copilot Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Manifest V3 Ready
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Install and connect the JobSkill AI Chrome Extension to auto-fill ATS applications on Greenhouse, Lever, Workday, Ashby, and LinkedIn.
          </p>
        </div>
      </div>

      {/* TOP SECTION: INSTALLATION & TOKEN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Step-by-Step Installation */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Chrome className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold text-foreground">3-Step Chrome Setup</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Open Chrome Extensions Manager</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type <code className="px-1.5 py-0.5 bg-muted rounded text-foreground font-mono">chrome://extensions</code> in your Chrome address bar and toggle on <strong>Developer mode</strong> in the top-right.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Click "Load unpacked"</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click <strong>Load unpacked</strong> and select the extension directory from your repository:
                </p>
                <div className="mt-1.5 p-2 bg-muted/60 border border-border rounded-lg text-xs font-mono text-muted-foreground select-all">
                  extension\
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Paste Auth Token & Enjoy</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click the JobSkill extension icon in your browser toolbar and paste your sync token from below.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Token Card */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Key className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-foreground">Your 1-Click Sync Token</h2>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            This token authenticates your browser extension with your personal profile, active resume, and application pipeline.
          </p>

          <div className="bg-background border border-border rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">JWT Token</span>
              <span className="text-[10px] text-emerald-400 font-mono">Active Session</span>
            </div>
            <div className="font-mono text-xs text-muted-foreground truncate select-all bg-muted/40 p-2 rounded">
              {authToken || "Please log in to generate an active sync token"}
            </div>
          </div>

          <button
            onClick={handleCopyToken}
            disabled={!authToken}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-md shadow-emerald-500/20"
          >
            {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedToken ? "Token Copied to Clipboard!" : "Copy Sync Token"}</span>
          </button>
        </div>
      </div>

      {/* LIVE INTERACTIVE ATS AUTOFILL SIMULATOR */}
      <div className="bg-card border border-border rounded-2xl p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-foreground">Live Form Autofill Simulator</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Test how the Chrome Extension maps and injects your profile data into ATS forms (Greenhouse/Lever schema).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClearSimulation}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              Reset Form
            </button>
            <button
              onClick={handleRunSimulation}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> Simulate 1-Click Autofill
            </button>
          </div>
        </div>

        {/* Mock Application Form */}
        <div className="bg-background/80 border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/50 text-xs text-muted-foreground font-mono">
            <span>Mock ATS Form: Acme Corp — Senior Software Engineer</span>
            {simFilled && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 8 Fields Injected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">First Name *</label>
              <input
                type="text"
                placeholder="First name"
                value={simFirstName}
                onChange={(e) => setSimFirstName(e.target.value)}
                className={`w-full px-3 py-2 bg-card border rounded-lg text-sm text-foreground focus:outline-none transition-all ${
                  simFilled ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-border"
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Last Name *</label>
              <input
                type="text"
                placeholder="Last name"
                value={simLastName}
                onChange={(e) => setSimLastName(e.target.value)}
                className={`w-full px-3 py-2 bg-card border rounded-lg text-sm text-foreground focus:outline-none transition-all ${
                  simFilled ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-border"
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Email *</label>
              <input
                type="email"
                placeholder="Email address"
                value={simEmail}
                onChange={(e) => setSimEmail(e.target.value)}
                className={`w-full px-3 py-2 bg-card border rounded-lg text-sm text-foreground focus:outline-none transition-all ${
                  simFilled ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-border"
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Phone *</label>
              <input
                type="tel"
                placeholder="Phone number"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                className={`w-full px-3 py-2 bg-card border rounded-lg text-sm text-foreground focus:outline-none transition-all ${
                  simFilled ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-border"
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">LinkedIn Profile</label>
              <input
                type="url"
                placeholder="https://linkedin.com/in/..."
                value={simLinkedin}
                onChange={(e) => setSimLinkedin(e.target.value)}
                className={`w-full px-3 py-2 bg-card border rounded-lg text-sm text-foreground focus:outline-none transition-all ${
                  simFilled ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-border"
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">GitHub / Portfolio</label>
              <input
                type="url"
                placeholder="https://github.com/..."
                value={simGithub}
                onChange={(e) => setSimGithub(e.target.value)}
                className={`w-full px-3 py-2 bg-card border rounded-lg text-sm text-foreground focus:outline-none transition-all ${
                  simFilled ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-border"
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Are you legally authorized to work in this country?
              </label>
              <select
                value={simWorkAuth}
                onChange={(e) => setSimWorkAuth(e.target.value)}
                className={`w-full px-3 py-2 bg-card border rounded-lg text-sm text-foreground focus:outline-none transition-all ${
                  simFilled ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"
                }`}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Will you now or in the future require visa sponsorship?
              </label>
              <select
                value={simSponsorship}
                onChange={(e) => setSimSponsorship(e.target.value)}
                className={`w-full px-3 py-2 bg-card border rounded-lg text-sm text-foreground focus:outline-none transition-all ${
                  simFilled ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"
                }`}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
