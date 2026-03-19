import { useState, useEffect, useRef } from "react";
import { Star, MapPin, DollarSign, Clock, Bot, ExternalLink, Filter, ChevronDown, BookmarkPlus, Search, Briefcase, Navigation } from "lucide-react";
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
  { name: "Saved", status: "Saved", color: "text-white-60" },
  { name: "Applied", status: "Applied", color: "text-blue-electric" },
  { name: "Interview", status: "Interview", color: "text-cyan-spark" },
  { name: "Offer", status: "Offer", color: "text-emerald-400" },
];

export default function Jobs() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("feed");
  const [feedJobs, setFeedJobs] = useState<JobListing[]>([]);
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingTracked, setLoadingTracked] = useState(true);

  // Pagination & Filters State
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");

  // Geolocation state
  const [geoLocation, setGeoLocation] = useState<GeoLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<"detecting" | "detected" | "denied" | "idle">("idle");
  const geoDetectedRef = useRef(false);

  useEffect(() => {
    // Step 1: Try browser geolocation first
    setGeoStatus("detecting");
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            // Reverse geocode to get city name
            const geoData = await api.get<{
              city: string;
              state: string;
              country: string;
              country_code: string;
            }>(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);

            const geo: GeoLocation = {
              city: geoData.city,
              state: geoData.state,
              country: geoData.country,
              country_code: geoData.country_code,
              lat: latitude,
              lon: longitude,
            };
            
            setGeoLocation(geo);
            setGeoStatus("detected");
            geoDetectedRef.current = true;

            // Auto-populate location with detected city
            setLocation(geo.city);
            setPreferredLocation(geo.country);
            
            // Fetch jobs with detected location
            fetchFeedJobs(true, 1, geo.country, geo.city, geo.country);
            toast.success(`📍 Location detected: ${geo.city}, ${geo.country}`);
          } catch (err) {
            console.warn("Reverse geocode failed, falling back to timezone:", err);
            fallbackToTimezone();
          }
        },
        (_error) => {
          // Geolocation denied or unavailable — fall back to timezone
          console.log("Geolocation denied, falling back to timezone detection");
          setGeoStatus("denied");
          fallbackToTimezone();
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 600000, // Cache for 10 minutes
        }
      );
    } else {
      fallbackToTimezone();
    }

    fetchTrackedJobs();
  }, []);

  const fallbackToTimezone = () => {
    // Original timezone-based detection
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isIndia = (tz === "Asia/Calcutta" || tz === "Asia/Kolkata");
    const initPrefLoc = isIndia ? "India" : "";
    setPreferredLocation(initPrefLoc);
    setGeoStatus("denied");
    fetchFeedJobs(true, 1, initPrefLoc);
  };

  const fetchFeedJobs = async (
    reset = false,
    currentPage = 1,
    forcePrefLoc?: string,
    city?: string,
    country?: string
  ) => {
    setLoadingFeed(true);
    if (reset) {
      setPage(1);
    }

    try {
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "20" });
      if (search) params.append("query", search);
      if (location) params.append("location", location);
      if (experience) params.append("experience_max", experience);
      if (skills) params.append("skills", skills);

      // Add geolocation data
      const resolvedPrefLoc = forcePrefLoc !== undefined ? forcePrefLoc : preferredLocation;
      if (resolvedPrefLoc) params.append("preferred_location", resolvedPrefLoc);

      const resolvedCity = city || geoLocation?.city || "";
      const resolvedCountry = country || geoLocation?.country || "";
      if (resolvedCity) params.append("city", resolvedCity);
      if (resolvedCountry) params.append("country", resolvedCountry);
      if (geoLocation?.lat) params.append("lat", geoLocation.lat.toString());
      if (geoLocation?.lon) params.append("lon", geoLocation.lon.toString());

      const res = await api.get<{ jobs: JobListing[], total: number }>(`/api/job-listings?${params.toString()}`);
      
      setFeedJobs(res.jobs || []);
      setTotalJobs(res.total || 0);
      setPage(currentPage);
    } catch (error) {
      console.error("Failed to fetch job feed:", error);
      toast.error("Failed to load real-time job feed");
    } finally {
      setLoadingFeed(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleApplyFilters = () => {
    fetchFeedJobs(true, 1);
  };

  const handlePageChange = (newPage: number) => {
    const totalPages = Math.ceil(totalJobs / 20);
    if (newPage < 1 || newPage > totalPages) return;
    fetchFeedJobs(false, newPage);
  };

  const fetchTrackedJobs = async () => {
    setLoadingTracked(true);
    try {
      const res = await api.get<{ jobs: TrackedJob[] }>("/api/jobs");
      setTrackedJobs(res.jobs || []);
    } catch (error) {
      console.error("Failed to fetch tracked jobs:", error);
      toast.error("Failed to load tracked applications");
    } finally {
      setLoadingTracked(false);
    }
  };

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not specified";
    if (min && !max) return `$${Math.round(min / 1000)}k+`;
    if (!min && max) return `Up to $${Math.round(max / 1000)}k`;
    return `$${Math.round(min! / 1000)}k - $${Math.round(max! / 1000)}k`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const hours = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const calculateStats = () => {
    if (trackedJobs.length === 0) return STATS;
    
    const active = trackedJobs.filter(j => j.status === "Applied" || j.status === "Interview").length;
    const interviews = trackedJobs.filter(j => j.status === "Interview").length;
    const offers = trackedJobs.filter(j => j.status === "Offer").length;
    const applied = trackedJobs.filter(j => j.status === "Applied" || j.status === "Interview" || j.status === "Offer").length;
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
        company: job.company,
        role: job.title,
        location: job.location || "Remote",
        salary: formatSalary(job.salary_min, job.salary_max),
        status: "Saved",
        match_score: 85, // Mock initial score
        job_description: job.description,
        job_url: job.job_url,
      });
      toast.success("Job saved to Tracked Applications!");
      fetchTrackedJobs();
    } catch (error) {
      toast.error("Failed to save job");
    }
  };

  const toggleStar = async (id: string, currentStarred: boolean) => {
    try {
      await api.patch(`/api/jobs/${id}`, { starred: !currentStarred });
      setTrackedJobs(jobs => jobs.map(j => j.id === id ? { ...j, starred: !currentStarred } : j));
    } catch (error) {
      toast.error("Failed to update job");
    }
  };

  const handleDetectLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setGeoStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const geoData = await api.get<{
            city: string;
            state: string;
            country: string;
            country_code: string;
          }>(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);

          const geo: GeoLocation = {
            city: geoData.city,
            state: geoData.state,
            country: geoData.country,
            country_code: geoData.country_code,
            lat: latitude,
            lon: longitude,
          };
          setGeoLocation(geo);
          setGeoStatus("detected");
          setLocation(geo.city);
          setPreferredLocation(geo.country);
          toast.success(`📍 Location updated: ${geo.city}, ${geo.country}`);
          fetchFeedJobs(true, 1, geo.country, geo.city, geo.country);
        } catch {
          toast.error("Failed to detect location");
          setGeoStatus("denied");
        }
      },
      () => {
        toast.error("Location access denied. Please allow location access in your browser settings.");
        setGeoStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const displayStats = calculateStats();

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-[2rem] font-bold text-foreground mb-1.5 tracking-tight">Jobs Pipeline</h1>
        <p className="text-white-60 text-[15px] font-medium">Discover new opportunities and track your applications.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
        {/* Stats & Filters Row */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 w-full">
          <TabsList className="bg-surface-1 border border-white/[0.06] p-1 h-auto rounded-full w-full max-w-sm">
            <TabsTrigger value="feed" className="rounded-full px-6 py-2.5 text-[14px] data-[state=active]:bg-blue-electric data-[state=active]:text-white">
              Real-time Feed
            </TabsTrigger>
            <TabsTrigger value="tracked" className="rounded-full px-6 py-2.5 text-[14px] data-[state=active]:bg-blue-electric data-[state=active]:text-white">
              Tracked Apps {trackedJobs.length > 0 && `(${trackedJobs.length})`}
            </TabsTrigger>
          </TabsList>

          {activeTab === "tracked" && (
            <div className="flex gap-4 overflow-x-auto scrollbar-hide py-1">
              {displayStats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-white/[0.06] shadow-sm bg-surface-1 shrink-0">
                  <span className="text-[1.1rem]">{stat.icon}</span>
                  <span className="text-white-60 font-medium text-[13px]">{stat.label}:</span>
                  <span className="text-blue-electric font-bold text-[15px]">{stat.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FEED CONTENT */}
        <TabsContent value="feed" className="flex-1 mt-0 outline-none flex flex-col">
          {/* LOCATION DETECTION BANNER */}
          {geoStatus === "detected" && geoLocation && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[13px] font-medium">
              <Navigation className="w-4 h-4 shrink-0" />
              <span>
                📍 Showing jobs near <strong>{geoLocation.city}, {geoLocation.country}</strong> — nearby jobs appear first
              </span>
              <button
                onClick={() => { setLocation(""); setGeoLocation(null); setGeoStatus("idle"); handleApplyFilters(); }}
                className="ml-auto text-emerald-400/60 hover:text-emerald-400 text-[12px] font-semibold underline underline-offset-2 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
          {geoStatus === "detecting" && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-blue-electric/10 border border-blue-electric/20 rounded-xl text-blue-electric text-[13px] font-medium">
              <div className="animate-spin w-4 h-4 border-2 border-blue-electric border-t-transparent rounded-full shrink-0" />
              <span>Detecting your location for nearby jobs...</span>
            </div>
          )}

          {/* SEARCH & FILTERS BAR */}
          <div className="bg-surface-1 border border-white/[0.06] rounded-2xl p-5 mb-8 flex flex-col lg:flex-row gap-4 lg:items-end w-full shadow-lg">
            <div className="flex-1 space-y-1.5 min-w-[200px]">
              <label className="text-[12px] font-bold text-white-40 uppercase tracking-widest px-1">Search Role / Company</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white-30" />
                <input 
                  type="text" 
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. React Developer, Swiggy" 
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-white-30 focus:outline-none focus:border-blue-electric/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                />
              </div>
            </div>
            <div className="w-full lg:w-[220px] space-y-1.5">
              <label className="text-[12px] font-bold text-white-40 uppercase tracking-widest px-1">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white-30" />
                <input 
                  type="text" 
                  value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. London, Tokyo, Remote" 
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-white-30 focus:outline-none focus:border-blue-electric/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                />
                <button
                  onClick={handleDetectLocation}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white-30 hover:text-blue-electric transition-colors p-1 rounded"
                  title="Detect my location"
                >
                  <Navigation className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="w-full lg:w-[150px] space-y-1.5">
              <label className="text-[12px] font-bold text-white-40 uppercase tracking-widest px-1">Experience</label>
              <div className="relative">
                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white-30" />
                <input 
                  type="number" min="0" max="20"
                  value={experience} onChange={(e) => setExperience(e.target.value)}
                  placeholder="Max Years" 
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-white-30 focus:outline-none focus:border-blue-electric/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                />
              </div>
            </div>
            <div className="w-full lg:w-[200px] space-y-1.5">
              <label className="text-[12px] font-bold text-white-40 uppercase tracking-widest px-1">Skills (Comma sep)</label>
              <div className="relative">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white-30" />
                <input 
                  type="text" 
                  value={skills} onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. React, Node.js" 
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-white-30 focus:outline-none focus:border-blue-electric/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                />
              </div>
            </div>
            <button 
              onClick={handleApplyFilters}
              className="w-full lg:w-auto bg-blue-electric hover:bg-blue-bright text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-md shadow-blue-electric/20 active:scale-95 flex items-center justify-center"
            >
              Search Jobs
            </button>
          </div>

          {loadingFeed ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-blue-electric border-t-transparent rounded-full" />
            </div>
          ) : feedJobs.length === 0 ? (
            <div className="text-center py-20 bg-surface-1 border border-white/[0.06] rounded-2xl">
              <h3 className="text-lg font-medium text-white-80">No jobs match your filters</h3>
              <p className="text-white-60 mt-2">Try adjusting your search criteria broadly to find more roles.</p>
              <button onClick={() => { setSearch(""); setLocation(""); setExperience(""); setSkills(""); setTimeout(() => handleApplyFilters(), 50); }} className="mt-4 text-blue-electric hover:underline text-sm font-medium">Clear Filters</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {feedJobs.map((job) => (
                  <div key={job.id} className="glass-card-hover p-5 flex flex-col group relative">
                    <div className="absolute top-4 right-4">
                      <span className={`text-white-60 text-[10px] font-bold px-2 py-1 rounded capitalize tracking-wider flex items-center gap-1 ${
                        job.source === "jsearch" ? "bg-emerald-500/15 text-emerald-400" : "bg-surface-3"
                      }`}>
                        {job.source === "jsearch" ? "🌐 Global" : job.source}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3.5 mb-4 mt-2">
                      <div className="w-12 h-12 rounded-xl bg-blue-electric/15 flex items-center justify-center text-blue-electric font-display font-bold text-lg uppercase shrink-0">
                        {job.company.charAt(0)}
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0 pr-16">
                        <h4 className="text-foreground font-semibold text-[16px] leading-snug group-hover:text-blue-electric transition-colors truncate" title={job.title}>{job.title}</h4>
                        <p className="text-white-40 font-medium text-[14px] truncate" title={job.company}>{job.company}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 mb-5 flex-1">
                      <div className="flex items-center gap-2 text-white-60 text-[13px] font-medium">
                        <MapPin className="w-4 h-4 shrink-0 text-white-30" /> <span className="truncate">{job.location || "Remote"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white-60 text-[13px] font-medium">
                        <DollarSign className="w-4 h-4 shrink-0 text-white-30" /> 
                        <span className="truncate">{formatSalary(job.salary_min, job.salary_max)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {job.skills.slice(0, 3).map(skill => (
                          <span key={skill} className="bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded text-[11px] text-white-60">
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 3 && (
                          <span className="bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded text-[11px] text-white-40">
                            +{job.skills.length - 3}
                          </span>
                        )}
                        {job.skills.length === 0 && (
                          <span className="text-white-30 italic text-[11px]">No specific skills tagged</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 mt-auto">
                      <div className="flex flex-col gap-0.5">
                         <div className="flex items-center gap-1.5 text-white-40 text-[11px] font-medium">
                           <Clock className="w-3.5 h-3.5" /> {formatTimeAgo(job.posted_at)}
                         </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button 
                          onClick={() => saveToTracked(job)}
                          className="text-white-60 hover:text-cyan-spark transition-colors flex items-center justify-center p-2 rounded-lg hover:bg-cyan-spark/10 outline-none"
                          title="Save to Tracked Apps"
                        >
                          <BookmarkPlus className="w-4.5 h-4.5" />
                        </button>
                        <button 
                          onClick={() => {
                            const prompt = `Analyze my fit for the ${job.title} role at ${job.company}. Here are the required skills: ${job.skills.join(", ")}.`;
                            navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`);
                          }}
                          className="text-white-60 hover:text-purple-400 transition-colors flex items-center justify-center p-2 rounded-lg hover:bg-purple-400/10 outline-none"
                          title="Match Score via AI"
                        >
                          <Bot className="w-4.5 h-4.5" />
                        </button>
                        <a 
                          href={job.job_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-blue-electric font-bold text-[13px] hover:text-white group/link outline-none transition-colors px-4 py-2 bg-blue-electric/10 hover:bg-blue-electric rounded-lg"
                        >
                          Apply Now <ExternalLink className="w-3.5 h-3.5 flex-none" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Numbered Pagination */}
              {Math.ceil(totalJobs / 20) > 1 && (
                <div className="flex justify-center items-center gap-3 mt-12 mb-6">
                  <button 
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="flex items-center gap-1 bg-surface-2 border border-white/[0.06] hover:bg-surface-3 transition-colors px-4 py-2 rounded-lg text-sm font-semibold text-white-80 disabled:opacity-50 disabled:cursor-not-allowed outline-none"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1.5 px-2">
                    {Array.from({ length: Math.min(5, Math.ceil(totalJobs / 20)) }, (_, i) => {
                      const totalPages = Math.ceil(totalJobs / 20);
                      let pageNum = page;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-bold transition-all outline-none ${
                            page === pageNum 
                              ? "bg-blue-electric text-white shadow-lg shadow-blue-electric/20" 
                              : "bg-surface-2 border border-white/[0.06] text-white-60 hover:bg-surface-3 hover:text-white"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button 
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === Math.ceil(totalJobs / 20)}
                    className="flex items-center gap-1 bg-surface-2 border border-white/[0.06] hover:bg-surface-3 transition-colors px-4 py-2 rounded-lg text-sm font-semibold text-white-80 disabled:opacity-50 disabled:cursor-not-allowed outline-none"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* TRACKED JOBS CONTENT */}
        <TabsContent value="tracked" className="flex-1 mt-0 outline-none">
          {loadingTracked ? (
             <div className="flex items-center justify-center py-20">
               <div className="animate-spin w-8 h-8 border-2 border-blue-electric border-t-transparent rounded-full" />
             </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 items-start pb-10">
              {COLUMNS.map((col) => {
                const colJobs = trackedJobs.filter(j => j.status === col.status);
                return (
                  <div key={col.name} className="flex-1 min-w-[300px] w-full">
                    <div className="flex items-center justify-between mb-5 px-1">
                      <div className="flex items-center gap-2.5">
                        <h3 className={`font-display font-bold text-lg ${col.color}`}>{col.name}</h3>
                        <span className="bg-surface-3 text-white-40 text-xs font-bold px-2 py-0.5 rounded-md">{colJobs.length}</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {colJobs.map((job) => (
                        <div key={job.id} className="glass-card-hover p-5 cursor-pointer group relative">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3.5 min-w-0 pr-4">
                              <div className="w-10 h-10 rounded-xl bg-blue-electric/15 flex items-center justify-center text-blue-electric font-display font-bold text-base uppercase shrink-0">
                                {job.company.charAt(0)}
                              </div>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <h4 className="text-foreground font-semibold text-[15px] leading-snug group-hover:text-blue-electric transition-colors truncate">{job.role}</h4>
                                <p className="text-white-40 font-medium text-[13px] tracking-wide truncate">{job.company}</p>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); toggleStar(job.id, job.starred); }} className="outline-none shrink-0 group/star">
                              <Star className={`w-5 h-5 shrink-0 transition-all ${job.starred ? "text-blue-electric fill-blue-electric" : "text-white-30 group-hover/star:text-white-40"}`} />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
                            <div className="flex items-center gap-1.5 text-white-40 text-[12px] font-medium">
                              <MapPin className="w-3.5 h-3.5 text-white-30" /> <span className="truncate">{job.location}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-white-40 text-[12px] font-medium">
                              <DollarSign className="w-3.5 h-3.5 text-white-30" /> <span className="truncate">{job.salary}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-5">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                              {job.match_score || Math.floor(Math.random() * 20 + 75)}% MATCH
                            </div>
                            <div className="flex items-center gap-1.5 text-white-30 text-[11px] font-medium">
                              <Clock className="w-3 h-3" /> {formatTimeAgo(job.created_at)}
                            </div>
                          </div>
                          <div className="flex justify-between items-center border-t border-white/[0.06] pt-4 mt-1">
                            <button 
                              onClick={() => {
                                const prompt = `Act as my AI interview coach. I am preparing for an interview for the **${job.role}** role at **${job.company}**. Ask me a typical interview question for this role, and then evaluate my answer.`;
                                navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`);
                              }}
                              className="flex items-center gap-1.5 text-cyan-spark font-semibold text-[13px] hover:underline outline-none"
                            >
                              <Bot className="w-4 h-4" /> AI Coach
                            </button>
                            <a 
                              href={job.job_url || "#"} 
                              target={job.job_url ? "_blank" : "_self"}
                              rel="noreferrer"
                              onClick={(e) => { if (!job.job_url) { e.preventDefault(); toast.error("No link available for this tracked job"); } }}
                              className="flex items-center gap-1.5 text-white-40 font-medium text-[13px] hover:text-white-60 group/jd outline-none transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover/jd:-translate-y-0.5 group-hover/jd:translate-x-0.5" /> View JD
                            </a>
                          </div>
                        </div>
                      ))}
                      
                      {colJobs.length === 0 && (
                        <div className="border border-dashed border-white/[0.08] rounded-2xl p-6 text-center text-white-30 text-[13px] font-medium flex items-center justify-center min-h-[120px]">
                          Drop jobs here
                        </div>
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
