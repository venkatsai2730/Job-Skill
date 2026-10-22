import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Search, Globe, DollarSign, ShieldCheck,
  TrendingUp, Award, Layers, Sparkles, ChevronRight,
  Briefcase, Star, CheckCircle, Info
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";

interface CompanyProfile {
  name: string;
  domain: string;
  industry: string;
  headquarters: string;
  size: string;
  visaH1B: {
    status: "Sponsors Visas" | "Limited Sponsorship" | "Does Not Sponsor";
    score: number;
    filingsPerYear: string;
    greenCardSupport: string;
    notes: string;
  };
  interviewInsights: {
    difficulty: number;
    typicalStages: string[];
    codingEmphasis: string;
    systemDesignEmphasis: string;
  };
  salaryBenchmarks: {
    level: string;
    baseRange: string;
    totalCompRange: string;
  }[];
  techStack: string[];
  cultureRating: number;
  hiringVelocity: "Aggressive" | "Active" | "Selective" | "Slow";
}

export default function CompanyInsights() {
  const [searchParams] = useSearchParams();
  const initialCompany = searchParams.get("company") || "google";

  const [searchQuery, setSearchQuery] = useState(initialCompany);
  const [activeCompany, setActiveCompany] = useState<CompanyProfile | null>(null);
  const [featuredCompanies, setFeaturedCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeatured();
    if (initialCompany) {
      fetchCompanyInsights(initialCompany);
    }
  }, []);

  const fetchFeatured = async () => {
    try {
      const res = await api.get<{ featured: CompanyProfile[] }>("/api/companies/insights");
      setFeaturedCompanies(res.featured || []);
    } catch (err) {
      console.error("Failed to fetch featured companies:", err);
    }
  };

  const fetchCompanyInsights = async (name: string) => {
    try {
      setLoading(true);
      const res = await api.get<{ company: CompanyProfile }>(`/api/companies/insights?company=${encodeURIComponent(name)}`);
      setActiveCompany(res.company);
    } catch (err) {
      console.error("Failed to load company insights:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchCompanyInsights(searchQuery.trim());
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Company Insights & Visa Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              H1B & Hiring Trends
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time hiring velocity, visa sponsorship intelligence, interview difficulty index, and salary benchmarks.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search any company (e.g. Stripe, Apple, Uber)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm rounded-xl shadow-sm transition-colors"
          >
            Explore
          </button>
        </form>
      </div>

      {/* QUICK SELECT CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-muted-foreground shrink-0 font-medium">Popular:</span>
        {["Google", "Amazon", "Microsoft", "Meta", "Stripe", "Apple", "Netflix"].map((c) => (
          <button
            key={c}
            onClick={() => {
              setSearchQuery(c);
              fetchCompanyInsights(c);
            }}
            className="px-3 py-1 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground font-medium shrink-0 transition-colors border border-border/50"
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      ) : activeCompany ? (
        <div className="space-y-6">
          {/* COMPANY HERO CARD */}
          <div className="bg-card border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-cyan-500/20">
                  {activeCompany.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">{activeCompany.name}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> {activeCompany.visaH1B.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1.5">
                    <span>{activeCompany.industry}</span>
                    <span>•</span>
                    <span>{activeCompany.headquarters}</span>
                    <span>•</span>
                    <span>{activeCompany.size}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <Link
                  to={`/dashboard/interview-prep?company=${encodeURIComponent(activeCompany.name)}`}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Prepare Interview
                </Link>
                <Link
                  to={`/dashboard/jobs?q=${encodeURIComponent(activeCompany.name)}`}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-xs flex items-center gap-1.5 transition-colors border border-border"
                >
                  <Briefcase className="w-3.5 h-3.5" /> View Open Roles
                </Link>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Visa Sponsor Score</p>
                <p className="text-xl font-bold text-cyan-400 font-mono mt-0.5">
                  {activeCompany.visaH1B.score}/100
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Interview Difficulty</p>
                <p className="text-xl font-bold text-amber-400 font-mono mt-0.5 flex items-center gap-1">
                  {activeCompany.interviewInsights.difficulty} <Star className="w-4 h-4 fill-amber-400" />
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Hiring Velocity</p>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">
                  {activeCompany.hiringVelocity}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Culture Rating</p>
                <p className="text-xl font-bold text-foreground font-mono mt-0.5">
                  {activeCompany.cultureRating} / 5.0
                </p>
              </div>
            </div>
          </div>

          {/* TWO COLUMN DETAILS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* 1. VISA & H1B SPONSORSHIP DEEP-DIVE */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-foreground">H1B & Immigration Profile</h3>
              </div>

              <div className="space-y-3">
                <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60">
                  <span className="text-xs font-semibold text-foreground block mb-0.5">Annual Volume</span>
                  <p className="text-sm text-cyan-400 font-bold">{activeCompany.visaH1B.filingsPerYear}</p>
                </div>

                <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60">
                  <span className="text-xs font-semibold text-foreground block mb-0.5">Green Card / PERM Policy</span>
                  <p className="text-sm text-muted-foreground">{activeCompany.visaH1B.greenCardSupport}</p>
                </div>

                <div className="bg-cyan-500/5 border border-cyan-500/20 p-3.5 rounded-xl text-xs text-muted-foreground space-y-1">
                  <span className="font-semibold text-cyan-400 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Immigration Assessment:
                  </span>
                  <p>{activeCompany.visaH1B.notes}</p>
                </div>
              </div>
            </div>

            {/* 2. INTERVIEW BREAKDOWN & ROUNDS */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Layers className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-foreground">Interview Process & Criteria</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Typical Interview Loop:
                  </span>
                  <div className="space-y-1.5">
                    {activeCompany.interviewInsights.typicalStages.map((stage, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                        <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-foreground">{stage}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <span className="font-semibold text-foreground block mb-1">Coding Round Focus:</span>
                  <p className="text-muted-foreground leading-relaxed">{activeCompany.interviewInsights.codingEmphasis}</p>
                </div>

                <div>
                  <span className="font-semibold text-foreground block mb-1">Architecture / System Design:</span>
                  <p className="text-muted-foreground leading-relaxed">{activeCompany.interviewInsights.systemDesignEmphasis}</p>
                </div>
              </div>
            </div>

            {/* 3. SALARY BENCHMARKS TABLE */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-foreground">Engineering Compensation Benchmarks</h3>
                </div>
                <span className="text-xs text-muted-foreground">US National Benchmarks</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="pb-3 font-semibold">Level / Tier</th>
                      <th className="pb-3 font-semibold">Base Salary Range</th>
                      <th className="pb-3 font-semibold">Total Comp (Base + Equity + Bonus)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {activeCompany.salaryBenchmarks.map((bench, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="py-3 font-semibold text-foreground">{bench.level}</td>
                        <td className="py-3 text-muted-foreground font-mono">{bench.baseRange}</td>
                        <td className="py-3 font-bold text-emerald-400 font-mono">{bench.totalCompRange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. TECH STACK TAGS */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-3 lg:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Primary Technology Stack
              </span>
              <div className="flex flex-wrap gap-2">
                {activeCompany.techStack.map((tech, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-lg bg-muted text-foreground text-xs font-medium border border-border"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
