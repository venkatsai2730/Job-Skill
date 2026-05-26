import { useState, useEffect, useRef } from "react";
import { Star, MapPin, DollarSign, Clock, Bot, ExternalLink, Filter, ChevronDown, BookmarkPlus, Search, Briefcase, Navigation, Info, Shield, AlertTriangle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  experience_min: number | null;
  experience_max: number | null;
  skills: string[];
  job_url: string;
  source: string;
  posted_at: string;
  description: string;
  // New fields
  seniority_level?: string;
  match_score?: number;
  confidence_score?: number;
  is_active?: boolean;
  category?: string;
  // v2.0: Smart ranking fields
  matched_skills?: string[];
  skill_gap?: string[];
  // v3.0: Selection chance
  selection_chance?: number;
  selection_reason?: string;
}

interface TrackedJob {
  id: string;
  company: string;
  role: string;
  location: string;
  salary: string;
  status: string;
  match_score: number;
  job_url: string;
  job_description: string;
  created_at: string;
  starred: boolean;
}

interface GeoLocation {
  city: string;
  state: string;
  country: string;
  country_code: string;
  lat: number;
  lon: number;
}

const STATS = [
  { icon: "📋", label: "Total", value: "0" },
  { icon: "✅", label: "Active", value: "0" },
  { icon: "🎯", label: "Interviews", value: "0" },
  { icon: "🏆", label: "Offers", value: "0" },
  { icon: "📈", label: "Response Rate", value: "0%" },
];

const COLUMNS = [
  { name: "Saved", status: "Saved", color: "text-gray-600" },
  { name: "Applied", status: "Applied", color: "text-blue-500" },
  { name: "Interview", status: "Interview", color: "text-cyan-500" },
  { name: "Offer", status: "Offer", color: "text-emerald-400" },
];

// ── Seniority Badge Component ─────────────────────────────
function SeniorityBadge({ level }: { level?: string }) {
  const config: Record<string, { emoji: string; label: string; cls: string }> = {
    intern: { emoji: "🟣", label: "Intern", cls: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
    entry: { emoji: "🟢", label: "Entry", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
    mid: { emoji: "🔵", label: "Mid", cls: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
    senior: { emoji: "🟠", label: "Senior", cls: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
    lead: { emoji: "🔴", label: "Lead", cls: "bg-red-500/15 text-red-400 border-red-500/20" },
  };
  const c = config[(level || "").toLowerCase()];
  if (!c) return null;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.cls} flex items-center gap-1`}>
      {c.emoji} {c.label}
    </span>
  );
}

// ── Match Score Badge ─────────────────────────────────────
function MatchScoreBadge({ score }: { score?: number }) {
  if (score === undefined || score === 0) return null;
  let emoji: string, label: string, cls: string;
  if (score >= 90) { emoji = "🟢"; label = "Perfect Match"; cls = "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"; }
  else if (score >= 70) { emoji = "🔵"; label = "Good Match"; cls = "bg-blue-500/15 text-blue-400 border-blue-500/20"; }
  else if (score >= 50) { emoji = "🟡"; label = "Partial Match"; cls = "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"; }
  else { emoji = "🔴"; label = "Low Match"; cls = "bg-red-500/15 text-red-400 border-red-500/20"; }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls} flex items-center gap-1`}>
      {emoji} {score}% {label}
    </span>
  );
}

// ── Selection Chance Badge ────────────────────────────────
function SelectionChanceBadge({ chance, reason }: { chance?: number; reason?: string }) {
  if (!chance || chance <= 0) return null;
  const [showTip, setShowTip] = useState(false);
  let emoji: string, label: string, cls: string, bgCls: string;
  if (chance >= 60) {
    emoji = "🔥"; label = "High Chance"; cls = "text-emerald-400"; bgCls = "bg-emerald-500/15 border-emerald-500/20";
  } else if (chance >= 30) {
    emoji = "✨"; label = "Good Chance"; cls = "text-blue-400"; bgCls = "bg-blue-500/15 border-blue-500/20";
  } else if (chance >= 15) {
    emoji = "💡"; label = "Moderate"; cls = "text-yellow-400"; bgCls = "bg-yellow-500/15 border-yellow-500/20";
  } else {
    emoji = "📊"; label = "Competitive"; cls = "text-gray-400"; bgCls = "bg-gray-500/15 border-gray-500/20";
  }
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bgCls} ${cls} flex items-center gap-1 cursor-help`}
      >
        {emoji} {chance}% {label}
      </button>
      {showTip && reason && (
        <div className="absolute bottom-7 left-0 z-50 w-56 bg-gray-50 border border-border rounded-xl p-3 shadow-xl text-[11px] text-gray-700">
          <p className="font-bold text-gray-800 mb-1">Estimated Selection Chance</p>
          <p>{reason}</p>
        </div>
      )}
    </div>
  );
}

// ── Activity Badge ────────────────────────────────────────
function ActivityBadge({ postedAt }: { postedAt: string }) {
  const daysAgo = Math.floor((Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 7) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">🟢 Active</span>;
  if (daysAgo >= 30) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">🕐 Closing soon</span>;
  return null;
}

// ── "Why this job?" Tooltip ───────────────────────────────
function WhyThisJob({ job, userSkills }: { job: JobListing; userSkills: string[] }) {
  const [open, setOpen] = useState(false);
  if (!userSkills || userSkills.length === 0) return null;
  const matchingSkills = (job.skills || []).filter(s => userSkills.some(us => us.toLowerCase() === s.toLowerCase()));
  const expFit = job.experience_min !== null ? `Fits ${job.experience_min}-${job.experience_max || '?'} yrs range` : "Experience not specified";
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-cyan-500 transition-colors p-1 rounded" title="Why this job?">
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-8 left-0 z-50 w-56 bg-gray-50 border border-border rounded-xl p-3 shadow-xl text-[11px]" onMouseLeave={() => setOpen(false)}>
          <p className="font-bold text-gray-800 mb-1.5">Why this job?</p>
          {matchingSkills.length > 0 && <p className="text-emerald-400 mb-1">✅ Matches {matchingSkills.length} skills: {matchingSkills.slice(0, 4).join(", ")}{matchingSkills.length > 4 ? "..." : ""}</p>}
          <p className="text-gray-500 mb-1">📊 {expFit}</p>
          {(job.location || "").toLowerCase().includes("remote") && <p className="text-blue-400">🌍 Remote position</p>}
          {job.match_score && job.match_score > 0 && <p className="text-cyan-500 mt-1">🏆 {job.match_score}% match score</p>}
        </div>
      )}
    </div>
  );
}

export const formatSalary = (min: number | null, max: number | null) => {
  if (!min && !max) return "Not specified";
  if (min && !max) return `${Math.round(min / 1000)}k+`;
  if (!min && max) return `Up to ${Math.round(max / 1000)}k`;
  return `${Math.round(min! / 1000)}k - ${Math.round(max! / 1000)}k`;
};

export const formatTimeAgo = (dateStr: string) => {
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export function JobCard({ job, userSkills, onSave, onMatch }: { job: JobListing, userSkills: string[], onSave: (j: JobListing) => void, onMatch: (j: JobListing) => void }) {
  return (
    <div className="glass-card-hover p-5 flex flex-col group relative bg-white/60 backdrop-blur-md">
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        {(job.confidence_score || 100) < 60 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center gap-1" title="Experience data may be inaccurate">
            <AlertTriangle className="w-3 h-3" /> Verify
          </span>
        )}
        <span className={`text-gray-600 text-[10px] font-bold px-2 py-1 rounded capitalize tracking-wider flex items-center gap-1 ${job.source === "jsearch" ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-100"}`}>
          {job.source === "jsearch" ? "🌐 Global" : job.source}
        </span>
      </div>

      <div className="flex items-center gap-3.5 mb-3 mt-2">
        <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-500 font-display font-bold text-lg uppercase shrink-0">{job.company.charAt(0)}</div>
        <div className="flex flex-col gap-0.5 min-w-0 pr-16">
          <h4 className="text-foreground font-semibold text-[16px] leading-snug group-hover:text-blue-500 transition-colors truncate" title={job.title}>{job.title}</h4>
          <p className="text-gray-500 font-medium text-[14px] truncate" title={job.company}>{job.company}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <SeniorityBadge level={job.seniority_level} />
        <MatchScoreBadge score={job.match_score} />
        <SelectionChanceBadge chance={job.selection_chance} reason={job.selection_reason} />
        <ActivityBadge postedAt={job.posted_at} />
      </div>

      <div className="flex flex-col gap-2 mb-5 flex-1">
        <div className="flex items-center gap-2 text-gray-600 text-[13px] font-medium">
          <MapPin className="w-4 h-4 shrink-0 text-gray-400" /> <span className="truncate">{job.location || "Remote"}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 text-[13px] font-medium">
          <DollarSign className="w-4 h-4 shrink-0 text-gray-400" /> <span className="truncate">{formatSalary(job.salary_min, job.salary_max)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(job.matched_skills || []).slice(0, 2).map((skill: string) => (
            <span key={`m-${skill}`} className="bg-green-50 border border-green-200 px-2 py-0.5 rounded text-[11px] text-green-700 font-medium">✓ {skill}</span>
          ))}
          {(job.skill_gap || []).slice(0, 2).map((skill: string) => (
            <span key={`g-${skill}`} className="bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px] text-red-600">✗ {skill}</span>
          ))}
          {(!job.matched_skills || job.matched_skills.length === 0) && (job.skills || []).slice(0, 3).map((skill: string) => (
            <span key={skill} className="bg-white/70 border border-border px-2 py-0.5 rounded text-[11px] text-gray-600">{skill}</span>
          ))}
          {(job.skills || []).length > 3 && (!job.matched_skills || job.matched_skills.length === 0) && <span className="bg-white/70 border border-border px-2 py-0.5 rounded text-[11px] text-gray-500">+{(job.skills || []).length - 3}</span>}
          {!(job.skills) || job.skills.length === 0 && <span className="text-gray-400 italic text-[11px]">No specific skills</span>}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium"><Clock className="w-3.5 h-3.5" /> {formatTimeAgo(job.posted_at)}</div>
          <WhyThisJob job={job} userSkills={userSkills} />
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => onSave(job)} className="text-gray-600 hover:text-cyan-500 transition-colors flex items-center justify-center p-2 rounded-lg hover:bg-cyan-500/10 outline-none" title="Save to Tracked Apps">
            <BookmarkPlus className="w-4.5 h-4.5" />
          </button>
          <button onClick={() => onMatch(job)}
            className="text-gray-600 hover:text-purple-400 transition-colors flex items-center justify-center p-2 rounded-lg hover:bg-purple-400/10 outline-none" title="Match Score via AI">
            <Bot className="w-4.5 h-4.5" />
          </button>
          <a href={job.job_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-500 font-bold text-[13px] hover:text-white group/link outline-none transition-colors px-4 py-2 bg-blue-500/10 hover:bg-blue-500 rounded-lg">
            Apply Now <ExternalLink className="w-3.5 h-3.5 flex-none" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Category Section for Featured Jobs ────────────────────
function CategorySection({ title, jobs, onSeeAll, userSkills, onSave, onMatch }: { title: string; jobs: JobListing[]; onSeeAll: () => void; userSkills: string[]; onSave: (j: JobListing) => void; onMatch: (j: JobListing) => void }) {
  if (jobs.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        <button onClick={onSeeAll} className="text-blue-500 text-[13px] font-semibold hover:underline flex items-center gap-1">
          See all <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {jobs.slice(0, 4).map(job => <JobCard key={job.id} job={job} userSkills={userSkills} onSave={onSave} onMatch={onMatch} />)}
      </div>
    </div>
  );
}

export default function Jobs() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("feed");
  const [feedJobs, setFeedJobs] = useState<JobListing[]>([]);
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingTracked, setLoadingTracked] = useState(true);

  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [feedSubTab, setFeedSubTab] = useState<"for-you" | "browse" | "remote">("for-you");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categoryJobs, setCategoryJobs] = useState<JobListing[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [categoryTotal, setCategoryTotal] = useState(0);
  const [categoryPage, setCategoryPage] = useState(1);

  const [geoLocation, setGeoLocation] = useState<GeoLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<"detecting" | "detected" | "denied" | "idle">("idle");
  const geoDetectedRef = useRef(false);

  // Get user ID from localStorage
  const getUserId = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.userId || payload.sub || null;
    } catch { return null; }
  };

  useEffect(() => {
    setGeoStatus("detecting");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const geoData = await api.get<{ city: string; state: string; country: string; country_code: string }>(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);
            const geo: GeoLocation = { city: geoData.city, state: geoData.state, country: geoData.country, country_code: geoData.country_code, lat: latitude, lon: longitude };
            setGeoLocation(geo);
            setGeoStatus("detected");
            geoDetectedRef.current = true;
            setLocation(geo.city);
            setPreferredLocation(geo.country);
            fetchFeedJobs(true, 1, geo.country, geo.city, geo.country);
            toast.success(`📍 Location detected: ${geo.city}, ${geo.country}`);
          } catch {
            fallbackToTimezone();
          }
        },
        () => { setGeoStatus("denied"); fallbackToTimezone(); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    } else { fallbackToTimezone(); }

    fetchTrackedJobs();
    // Load user skills for "Why this job?" tooltip
    loadUserSkills();
  }, []);

  const loadUserSkills = async () => {
    try {
      const res = await api.get<{ parsed: any }>("/api/resume/parsed");
      if (res?.parsed?.sections?.skills) {
        const allSkills = (res.parsed.sections.skills as any[]).flatMap((g: any) => g.items || []);
        setUserSkills(allSkills);
      }
    } catch { /* no resume */ }
  };

  const fallbackToTimezone = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isIndia = (tz === "Asia/Calcutta" || tz === "Asia/Kolkata");
    const initPrefLoc = isIndia ? "India" : "";
    setPreferredLocation(initPrefLoc);
    setGeoStatus("denied");
    fetchFeedJobs(true, 1, initPrefLoc);
  };

  const fetchFeedJobs = async (reset = false, currentPage = 1, forcePrefLoc?: string, city?: string, country?: string, overrides?: { query?: string; location?: string; experience?: string; skills?: string; category?: string; limit?: string }) => {
    setLoadingFeed(true);
    if (reset) setPage(1);
    try {
      const defaultLimit = overrides?.category ? "60" : (getUserId() ? "200" : "40");
      const params = new URLSearchParams({ page: currentPage.toString(), limit: overrides?.limit || defaultLimit });
      const q = overrides?.query ?? search;
      const loc = overrides?.location ?? location;
      const exp = overrides?.experience ?? experience;
      const sk = overrides?.skills ?? skills;
      if (q) params.append("query", q);
      if (loc) params.append("location", loc);
      if (exp) params.append("experience_max", exp);
      if (sk) params.append("skills", sk);
      if (overrides?.category) params.append("category", overrides.category);

      const resolvedPrefLoc = forcePrefLoc !== undefined ? forcePrefLoc : preferredLocation;
      if (resolvedPrefLoc) params.append("preferred_location", resolvedPrefLoc);

      const resolvedCity = city || geoLocation?.city || "";
      const resolvedCountry = country || geoLocation?.country || "";
      if (resolvedCity) params.append("city", resolvedCity);
      if (resolvedCountry) params.append("country", resolvedCountry);

      // Pass user_id for resume matching
      const userId = getUserId();
      if (userId) params.append("user_id", userId);

      const res = await api.get<{ jobs: JobListing[], total: number }>(`/api/job-listings?${params.toString()}`);
      setFeedJobs(res.jobs || []);
      setTotalJobs(res.total || 0);
      setPage(currentPage);
    } catch {
      toast.error("Failed to load real-time job feed");
    } finally {
      setLoadingFeed(false);
    }
  };

  const handleApplyFilters = () => { fetchFeedJobs(true, 1); };
  const handlePageChange = (newPage: number) => {
    const perPage = getUserId() ? 50 : 40;
    const totalPages = Math.ceil(totalJobs / perPage);
    if (newPage < 1 || newPage > totalPages) return;
    fetchFeedJobs(false, newPage);
  };

  // Fetch jobs for a specific category from the server (not client-side filtering)
  const fetchCategoryJobs = async (serverCategory: string, pageNum = 1) => {
    setLoadingCategory(true);
    try {
      const params = new URLSearchParams({ page: pageNum.toString(), limit: "60", category: serverCategory });
      if (location) params.append("location", location);
      if (experience) params.append("experience_max", experience);
      
      const resolvedCity = geoLocation?.city || "";
      const resolvedCountry = geoLocation?.country || "";
      if (resolvedCity) params.append("city", resolvedCity);
      if (resolvedCountry) params.append("country", resolvedCountry);
      if (preferredLocation) params.append("preferred_location", preferredLocation);

      const userId = getUserId();
      if (userId) params.append("user_id", userId);

      const res = await api.get<{ jobs: JobListing[], total: number }>(`/api/job-listings?${params.toString()}`);
      setCategoryJobs(res.jobs || []);
      setCategoryTotal(res.total || 0);
      setCategoryPage(pageNum);
    } catch {
      toast.error("Failed to load category jobs");
    } finally {
      setLoadingCategory(false);
    }
  };

  const handleCategoryPageChange = (newPage: number) => {
    if (!categoryFilter) return;
    const serverCat = CATEGORY_TO_SERVER[categoryFilter];
    if (!serverCat) return;
    const totalPages = Math.ceil(categoryTotal / 60);
    if (newPage < 1 || newPage > totalPages) return;
    fetchCategoryJobs(serverCat, newPage);
  };

  // Map UI category names to server category filter values
  const CATEGORY_TO_SERVER: Record<string, string> = {
    "💻 Tech Jobs Near You": "Software Development",
    "🎓 Fresher & Internship": "Internships & Fresher",
    "🌍 Remote Worldwide": "Remote",
    "🏢 Top Companies Hiring": "", // handled client-side (no server category)
  };

  const handleSeeAll = (uiCategory: string) => {
    setCategoryFilter(uiCategory);
    const serverCat = CATEGORY_TO_SERVER[uiCategory];
    if (serverCat) {
      // Fetch from server with category filter for a full page of results
      fetchCategoryJobs(serverCat, 1);
    } else {
      // For "Top Companies", filter client-side (no server category)
      setCategoryJobs([]);
      setCategoryTotal(0);
    }
  };

  const handleBackToCategories = () => {
    setCategoryFilter(null);
    setCategoryJobs([]);
    setCategoryTotal(0);
    setCategoryPage(1);
  };

  const fetchTrackedJobs = async () => {
    setLoadingTracked(true);
    try {
      const res = await api.get<{ jobs: TrackedJob[] }>("/api/jobs");
      setTrackedJobs(res.jobs || []);
    } catch {
      toast.error("Failed to load tracked applications");
    } finally { setLoadingTracked(false); }
  };

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not specified";
    if (min && !max) return `$${Math.round(min / 1000)}k+`;
    if (!min && max) return `Up to $${Math.round(max / 1000)}k`;
    return `$${Math.round(min! / 1000)}k - $${Math.round(max! / 1000)}k`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const calculateStats = () => {
    if (trackedJobs.length === 0) return STATS;
    const active = trackedJobs.filter(j => j.status === "Applied" || j.status === "Interview").length;
    const interviews = trackedJobs.filter(j => j.status === "Interview").length;
    const offers = trackedJobs.filter(j => j.status === "Offer").length;
    const applied = trackedJobs.filter(j => ["Applied", "Interview", "Offer"].includes(j.status)).length;
    const responseRate = applied === 0 ? 0 : Math.round((interviews / applied) * 100);
    return [
      { icon: "📋", label: "Total", value: trackedJobs.length.toString() },
      { icon: "✅", label: "Active", value: active.toString() },
      { icon: "🎯", label: "Interviews", value: interviews.toString() },
      { icon: "🏆", label: "Offers", value: offers.toString() },
      { icon: "📈", label: "Response Rate", value: `${responseRate}%` },
    ];
  };

  const saveToTracked = async (job: JobListing) => {
    try {
      await api.post("/api/jobs", {
        company: job.company, role: job.title, location: job.location || "Remote",
        salary: formatSalary(job.salary_min, job.salary_max), status: "Saved",
        match_score: job.match_score || 0, job_description: job.description, job_url: job.job_url,
      });
      toast.success("Job saved to Tracked Applications!");
      fetchTrackedJobs();
    } catch { toast.error("Failed to save job"); }
  };

  const toggleStar = async (id: string, currentStarred: boolean) => {
    try {
      await api.patch(`/api/jobs/${id}`, { starred: !currentStarred });
      setTrackedJobs(jobs => jobs.map(j => j.id === id ? { ...j, starred: !currentStarred } : j));
    } catch { toast.error("Failed to update job"); }
  };

  const handleDetectLocation = () => {
    if (!("geolocation" in navigator)) { toast.error("Geolocation not supported"); return; }
    setGeoStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const geoData = await api.get<{ city: string; state: string; country: string; country_code: string }>(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);
          const geo: GeoLocation = { city: geoData.city, state: geoData.state, country: geoData.country, country_code: geoData.country_code, lat: latitude, lon: longitude };
          setGeoLocation(geo); setGeoStatus("detected"); setLocation(geo.city); setPreferredLocation(geo.country);
          toast.success(`📍 Location updated: ${geo.city}, ${geo.country}`);
          fetchFeedJobs(true, 1, geo.country, geo.city, geo.country);
        } catch { toast.error("Failed to detect location"); setGeoStatus("denied"); }
      },
      () => { toast.error("Location access denied."); setGeoStatus("denied"); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const displayStats = calculateStats();

  // ── Category Sections Data ──
  const categoryFilters: Record<string, (j: JobListing) => boolean> = {
    "💻 Tech Jobs Near You": (j) => ["Software Development", "Data & Analytics", "DevOps & Cloud"].includes(j.category || ""),
    "🎓 Fresher & Internship": (j) => {
      const title = j.title || "";
      const titleLower = title.toLowerCase();
      // TECH GATE: must be a tech role
      const isTech = /\b(engineer|developer|sde|software|data|devops|qa|tester|frontend|backend|fullstack|machine.?learn|ml\b|ai\b|python|java|react|node|web.?dev|android|ios|cloud|cyber|security|tech|it\b|network|database|embedded|automation|sre|sdet)\b/i.test(titleLower);
      const isNonTech = /\b(telecaller|fundrais|charity|marketing|sales|hr\b|human.?resource|legal|finance|account|video.?edit|graphic.?design|content.?writ|blog.?writ|business.?develop|business.?strat|client.?acqui|customer.?success|real.?estate|teaching|tutor|event.?manag|hospitality|medical|pharma|fashion)\b/i.test(titleLower);
      if (isNonTech || !isTech) return false;
      // Must also be a fresher/intern level
      return (j.category === "Internships & Fresher") || (j.seniority_level === "intern" || j.seniority_level === "entry") || /\b(intern|fresher|trainee|junior|jr\.?|associate|graduate|entry[\s-]?level|apprentice)\b/i.test(titleLower);
    },
    "🌍 Remote Worldwide": (j) => (j.location || "").toLowerCase().includes("remote"),
    "🏢 Top Companies Hiring": (j) => ["google", "microsoft", "amazon", "flipkart", "swiggy", "zomato", "razorpay", "cred"].some(c => (j.company || "").toLowerCase().includes(c)),
  };
  const techJobs = feedJobs.filter(categoryFilters["💻 Tech Jobs Near You"]).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  const fresherJobs = feedJobs.filter(categoryFilters["🎓 Fresher & Internship"]).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  const remoteJobs = feedJobs.filter(categoryFilters["🌍 Remote Worldwide"]).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  const topCompanyJobs = feedJobs.filter(categoryFilters["🏢 Top Companies Hiring"]).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

  // Get all jobs for the active category filter
  // Use server-fetched category jobs when available, fall back to client-side filtering
  const categoryFilteredJobs = categoryFilter
    ? (categoryJobs.length > 0 ? categoryJobs : feedJobs.filter(categoryFilters[categoryFilter] || (() => true)))
    : [];

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-[2rem] font-bold text-foreground mb-1.5 tracking-tight">Jobs Pipeline</h1>
        <p className="text-gray-600 text-[15px] font-medium">Discover new opportunities and track your applications.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 w-full">
          <TabsList className="bg-white border border-border p-1 h-auto rounded-full w-full max-w-sm">
            <TabsTrigger value="feed" className="rounded-full px-6 py-2.5 text-[14px] data-[state=active]:bg-blue-500 data-[state=active]:text-white">Real-time Feed</TabsTrigger>
            <TabsTrigger value="tracked" className="rounded-full px-6 py-2.5 text-[14px] data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              Tracked Apps {trackedJobs.length > 0 && `(${trackedJobs.length})`}
            </TabsTrigger>
          </TabsList>

          {activeTab === "tracked" && (
            <div className="flex gap-4 overflow-x-auto scrollbar-hide py-1">
              {displayStats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-border shadow-sm bg-white shrink-0">
                  <span className="text-[1.1rem]">{stat.icon}</span>
                  <span className="text-gray-600 font-medium text-[13px]">{stat.label}:</span>
                  <span className="text-blue-500 font-bold text-[15px]">{stat.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FEED CONTENT */}
        <TabsContent value="feed" className="flex-1 mt-0 outline-none flex flex-col">
          {/* Sub-tabs: For You / Browse All / Remote */}
          <div className="flex items-center gap-2 mb-5">
            {(["for-you", "browse", "remote"] as const).map(tab => {
              const labels = { "for-you": "✨ For You", "browse": "📋 Browse All", "remote": "🌍 Remote" };
              return (
                <button key={tab} onClick={() => setFeedSubTab(tab)}
                  className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all border ${
                    feedSubTab === tab
                      ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
                      : "bg-white text-gray-600 border-border hover:bg-gray-50 hover:text-foreground"
                  }`}>
                  {labels[tab]}
                </button>
              );
            })}
          </div>
          {/* Location Detection Banner */}
          {geoStatus === "detected" && geoLocation && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[13px] font-medium">
              <Navigation className="w-4 h-4 shrink-0" />
              <span>📍 Showing jobs near <strong>{geoLocation.city}, {geoLocation.country}</strong> — nearby jobs appear first</span>
              <button onClick={() => { setLocation(""); setGeoLocation(null); setGeoStatus("idle"); handleApplyFilters(); }} className="ml-auto text-emerald-400/60 hover:text-emerald-400 text-[12px] font-semibold underline underline-offset-2 transition-colors">Clear</button>
            </div>
          )}
          {geoStatus === "detecting" && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-500 text-[13px] font-medium">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full shrink-0" />
              <span>Detecting your location for nearby jobs...</span>
            </div>
          )}

          {/* Search & Filters Bar */}
          <div className="bg-white border border-border rounded-2xl p-5 mb-8 flex flex-col lg:flex-row gap-4 lg:items-end w-full shadow-lg">
            <div className="flex-1 space-y-1.5 min-w-[200px]">
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-widest px-1">Search Role / Company</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. React Developer, Swiggy"
                  className="w-full bg-white/70 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()} />
              </div>
            </div>
            <div className="w-full lg:w-[220px] space-y-1.5">
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-widest px-1">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hyderabad, Remote"
                  className="w-full bg-white/70 border border-border rounded-xl py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()} />
                <button onClick={handleDetectLocation} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors p-1 rounded" title="Detect my location">
                  <Navigation className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="w-full lg:w-[150px] space-y-1.5">
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-widest px-1">Experience</label>
              <div className="relative">
                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="number" min="0" max="20" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Max Years"
                  className="w-full bg-white/70 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()} />
              </div>
            </div>
            <div className="w-full lg:w-[200px] space-y-1.5">
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-widest px-1">Skills (Comma sep)</label>
              <div className="relative">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. React, Node.js"
                  className="w-full bg-white/70 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()} />
              </div>
            </div>
            <button onClick={handleApplyFilters} className="w-full lg:w-auto bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 flex items-center justify-center">Search Jobs</button>
          </div>

          {loadingFeed ? (
            <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
          ) : feedJobs.length === 0 ? (
            <div className="text-center py-20 bg-white border border-border rounded-2xl">
              <h3 className="text-lg font-medium text-gray-800">No jobs match your filters</h3>
              <p className="text-gray-600 mt-2">Try adjusting your search criteria broadly to find more roles.</p>
              <button onClick={() => { setSearch(""); setLocation(""); setExperience(""); setSkills(""); fetchFeedJobs(true, 1, undefined, undefined, undefined, { query: "", location: "", experience: "", skills: "", category: "" }); }} className="mt-4 text-blue-500 hover:underline text-sm font-medium">Clear Filters</button>
            </div>
          ) : (
            <>
              {/* Category Expanded View */}
              {categoryFilter ? (
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={handleBackToCategories} className="flex items-center gap-1.5 text-blue-500 hover:text-blue-600 font-semibold text-sm transition-colors">
                      ← Back to all categories
                    </button>
                    <span className="text-gray-300">|</span>
                    <h3 className="text-lg font-bold text-foreground">{categoryFilter}</h3>
                    <span className="text-gray-500 text-sm">({categoryTotal > 0 ? categoryTotal : categoryFilteredJobs.length} jobs)</span>
                  </div>
                  {loadingCategory ? (
                    <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {categoryFilteredJobs.map(job => <JobCard key={job.id} job={job} userSkills={userSkills} onSave={saveToTracked} onMatch={(j: JobListing) => { const prompt = `Analyze my fit for the ${j.title} role at ${j.company}. Skills: ${j.skills.join(", ")}.`; navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`); }} />)}
                      </div>
                      {categoryFilteredJobs.length === 0 && (
                        <div className="text-center py-12 bg-white border border-border rounded-2xl">
                          <p className="text-gray-500">No jobs found in this category right now.</p>
                        </div>
                      )}
                      {/* Category Pagination */}
                      {categoryTotal > 60 && (
                        <div className="flex justify-center items-center gap-3 mt-12 mb-6">
                          <button onClick={() => handleCategoryPageChange(categoryPage - 1)} disabled={categoryPage === 1} className="flex items-center gap-1 bg-gray-50 border border-border hover:bg-gray-100 transition-colors px-4 py-2 rounded-lg text-sm font-semibold text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed outline-none">Previous</button>
                          <span className="text-sm text-gray-500">Page {categoryPage} of {Math.ceil(categoryTotal / 60)}</span>
                          <button onClick={() => handleCategoryPageChange(categoryPage + 1)} disabled={categoryPage >= Math.ceil(categoryTotal / 60)} className="flex items-center gap-1 bg-gray-50 border border-border hover:bg-gray-100 transition-colors px-4 py-2 rounded-lg text-sm font-semibold text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed outline-none">Next</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
              {/* Category Sections */}
              {page === 1 && !search && (
                <div className="mb-4">
                  <CategorySection title="💻 Tech Jobs Near You" jobs={techJobs} onSeeAll={() => handleSeeAll("💻 Tech Jobs Near You")} userSkills={userSkills} onSave={saveToTracked} onMatch={(j: JobListing) => { const prompt = `Analyze my fit for the ${j.title} role at ${j.company}. Skills: ${j.skills.join(", ")}.`; navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`); }} />
                  <CategorySection title="🎓 Fresher & Internship" jobs={fresherJobs} onSeeAll={() => handleSeeAll("🎓 Fresher & Internship")} userSkills={userSkills} onSave={saveToTracked} onMatch={(j: JobListing) => { const prompt = `Analyze my fit for the ${j.title} role at ${j.company}. Skills: ${j.skills.join(", ")}.`; navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`); }} />
                  <CategorySection title="🌍 Remote Worldwide" jobs={remoteJobs} onSeeAll={() => handleSeeAll("🌍 Remote Worldwide")} userSkills={userSkills} onSave={saveToTracked} onMatch={(j: JobListing) => { const prompt = `Analyze my fit for the ${j.title} role at ${j.company}. Skills: ${j.skills.join(", ")}.`; navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`); }} />
                  <CategorySection title="🏢 Top Companies Hiring" jobs={topCompanyJobs} onSeeAll={() => handleSeeAll("🏢 Top Companies Hiring")} userSkills={userSkills} onSave={saveToTracked} onMatch={(j: JobListing) => { const prompt = `Analyze my fit for the ${j.title} role at ${j.company}. Skills: ${j.skills.join(", ")}.`; navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`); }} />
                </div>
              )}

              {/* Main Job Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {(feedSubTab === "for-you"
                  ? feedJobs.filter(j => (j.match_score || 0) > 0).length > 0
                    ? feedJobs.filter(j => (j.match_score || 0) > 0)
                    : feedJobs
                  : feedSubTab === "remote"
                    ? feedJobs.filter(j => (j.location || "").toLowerCase().includes("remote"))
                    : feedJobs
                ).map((job) => (
                  <JobCard key={job.id} job={job} userSkills={userSkills} onSave={saveToTracked} onMatch={(j: JobListing) => { const prompt = `Analyze my fit for the ${j.title} role at ${j.company}. Skills: ${j.skills.join(", ")}.`; navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`); }} />
                ))}
              </div>

              {/* Pagination */}
              {Math.ceil(totalJobs / (getUserId() ? 50 : 40)) > 1 && (
                <div className="flex justify-center items-center gap-3 mt-12 mb-6">
                  <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="flex items-center gap-1 bg-gray-50 border border-border hover:bg-gray-100 transition-colors px-4 py-2 rounded-lg text-sm font-semibold text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed outline-none">Previous</button>
                  <div className="flex items-center gap-1.5 px-2">
                    {Array.from({ length: Math.min(5, Math.ceil(totalJobs / (getUserId() ? 50 : 40))) }, (_, i) => {
                      const perPage = getUserId() ? 50 : 40;
                      const totalPages = Math.ceil(totalJobs / perPage);
                      let pageNum: number;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (page <= 3) pageNum = i + 1;
                      else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = page - 2 + i;
                      return (
                        <button key={pageNum} onClick={() => handlePageChange(pageNum)}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-bold transition-all outline-none ${page === pageNum ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-gray-50 border border-border text-gray-600 hover:bg-gray-100 hover:text-white"}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => handlePageChange(page + 1)} disabled={page === Math.ceil(totalJobs / (getUserId() ? 50 : 40))} className="flex items-center gap-1 bg-gray-50 border border-border hover:bg-gray-100 transition-colors px-4 py-2 rounded-lg text-sm font-semibold text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed outline-none">Next</button>
                </div>
              )}
              </>
              )}
            </>
          )}
        </TabsContent>

        {/* TRACKED JOBS CONTENT */}
        <TabsContent value="tracked" className="flex-1 mt-0 outline-none">
          {loadingTracked ? (
            <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 items-start pb-10">
              {COLUMNS.map((col) => {
                const colJobs = trackedJobs.filter(j => j.status === col.status);
                return (
                  <div key={col.name} className="flex-1 min-w-[300px] w-full">
                    <div className="flex items-center justify-between mb-5 px-1">
                      <div className="flex items-center gap-2.5">
                        <h3 className={`font-display font-bold text-lg ${col.color}`}>{col.name}</h3>
                        <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-md">{colJobs.length}</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {colJobs.map((job) => (
                        <div key={job.id} className="glass-card-hover p-5 cursor-pointer group relative">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3.5 min-w-0 pr-4">
                              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-500 font-display font-bold text-base uppercase shrink-0">{job.company.charAt(0)}</div>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <h4 className="text-foreground font-semibold text-[15px] leading-snug group-hover:text-blue-500 transition-colors truncate">{job.role}</h4>
                                <p className="text-gray-500 font-medium text-[13px] tracking-wide truncate">{job.company}</p>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); toggleStar(job.id, job.starred); }} className="outline-none shrink-0 group/star">
                              <Star className={`w-5 h-5 shrink-0 transition-all ${job.starred ? "text-blue-500 fill-blue-500" : "text-gray-400 group-hover/star:text-gray-500"}`} />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
                            <div className="flex items-center gap-1.5 text-gray-500 text-[12px] font-medium"><MapPin className="w-3.5 h-3.5 text-gray-400" /> <span className="truncate">{job.location}</span></div>
                            <div className="flex items-center gap-1.5 text-gray-500 text-[12px] font-medium"><DollarSign className="w-3.5 h-3.5 text-gray-400" /> <span className="truncate">{job.salary}</span></div>
                          </div>
                          <div className="flex items-center justify-between mb-5">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                              {job.match_score || 0}% MATCH
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-400 text-[11px] font-medium"><Clock className="w-3 h-3" /> {formatTimeAgo(job.created_at)}</div>
                          </div>
                          <div className="flex justify-between items-center border-t border-border pt-4 mt-1">
                            <button onClick={() => { const prompt = `Act as my AI interview coach for the **${job.role}** role at **${job.company}**. Ask me a typical interview question.`; navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`); }}
                              className="flex items-center gap-1.5 text-cyan-500 font-semibold text-[13px] hover:underline outline-none">
                              <Bot className="w-4 h-4" /> AI Coach
                            </button>
                            <a href={job.job_url || "#"} target={job.job_url ? "_blank" : "_self"} rel="noreferrer"
                              onClick={(e) => { if (!job.job_url) { e.preventDefault(); toast.error("No link available"); } }}
                              className="flex items-center gap-1.5 text-gray-500 font-medium text-[13px] hover:text-gray-600 outline-none transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" /> View JD
                            </a>
                          </div>
                        </div>
                      ))}
                      {colJobs.length === 0 && (
                        <div className="border border-dashed border-border rounded-2xl p-6 text-center text-gray-400 text-[13px] font-medium flex items-center justify-center min-h-[120px]">Drop jobs here</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
