import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { LayoutTemplate, Sparkles, Loader2, X, Plus, BookOpen, Briefcase, GraduationCap, Code2, FolderOpen, Shield, Filter } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface TemplateATSScores {
  greenhouse: number;
  lever: number;
  combined: number;
}

interface Template {
  id: string;
  name: string;
  category: "IT" | "Non-IT";
  description: string;
  previewUrl: string;
  isPopular?: boolean;
  atsScores?: TemplateATSScores;
  users?: number;
  image?: string;
  tags?: string[];
}

type FilterTab = "All" | "IT" | "Non-IT";

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");

  // Form State for Resume Builder
  const [isBuilding, setIsBuilding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    targetRole: "",
    experience: "",
    education: "",
    skills: "",
    projects: ""
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get<{ templates: Template[] }>("/api/templates");
      setTemplates(res.templates);
    } catch (err) {
      toast.error("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = activeFilter === "All"
    ? templates
    : templates.filter(t => t.category === activeFilter);

  const handleBuildResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    if (!formData.name || !formData.experience || !formData.skills) {
      toast.error("Please fill in at least Name, Experience, and Skills.");
      return;
    }

    setIsBuilding(true);
    try {
      // Create a clean JSON object for the AI
      const userData = {
        Contact: `${formData.name} | ${formData.email} | ${formData.phone}`,
        Objective: `Target Role: ${formData.targetRole}`,
        Experience: formData.experience,
        Education: formData.education,
        Skills: formData.skills,
        Projects: formData.projects
      };

      await api.post("/api/resume/create-new", {
        userData,
        templateType: selectedTemplate.id
      });

      toast.success("Resume created successfully!");
      navigate("/dashboard/resume"); // navigate to viewer to see the result
    } catch (err: any) {
      toast.error(err.message || "Failed to generate resume");
      setIsBuilding(false);
    }
  };

  const filterTabs: FilterTab[] = ["All", "IT", "Non-IT"];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Resume Templates</h1>
          <p className="text-gray-600 mt-1">Select an ATS-optimized template and let AI build your resume.</p>
        </div>

        {/* ── Category Filter Tabs ── */}
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-border">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeFilter === tab
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "text-gray-600 hover:text-foreground hover:bg-gray-100"
              }`}
            >
              {tab === "All" ? "All Templates" : tab}
              <span className="ml-1.5 text-xs opacity-70">
                ({tab === "All" ? templates.length : templates.filter(t => t.category === tab).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-600">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Filter className="w-8 h-8 text-gray-500" />
          <p className="text-gray-600">No templates found for this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredTemplates.map((tpl) => (
            <motion.div 
              key={tpl.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group glass-card rounded-2xl overflow-hidden flex flex-col hover:border-blue-500/40 transition-all cursor-pointer bg-white shadow-lg shadow-black/20"
              onClick={() => setSelectedTemplate(tpl)}
            >
              {/* Image Container */}
              <div className="aspect-[1/1.1] relative w-full border-b border-border overflow-hidden bg-gray-50">
                 {tpl.image ? (
                     <img src={tpl.image} alt={tpl.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                 ) : (
                     <div className="w-full h-full flex flex-col pt-8 px-8 items-center opacity-30 group-hover:opacity-70 transition-opacity">
                         <div className="w-2/3 h-4 bg-white-40 rounded mb-4"></div>
                         <div className="w-1/2 h-2 bg-white-20 rounded mb-6"></div>
                         <div className="w-full h-1 bg-blue-500/40 rounded mb-2"></div>
                         <div className="w-full h-1 bg-white-20 rounded mb-1"></div>
                         <div className="w-full h-1 bg-white-20 rounded mb-6"></div>
                         <div className="w-3/4 h-1 bg-white-20 rounded mb-1"></div>
                         <div className="w-full h-1 bg-white-20 rounded mb-1"></div>
                         <div className="w-5/6 h-1 bg-white-20 rounded mb-4"></div>
                         <div className="w-full h-1 bg-blue-500/40 rounded mb-2"></div>
                         <div className="w-full h-1 bg-white-20 rounded mb-1"></div>
                         <div className="w-2/3 h-1 bg-white-20 rounded"></div>
                     </div>
                 )}
                 
                {/* Gradient Overlay for Hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-5">
                  <button className="w-full py-3 bg-blue-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
                    <Sparkles className="w-4 h-4" /> Start Builder
                  </button>
                </div>
                
                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {/* Category Badge */}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg backdrop-blur w-fit border ${
                      tpl.category === "IT"
                        ? "bg-violet-500/90 text-white border-violet-400/20"
                        : "bg-amber-500/90 text-white border-amber-400/20"
                    }`}>
                      {tpl.category}
                    </span>

                    {/* ATS Score Badge */}
                    {tpl.atsScores && (
                        <span className="bg-emerald-500/90 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-emerald-400/20 flex items-center gap-1.5 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> {tpl.atsScores.combined}% ATS
                        </span>
                    )}
                    {tpl.isPopular && (
                      <span className="bg-blue-500/90 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg border border-blue-400/20 w-fit">Popular</span>
                    )}
                </div>

                {/* ATS Breakdown (top right) */}
                {tpl.atsScores && (
                  <div className="absolute top-4 right-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/70 backdrop-blur text-[9px] text-white px-2 py-0.5 rounded flex items-center gap-1.5">
                      <Shield className="w-2.5 h-2.5 text-emerald-400" /> Greenhouse: {tpl.atsScores.greenhouse}%
                    </div>
                    <div className="bg-black/70 backdrop-blur text-[9px] text-white px-2 py-0.5 rounded flex items-center gap-1.5">
                      <Shield className="w-2.5 h-2.5 text-blue-400" /> Lever: {tpl.atsScores.lever}%
                    </div>
                  </div>
                )}
              </div>
              
              {/* Text Body */}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-display font-semibold text-foreground text-lg">{tpl.name}</h3>
                    {tpl.users && (
                        <span className="text-[10px] font-medium text-gray-500 bg-white/5 px-2 py-1 rounded border border-border shrink-0">
                            👥 {(tpl.users / 1000).toFixed(1)}k
                        </span>
                    )}
                </div>
                
                <p className="text-sm text-gray-600 leading-relaxed text-balance line-clamp-2 mb-4 flex-1">{tpl.description}</p>
                
                {/* Tags */}
                {tpl.tags && tpl.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                        {tpl.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-md font-medium border border-blue-500/20">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Builder Modal */}
      <AnimatePresence>
        {selectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isBuilding && setSelectedTemplate(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 shadow-2xl"
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gray-50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="font-display font-semibold text-lg text-foreground">AI Builder: {selectedTemplate.name}</h2>
                    <p className="text-xs text-gray-600">
                      {selectedTemplate.category} Template
                      {selectedTemplate.atsScores && (
                        <> · <span className="text-emerald-400">{selectedTemplate.atsScores.combined}% ATS Score</span> (Greenhouse: {selectedTemplate.atsScores.greenhouse}% · Lever: {selectedTemplate.atsScores.lever}%)</>
                      )}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => !isBuilding && setSelectedTemplate(null)}
                  className="p-2 text-gray-500 hover:bg-gray-100 hover:text-foreground transition-colors rounded-lg"
                  disabled={isBuilding}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <form id="builder-form" onSubmit={handleBuildResume} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-800 uppercase tracking-wider">Full Name *</label>
                      <input 
                        required 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-gray-50 border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:border-blue-500 outline-none" 
                        placeholder="John Doe" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-800 uppercase tracking-wider">Target Role</label>
                      <input 
                        value={formData.targetRole} onChange={e => setFormData({...formData, targetRole: e.target.value})}
                        className="w-full bg-gray-50 border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:border-blue-500 outline-none" 
                        placeholder="e.g. Senior Frontend Engineer" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-800 uppercase tracking-wider">Email</label>
                      <input 
                        type="email"
                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-gray-50 border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:border-blue-500 outline-none" 
                        placeholder="john@example.com" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-800 uppercase tracking-wider">Phone / LinkedIn</label>
                      <input 
                        value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="w-full bg-gray-50 border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:border-blue-500 outline-none" 
                        placeholder="+1 234 567 890" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-800 uppercase tracking-wider flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-blue-500"/> Work Experience *</label>
                    <p className="text-[11px] text-gray-500 mb-2">Paste your roles, companies, dates, and rough bullet points. AI will fix them.</p>
                    <textarea 
                      required 
                      value={formData.experience} onChange={e => setFormData({...formData, experience: e.target.value})}
                      rows={5}
                      className="w-full bg-gray-50 border border-border rounded-lg p-3.5 text-sm text-foreground resize-none focus:border-blue-500 outline-none" 
                      placeholder="Software Engineer at Google (2020-Present)&#10;- Built the search backend using Go..." 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-800 uppercase tracking-wider flex items-center gap-2"><Code2 className="w-3.5 h-3.5 text-blue-500"/> Skills *</label>
                    <p className="text-[11px] text-gray-500 mb-2">List your top tools, languages, and frameworks separated by commas.</p>
                    <textarea 
                      required 
                      value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})}
                      rows={2}
                      className="w-full bg-gray-50 border border-border rounded-lg p-3.5 text-sm text-foreground resize-none focus:border-blue-500 outline-none" 
                      placeholder="React, TypeScript, Node.js, Python, AWS..." 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-800 uppercase tracking-wider flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5 text-blue-500"/> Projects</label>
                    <p className="text-[11px] text-gray-500 mb-2">Paste your personal or academic projects.</p>
                    <textarea 
                      value={formData.projects} onChange={e => setFormData({...formData, projects: e.target.value})}
                      rows={3}
                      className="w-full bg-gray-50 border border-border rounded-lg p-3.5 text-sm text-foreground resize-none focus:border-blue-500 outline-none" 
                      placeholder="E-commerce App - Built a full-stack store with Next.js and Stripe..." 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-800 uppercase tracking-wider flex items-center gap-2"><GraduationCap className="w-3.5 h-3.5 text-blue-500"/> Education</label>
                    <textarea 
                      value={formData.education} onChange={e => setFormData({...formData, education: e.target.value})}
                      rows={2}
                      className="w-full bg-gray-50 border border-border rounded-lg p-3.5 text-sm text-foreground resize-none focus:border-blue-500 outline-none" 
                      placeholder="B.S. in Computer Science - Stanford University (2016-2020), GPA: 3.8" 
                    />
                  </div>

                </form>
              </div>
              
              <div className="px-6 py-4 border-t border-border bg-gray-50 shrink-0 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setSelectedTemplate(null)}
                  disabled={isBuilding}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  form="builder-form"
                  disabled={isBuilding}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {isBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isBuilding ? "Generating Resume..." : "Generate Resume"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
