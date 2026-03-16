import { Star, MapPin, DollarSign, Clock, Bot, ExternalLink, Filter, ChevronDown, Plus, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface Application {
  id: string;
  company: string;
  role: string;
  status: string;
  date_applied: string;
  interview_progress?: string;
  created_at: string;
  // Non-DB UI fields added for parity with old design
  location?: string;
  salary?: string;
  match?: string;
  starred?: boolean;
}


const STATS = [
  { icon: "📋", label: "Total", value: "24" },
  { icon: "✅", label: "Active", value: "18" },
  { icon: "🎯", label: "Interviews", value: "4" },
  { icon: "🏆", label: "Offers", value: "1" },
  { icon: "📈", label: "Response Rate", value: "23%" },
];

const JOBS = [
  { id: 1, status: "Saved", role: "Senior Frontend Engineer", company: "Notion", location: "SF / Remote", salary: "$180-220k", match: "89% MATCH", time: "2d ago", starred: true },
  { id: 2, status: "Saved", role: "Full Stack Developer", company: "Linear", location: "Remote", salary: "$160-200k", match: "79% MATCH", time: "5d ago", starred: false },
  { id: 3, status: "Applied", role: "Software Engineer, Payments", company: "Stripe", location: "SF", salary: "$190-240k", match: "87% MATCH", time: "3d ago", starred: true },
  { id: 4, status: "Applied", role: "Senior Engineer, Edge", company: "Vercel", location: "Remote", salary: "$175-210k", match: "82% MATCH", time: "7d ago", starred: false },
  { id: 5, status: "Interview", role: "Staff Engineer", company: "Figma", location: "SF / NY", salary: "$200-260k", match: "91% MATCH", time: "18d ago", starred: true },
  { id: 6, status: "Offer", role: "Senior SRE", company: "Datadog", location: "NY", salary: "$195-230k", match: "85% MATCH", time: "14d ago", starred: false },
];

const COLUMNS = [
  { name: "Saved", status: "Saved", color: "text-white-60" },
  { name: "Applied", status: "Applied", color: "text-blue-electric" },
  { name: "Interview", status: "Interviewing", color: "text-cyan-spark" },
  { name: "Offer", status: "Offer", color: "text-emerald-400" },
  { name: "Rejected", status: "Rejected", color: "text-red-400" },
];

const Jobs = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newJob, setNewJob] = useState({ company: "", role: "", status: "Applied", date_applied: new Date().toISOString().split('T')[0] });

  // ── Queries ──
  const { data, isLoading } = useQuery<{ applications: Application[] }>({
    queryKey: ['applications'],
    queryFn: () => api.get('/api/applications'),
  });

  const applications = data?.applications || [];

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (newApp: any) => api.post('/api/applications', newApp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setIsAddModalOpen(false);
      toast.success("Job application added successfully");
      setNewJob({ company: "", role: "", status: "Applied", date_applied: new Date().toISOString().split('T')[0] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add application");
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => api.put(`/api/applications/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success("Status updated");
    },
    onError: (error: any) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/applications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success("Application removed");
    },
    onError: (error: any) => toast.error(error.message)
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.company || !newJob.role) {
      toast.error("Company and Role are required");
      return;
    }
    createMutation.mutate(newJob);
  };

  // ── Dynamic Stats ──
  const total = applications.length;
  const active = applications.filter(a => ['Saved', 'Applied', 'Interviewing'].includes(a.status)).length;
  const interviews = applications.filter(a => a.status === 'Interviewing').length;
  const offers = applications.filter(a => a.status === 'Offer').length;
  // Calculate mock response rate based on interviews + offers vs total applied
  const appliedOnly = applications.filter(a => a.status !== 'Saved').length;
  const responseRate = appliedOnly > 0 ? Math.round(((interviews + offers) / appliedOnly) * 100) : 0;

  const DYNAMIC_STATS = [
    { icon: "📋", label: "Total", value: total.toString() },
    { icon: "✅", label: "Active", value: active.toString() },
    { icon: "🎯", label: "Interviews", value: interviews.toString() },
    { icon: "🏆", label: "Offers", value: offers.toString() },
    { icon: "📈", label: "Hit Rate", value: `${responseRate}%` },
  ];
  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-[2rem] font-bold text-foreground mb-1.5 tracking-tight">Job Applications</h1>
        <p className="text-white-60 text-[15px] font-medium">Track and manage your job search pipeline.</p>
      </div>

      {/* Stats & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 w-full">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide py-1">
          {DYNAMIC_STATS.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-white/[0.06] shadow-sm bg-surface-1 shrink-0">
              <span className="text-[1.1rem]">{stat.icon}</span>
              <span className="text-white-60 font-medium text-[13px]">{stat.label}:</span>
              <span className="text-blue-electric font-bold text-[15px]">{stat.value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 items-center shrink-0">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-surface-1 border border-white/[0.06] rounded-full text-white-60 font-medium text-[13px] hover:bg-surface-2 transition-all shadow-sm">
            Status: All <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-50" />
          </button>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-5 py-2 bg-blue-electric border border-transparent rounded-full text-primary-foreground font-medium text-[13px] shadow-md shadow-blue-electric/20 hover:bg-blue-bright transition-all">
                <Plus className="w-4 h-4" /> Add Application
              </button>
            </DialogTrigger>
            <DialogContent className="bg-surface-1 border-white/[0.06] text-white sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-display text-white">Add New Lead</DialogTitle>
                <DialogDescription className="text-white-60">Track a new job you saved or applied to.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-white-80">Company</Label>
                  <Input id="company" required placeholder="e.g. OpenAI" className="bg-surface-2 border-white/[0.06]" value={newJob.company} onChange={e => setNewJob({...newJob, company: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-white-80">Role / Title</Label>
                  <Input id="role" required placeholder="e.g. Senior Frontend Engineer" className="bg-surface-2 border-white/[0.06]" value={newJob.role} onChange={e => setNewJob({...newJob, role: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-white-80">Status</Label>
                  <Select value={newJob.status} onValueChange={(val) => setNewJob({...newJob, status: val})}>
                    <SelectTrigger className="bg-surface-2 border-white/[0.06]">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-2 border-white/[0.06] text-white">
                      {COLUMNS.map(col => (
                        <SelectItem key={col.status} value={col.status}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-white-80">Date Applied</Label>
                  <Input type="date" id="date" className="bg-surface-2 border-white/[0.06] text-white p-2 block w-full outline-none" value={newJob.date_applied} onChange={e => setNewJob({...newJob, date_applied: e.target.value})} />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-blue-electric hover:bg-blue-bright text-white" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Saving..." : "Save Application"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex flex-col lg:flex-row gap-6 items-start overflow-x-auto pb-8">
        {COLUMNS.map((col) => {
          const colJobs = applications.filter(j => j.status === col.status);
          return (
            <div key={col.name} className="flex-1 min-w-[320px] w-full">
              <div className="flex items-center gap-2.5 mb-5 px-1">
                <h3 className={`font-display font-bold text-lg ${col.color}`}>{col.name}</h3>
                <span className="bg-surface-3 text-white-40 text-xs font-bold px-2 py-0.5 rounded-md">{colJobs.length}</span>
              </div>
              <div className="space-y-4">
                {colJobs.length === 0 && (
                  <div className="border border-dashed border-white/[0.06] rounded-xl p-8 text-center text-white-30 text-sm font-medium">
                    No applications
                  </div>
                )}
                {colJobs.map((job) => (
                  <div key={job.id} className="glass-card-hover p-5 group relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-electric/15 flex items-center justify-center text-blue-electric font-display font-bold text-base uppercase shrink-0">
                          {job.company.charAt(0)}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <h4 className="text-foreground font-semibold text-[15px] leading-snug group-hover:text-blue-electric transition-colors pr-6">{job.role}</h4>
                          <p className="text-white-40 font-medium text-[13px] tracking-wide">{job.company}</p>
                        </div>
                      </div>
                      
                      {/* Card Context Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="absolute top-4 right-4 text-white-30 hover:text-white-60 transition-colors outline-none z-10">
                            <MoreHorizontal className="w-5 h-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-surface-2 border-white/[0.06] text-white">
                          <DropdownMenuLabel className="text-white-40 text-xs">Move to...</DropdownMenuLabel>
                          {COLUMNS.filter(c => c.status !== job.status).map(c => (
                            <DropdownMenuItem 
                              key={c.status} 
                              onClick={() => updateStatusMutation.mutate({ id: job.id, status: c.status })}
                              className="cursor-pointer focus:bg-white/[0.06]"
                            >
                              {c.name}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator className="bg-white/[0.06]" />
                          <DropdownMenuItem 
                            className="text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this application?")) {
                                deleteMutation.mutate(job.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
                      <div className="flex items-center gap-1.5 text-white-40 text-[12px] font-medium">
                        <MapPin className="w-3.5 h-3.5 text-white-30" /> {job.location || "Remote"}
                      </div>
                      {(job.salary || job.match) && (
                        <div className="flex items-center gap-1.5 text-white-40 text-[12px] font-medium">
                          <DollarSign className="w-3.5 h-3.5 text-white-30" /> {job.salary || "N/A"}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mb-5">
                      {job.match ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                          {job.match}
                        </div>
                      ) : (
                         <div className="bg-white/[0.03] border border-white/[0.06] text-white-40 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                           {job.interview_progress || "Tracked"}
                         </div>
                      )}
                      <div className="flex items-center gap-1.5 text-white-30 text-[11px] font-medium">
                        <Clock className="w-3 h-3" /> {new Date(job.date_applied).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-t border-white/[0.06] pt-4 mt-1">
                      <button 
                        onClick={() => {
                          const prompt = `Act as my AI interview coach. I am preparing for an interview for the **${job.role}** role at **${job.company}**. Ask me a typical interview question for this role, and then evaluate my answer.`;
                          navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`);
                        }}
                        className="flex items-center gap-1.5 text-blue-electric font-semibold text-[13px] hover:underline outline-none"
                      >
                        <Bot className="w-4 h-4" /> AI Coach
                      </button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="flex items-center gap-1.5 text-white-40 font-medium text-[13px] hover:text-white-60 group/jd outline-none transition-colors">
                            <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover/jd:-translate-y-0.5 group-hover/jd:translate-x-0.5" /> View JD
                          </button>
                        </DialogTrigger>
                        <DialogContent className="bg-surface-1 border-white/[0.06] text-white sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-display text-white">{job.role} at {job.company}</DialogTitle>
                            <DialogDescription className="text-white-60 mt-2">
                              This is the job description for the {job.role} position at {job.company}. They are looking for candidates in {job.location} with a compensation range of {job.salary}.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="mt-4 space-y-4 text-sm text-white-80">
                            <p><strong>About the role:</strong><br/>We are looking for an experienced professional to join our team. You will be responsible for building scalable solutions and working closely with cross-functional teams.</p>
                            <p><strong>Requirements:</strong></p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li>Experience relevant to the {job.role} position</li>
                              <li>Strong problem-solving and analytical skills</li>
                              <li>Excellent communication and teamwork abilities</li>
                              <li>History of delivering high-quality results</li>
                            </ul>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Jobs;
