import { useState, useEffect, useRef } from "react";
import { Star, MapPin, DollarSign, Clock, Bot, ExternalLink, Filter, ChevronDown, BookmarkPlus, Search, Briefcase, Navigation, Info, Shield, AlertTriangle, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

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
  seniority_level?: string;
  match_score?: number;
  confidence_score?: number;
  is_active?: boolean;
  category?: string;
  matched_skills?: string[];
  skill_gap?: string[];
  selection_chance?: number;
  selection_reason?: string;
  // ── Domain-aware fields (v3.0) ──
  job_domain?: string;
  job_domain_label?: string;
  relevance_score?: number;
  domain_match?: boolean;
  shortlisting_chance?: number;
  shortlisting_band?: string;
  shortlisting_reason?: string;
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

interface ApiMeta {
  user_domain: string;
  user_domain_label: string;
  total_primary: number;
  total_cross: number;
  relevance_threshold: number;
  user_skills_count: number;
  related_domains?: { domain: string; label: string }[];
}

// ── Legacy API response (anonymous users) ──
interface LegacyApiResponse {
  jobs: JobListing[];
  total: number;
  user_skills?: string[];
}

// ── Domain-aware API response (authenticated users) ──
interface DomainAwareApiResponse {
  primary_jobs: JobListing[];
  cross_domain_jobs: JobListing[];
  meta: ApiMeta;
  user_skills?: string[];
}

type ApiResponse = LegacyApiResponse | DomainAwareApiResponse;

function isDomainAwareResponse(res: ApiResponse): res is DomainAwareApiResponse {
  return "primary_jobs" in res && "meta" in res;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

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

// Domain → section header emoji + title
const DOMAIN_SECTION_TITLES: Record<string, { emoji: string; title: string }> = {
  "data-science-ml": { emoji: "🧠", title: "Data Science & ML Roles Near You" },
  "data-analytics": { emoji: "📊", title: "Data Analytics Roles Near You" },
  "frontend": { emoji: "⚛️", title: "Frontend Roles Near You" },
  "backend": { emoji: "🔧", title: "Backend Roles Near You" },
  "mobile": { emoji: "📱", title: "Mobile Development Roles Near You" },
  "devops": { emoji: "☁️", title: "DevOps & Cloud Roles Near You" },
  "generic-fresher": { emoji: "🎓", title: "Fresher & Entry-Level Roles Near You" },
};

// ═══════════════════════════════════════════════════════════════
// BADGE COMPONENTS
// ═══════════════════════════════════════════════════════════════

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

function ActivityBadge({ postedAt }: { postedAt: string }) {
  const daysAgo = Math.floor((Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 7) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">🟢 Active</span>;
  if (daysAgo >= 30) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">🕐 Closing soon</span>;
  return null;
}

// ── Domain Pill — shows if job is in/outside user's domain ──
function DomainPill({ job, userDomain, userDomainLabel }: { job: JobListing; userDomain?: string; userDomainLabel?: string }) {
  if (!userDomain || !job.job_domain) return null;
  const isMatch = job.domain_match ?? (job.job_domain === userDomain);
  if (isMatch) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
        ✅ Matches your domain: {userDomainLabel || userDomain}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 flex items-center gap-1">
      ↗️ {job.job_domain_label || job.job_domain}
    </span>
  );
}

// ── Shortlisting Band Badge ──
function ShortlistBadge({ band, chance, reason }: { band?: string; chance?: number; reason?: string }) {
  if (!band || !chance || chance <= 0) return null;
  const [showTip, setShowTip] = useState(false);
  const config: Record<string, { emoji: string; cls: string; bgCls: string }> = {
    "High": { emoji: "🔥", cls: "text-emerald-400", bgCls: "bg-emerald-500/15 border-emerald-500/20" },
    "Medium": { emoji: "✨", cls: "text-blue-400", bgCls: "bg-blue-500/15 border-blue-500/20" },
    "Low": { emoji: "💡", cls: "text-yellow-400", bgCls: "bg-yellow-500/15 border-yellow-500/20" },
    "Very Low": { emoji: "📊", cls: "text-gray-400", bgCls: "bg-gray-500/15 border-gray-500/20" },
  };
  const c = config[band] || config["Very Low"];
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.bgCls} ${c.cls} flex items-center gap-1 cursor-help`}
      >
        {c.emoji} Shortlisting: {band}
      </button>
      {showTip && reason && (
        <div className="absolute bottom-7 left-0 z-50 w-56 bg-gray-50 border border-border rounded-xl p-3 shadow-xl text-[11px] text-gray-700">
          <p className="font-bold text-gray-800 mb-1">Shortlisting Chance: {chance}%</p>
          <p>{reason}</p>
        </div>
      )}
    </div>
  );
}

// ── "Why this job?" Tooltip ───────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// JOB CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

export function JobCard({ job, userSkills, onSave, onMatch, userDomain, userDomainLabel }: {
  job: JobListing;
  userSkills: string[];
  onSave: (j: JobListing) => void;
  onMatch: (j: JobListing) => void;
  userDomain?: string;
  userDomainLabel?: string;
}) {
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

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <SeniorityBadge level={job.seniority_level} />
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

// ═══════════════════════════════════════════════════════════════
// MAIN JOBS PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Jobs() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("feed");

  // ── Domain-aware state ──
  const [primaryJobs, setPrimaryJobs] = useState<JobListing[]>([]);
  const [crossDomainJobs, setCrossDomainJobs] = useState<JobListing[]>([]);
  const [userDomain, setUserDomain] = useState<string | null>(null);
  const [userDomainLabel, setUserDomainLabel] = useState<string | null>(null);
  const [showCrossDomain, setShowCrossDomain] = useState(true);
  const [hasDomainData, setHasDomainData] = useState(false);

  // ── Legacy state (anonymous / backward compat) ──
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

  const [geoLocation, setGeoLocation] = useState<GeoLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<"detecting" | "detected" | "denied" | "idle">("idle");
  const geoDetectedRef = useRef(false);

  // Get user ID from localStorage
  const getUserId = () => {
    try {
      const token = localStorage.getItem("auth_token");
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
      const defaultLimit = overrides?.category ? "60" : (getUserId() ? "300" : "40");
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

      const res = await api.get<ApiResponse>(`/api/job-listings?${params.toString()}`);

      // Handle domain-aware response vs legacy response
      if (isDomainAwareResponse(res)) {
        setPrimaryJobs(res.primary_jobs || []);
        setCrossDomainJobs(res.cross_domain_jobs || []);
        setUserDomain(res.meta.user_domain);
        setUserDomainLabel(res.meta.user_domain_label);
        setHasDomainData(true);
        setTotalJobs(res.meta.total_primary + res.meta.total_cross);
        // Also set feedJobs for backward compat (used by some sub-components)
        setFeedJobs([...res.primary_jobs, ...res.cross_domain_jobs]);
      } else {
        // Legacy response (anonymous)
        setFeedJobs(res.jobs || []);
        setTotalJobs(res.total || 0);
        setHasDomainData(false);
        setPrimaryJobs([]);
        setCrossDomainJobs([]);
        setUserDomain(null);
        setUserDomainLabel(null);
      }

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

  const fetchTrackedJobs = async () => {
    setLoadingTracked(true);
    try {
      const res = await api.get<{ jobs: TrackedJob[] }>("/api/jobs");
      setTrackedJobs(res.jobs || []);
    } catch {
      toast.error("Failed to load tracked applications");
    } finally { setLoadingTracked(false); }
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

  const onMatchJob = (j: JobListing) => {
    const prompt = `Analyze my fit for the ${j.title} role at ${j.company}. Skills: ${(j.skills || []).join(", ")}.`;
    navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`);
  };

  const displayStats = calculateStats();

  // Get primary section title
  const primarySectionTitle = (() => {
    if (!userDomain) return "✨ Top Matches For You";
    const config = DOMAIN_SECTION_TITLES[userDomain];
    if (config) return `${config.emoji} ${config.title}`;
    return "✨ Top Matches For You";
  })();

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
          {/* Domain toggle + Location detection banner */}
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {/* No sub-tabs needed in domain-aware mode — primary/cross split replaces them */}
            </div>
            {/* Cross-domain toggle */}
            {hasDomainData && (
              <button
                onClick={() => setShowCrossDomain(!showCrossDomain)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold transition-all border ${
                  showCrossDomain
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    : "bg-gray-50 text-gray-500 border-border hover:bg-gray-100"
                }`}
              >
                {showCrossDomain ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                Include jobs outside your domain
              </button>
            )}
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
          ) : (primaryJobs.length === 0 && crossDomainJobs.length === 0 && feedJobs.length === 0) ? (
            <div className="text-center py-20 bg-white border border-border rounded-2xl">
              <h3 className="text-lg font-medium text-gray-800">No jobs match your filters</h3>
              <p className="text-gray-600 mt-2">Try adjusting your search criteria broadly to find more roles.</p>
              <button onClick={() => { setSearch(""); setLocation(""); setExperience(""); setSkills(""); fetchFeedJobs(true, 1, undefined, undefined, undefined, { query: "", location: "", experience: "", skills: "", category: "" }); }} className="mt-4 text-blue-500 hover:underline text-sm font-medium">Clear Filters</button>
            </div>
          ) : hasDomainData ? (
            <>
              {/* ═══════════════════════════════════════════════════ */}
              {/* SECTION 1: PRIMARY DOMAIN JOBS                     */}
              {/* ═══════════════════════════════════════════════════ */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{primarySectionTitle}</h2>
                    <p className="text-gray-500 text-[13px] mt-0.5">
                      {primaryJobs.length > 0
                        ? `${primaryJobs.length} jobs matching your ${userDomainLabel || "domain"} profile`
                        : `No strong matches in ${userDomainLabel || "your domain"} yet`
                      }
                    </p>
                  </div>
                </div>

                {primaryJobs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {primaryJobs.map((job) => (
                      <JobCard key={job.id} job={job} userSkills={userSkills} onSave={saveToTracked} onMatch={onMatchJob} userDomain={userDomain || undefined} userDomainLabel={userDomainLabel || undefined} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-200/30 rounded-2xl p-8 text-center">
                    <div className="text-3xl mb-3">🔍</div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      We didn't find strong matches in {userDomainLabel || "your domain"} yet
                    </h3>
                    <p className="text-gray-500 text-[14px] max-w-md mx-auto">
                      Try broadening your location or check back later — new jobs are fetched every 15 minutes.
                      Meanwhile, here are other tech roles near you.
                    </p>
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════ */}
              {/* SECTION 2: CROSS-DOMAIN JOBS                       */}
              {/* ═══════════════════════════════════════════════════ */}
              {showCrossDomain && crossDomainJobs.length > 0 && (
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">🌐 Other Tech Roles Near You</h2>
                      <p className="text-gray-500 text-[13px] mt-0.5">
                        Outside your main domain — explore broader opportunities ({crossDomainJobs.length} jobs)
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {crossDomainJobs.map((job) => (
                      <JobCard key={job.id} job={job} userSkills={userSkills} onSave={saveToTracked} onMatch={onMatchJob} userDomain={userDomain || undefined} userDomainLabel={userDomainLabel || undefined} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ═══════════════════════════════════════════════════ */}
              {/* LEGACY VIEW (anonymous / no domain data)           */}
              {/* ═══════════════════════════════════════════════════ */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {feedJobs.map((job) => (
                  <JobCard key={job.id} job={job} userSkills={userSkills} onSave={saveToTracked} onMatch={onMatchJob} />
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
