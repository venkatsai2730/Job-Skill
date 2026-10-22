import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Plus, Search, Calendar, DollarSign,
  MapPin, ExternalLink, Trash2, Edit3, ArrowRight,
  TrendingUp, Award, Clock, Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

export type ApplicationStage =
  | "Wishlist"
  | "Applied"
  | "Phone Screen"
  | "Technical"
  | "Final Round"
  | "Offer"
  | "Rejected";

export interface ApplicationItem {
  id: string;
  company: string;
  role: string;
  status: ApplicationStage;
  date_applied?: string;
  interview_progress?: string;
  created_at?: string;
  // Parsed metadata
  location?: string;
  salary?: string;
  job_url?: string;
  notes?: string;
}

const STAGES: { id: ApplicationStage; label: string; color: string; bg: string; dot: string }[] = [
  { id: "Wishlist", label: "Wishlist", color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", dot: "bg-slate-400" },
  { id: "Applied", label: "Applied", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400" },
  { id: "Phone Screen", label: "Phone Screen", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400" },
  { id: "Technical", label: "Technical Interview", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", dot: "bg-purple-400" },
  { id: "Final Round", label: "Final / Onsite", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", dot: "bg-cyan-400" },
  { id: "Offer", label: "Offer Received", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  { id: "Rejected", label: "Archived", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", dot: "bg-rose-400" },
];

export default function Applications() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ApplicationItem | null>(null);

  // Form State
  const [formCompany, setFormCompany] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formStatus, setFormStatus] = useState<ApplicationStage>("Applied");
  const [formLocation, setFormLocation] = useState("Remote");
  const [formSalary, setFormSalary] = useState("");
  const [formJobUrl, setFormJobUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ applications: any[] }>("/api/applications");
      const list: ApplicationItem[] = (res.applications || []).map((app) => {
        let parsedMeta: any = {};
        if (app.interview_progress) {
          try {
            parsedMeta = typeof app.interview_progress === "string" ? JSON.parse(app.interview_progress) : app.interview_progress;
          } catch {
            parsedMeta = { notes: app.interview_progress };
          }
        }
        return {
          id: app.id,
          company: app.company,
          role: app.role,
          status: (app.status as ApplicationStage) || "Applied",
          date_applied: app.date_applied,
          location: parsedMeta.location || "Remote",
          salary: parsedMeta.salary || "",
          job_url: parsedMeta.job_url || "",
          notes: parsedMeta.notes || "",
          created_at: app.created_at,
        };
      });
      setApplications(list);
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormCompany("");
    setFormRole("");
    setFormStatus("Applied");
    setFormLocation("Remote");
    setFormSalary("");
    setFormJobUrl("");
    setFormNotes("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ApplicationItem) => {
    setEditingItem(item);
    setFormCompany(item.company);
    setFormRole(item.role);
    setFormStatus(item.status);
    setFormLocation(item.location || "Remote");
    setFormSalary(item.salary || "");
    setFormJobUrl(item.job_url || "");
    setFormNotes(item.notes || "");
    setFormDate(item.date_applied || new Date().toISOString().split("T")[0]);
    setIsModalOpen(true);
  };

  const handleSaveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompany.trim() || !formRole.trim()) return;

    const payload = {
      company: formCompany.trim(),
      role: formRole.trim(),
      status: formStatus,
      date_applied: formDate,
      interview_progress: JSON.stringify({
        location: formLocation,
        salary: formSalary,
        job_url: formJobUrl,
        notes: formNotes,
      }),
    };

    try {
      if (editingItem) {
        await api.put(`/api/applications/${editingItem.id}`, payload);
      } else {
        await api.post("/api/applications", payload);
      }
      setIsModalOpen(false);
      fetchApplications();
    } catch (err: any) {
      alert(err.message || "Failed to save application");
    }
  };

  const handleMoveStage = async (item: ApplicationItem, nextStage: ApplicationStage) => {
    try {
      // Optimistic update
      setApplications((prev) =>
        prev.map((app) => (app.id === item.id ? { ...app, status: nextStage } : app))
      );
      await api.put(`/api/applications/${item.id}`, { status: nextStage });
    } catch (err) {
      console.error("Failed to update status:", err);
      fetchApplications();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this application from your tracker?")) return;
    try {
      setApplications((prev) => prev.filter((a) => a.id !== id));
      await api.delete(`/api/applications/${id}`);
    } catch (err) {
      console.error("Delete failed:", err);
      fetchApplications();
    }
  };

  // Filtered applications
  const filtered = applications.filter((app) => {
    const q = searchQuery.toLowerCase();
    return app.company.toLowerCase().includes(q) || app.role.toLowerCase().includes(q);
  });

  // Analytics Metrics
  const totalCount = applications.length;
  const inInterviewCount = applications.filter((a) =>
    ["Phone Screen", "Technical", "Final Round"].includes(a.status)
  ).length;
  const offerCount = applications.filter((a) => a.status === "Offer").length;
  const appliedCount = applications.filter((a) => a.status !== "Wishlist").length;
  const interviewRate = appliedCount > 0 ? Math.round((inInterviewCount / appliedCount) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Application Pipeline</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Live Kanban
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage your entire interview funnel in one place, auto-synced with the Chrome Extension.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search companies or roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-56 sm:w-64"
            />
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-sm shadow-blue-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Application</span>
          </button>
        </div>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Tracked</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Interviews</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{inInterviewCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interview Rate</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{interviewRate}%</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Offers Received</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{offerCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* KANBAN BOARD COLUMNS */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 items-start overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageItems = filtered.filter((a) => a.status === stage.id);
            return (
              <div
                key={stage.id}
                className="bg-card/60 backdrop-blur border border-border rounded-xl p-3 flex flex-col min-w-[260px] xl:min-w-0"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                    <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                      {stage.label}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground font-mono">
                    {stageItems.length}
                  </span>
                </div>

                {/* Cards in this Column */}
                <div className="space-y-3 min-h-[120px]">
                  {stageItems.length === 0 ? (
                    <div className="h-24 border border-dashed border-border/50 rounded-lg flex items-center justify-center text-muted-foreground/60 text-xs text-center p-2">
                      No jobs in {stage.label}
                    </div>
                  ) : (
                    stageItems.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-background border border-border/80 hover:border-blue-500/50 rounded-lg p-3.5 shadow-sm transition-all group relative"
                      >
                        {/* Company & Role */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-sm text-foreground group-hover:text-blue-400 transition-colors line-clamp-1">
                              {item.role}
                            </h4>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5">
                              {item.company}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              title="Edit"
                              className="p-1 hover:text-blue-400 text-muted-foreground"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              title="Delete"
                              className="p-1 hover:text-rose-400 text-muted-foreground"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          {item.location && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-muted/60 text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {item.location}
                            </span>
                          )}
                          {item.salary && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 font-medium">
                              <DollarSign className="w-3 h-3" />
                              {item.salary}
                            </span>
                          )}
                        </div>

                        {/* Notes snippet */}
                        {item.notes && (
                          <p className="text-[11px] text-muted-foreground/80 mt-2 line-clamp-2 bg-muted/30 p-1.5 rounded">
                            {item.notes}
                          </p>
                        )}

                        {/* Card Footer: Date & Quick Actions */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {item.date_applied || "Recently"}
                          </span>

                          <div className="flex items-center gap-2">
                            {item.job_url && (
                              <a
                                href={item.job_url}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-foreground"
                                title="Open Job Posting"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <Link
                              to={`/dashboard/interview-prep?company=${encodeURIComponent(item.company)}&role=${encodeURIComponent(item.role)}`}
                              className="hover:text-purple-400 flex items-center gap-0.5 text-purple-400 font-medium"
                              title="Prepare for Interview"
                            >
                              <Sparkles className="w-3 h-3" /> Prep
                            </Link>
                          </div>
                        </div>

                        {/* Stage Transition Selector */}
                        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between">
                          <select
                            value={item.status}
                            onChange={(e) => handleMoveStage(item, e.target.value as ApplicationStage)}
                            className="bg-muted text-[11px] text-muted-foreground rounded px-1.5 py-0.5 border border-border focus:outline-none"
                          >
                            {STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                → {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">
                  {editingItem ? "Edit Application" : "New Application"}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveApplication} className="space-y-3.5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stripe, Google, Linear"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Role / Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Frontend Engineer"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as ApplicationStage)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Date Applied</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Location</label>
                    <input
                      type="text"
                      placeholder="Remote / San Francisco"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Salary Expectation</label>
                    <input
                      type="text"
                      placeholder="$140k - $170k"
                      value={formSalary}
                      onChange={(e) => setFormSalary(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Job Link</label>
                  <input
                    type="url"
                    placeholder="https://boards.greenhouse.io/..."
                    value={formJobUrl}
                    onChange={(e) => setFormJobUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Notes / Recruiter Contact</label>
                  <textarea
                    rows={2}
                    placeholder="Met Sarah at tech meetup; spoke with hiring manager..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-sm"
                  >
                    {editingItem ? "Save Changes" : "Add to Pipeline"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
