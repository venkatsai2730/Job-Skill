import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Send, Copy, Check, Plus, Trash2,
  ExternalLink, Sparkles, MessageSquare, Linkedin,
  Mail, Building, Clock, CheckCircle2
} from "lucide-react";
import { api } from "@/lib/api";

interface ContactItem {
  id: string;
  name: string;
  company: string;
  role: string;
  linkedinUrl?: string;
  status: "Identified" | "Reached Out" | "In Conversation" | "Referral Submitted";
  notes?: string;
  createdAt: string;
  lastContacted: string;
}

interface GeneratedMessage {
  subject: string;
  message: string;
  tips: string[];
}

export default function Networking() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Outreach Generator State
  const [messageType, setMessageType] = useState<string>("referral_request");
  const [channel, setChannel] = useState<string>("linkedin_connection_note");
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientTitle, setRecipientTitle] = useState("");
  const [sharedContext, setSharedContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GeneratedMessage | null>(null);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);

  // Add Contact Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formLinkedin, setFormLinkedin] = useState("");
  const [formStatus, setFormStatus] = useState<ContactItem["status"]>("Identified");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await api.get<{ contacts: ContactItem[] }>("/api/networking/contacts");
      setContacts(res.contacts || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleGenerateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCompany.trim() || !targetRole.trim()) return;

    try {
      setIsGenerating(true);
      const res = await api.post<{ success: boolean } & GeneratedMessage>("/api/networking/generate-message", {
        messageType,
        channel,
        targetCompany,
        targetRole,
        recipientName,
        recipientTitle,
        sharedContext,
      });
      setGeneratedResult(res);
    } catch (err: any) {
      alert(err.message || "Failed to generate message");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCompany.trim()) return;

    try {
      await api.post("/api/networking/contacts", {
        name: formName,
        company: formCompany,
        role: formRole,
        linkedinUrl: formLinkedin,
        status: formStatus,
        notes: formNotes,
      });
      setIsModalOpen(false);
      setFormName("");
      setFormCompany("");
      setFormRole("");
      setFormLinkedin("");
      setFormNotes("");
      fetchContacts();
    } catch (err: any) {
      alert(err.message || "Failed to save contact");
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm("Remove this networking contact?")) return;
    try {
      setContacts(prev => prev.filter(c => c.id !== id));
      await api.delete(`/api/networking/contacts/${id}`);
    } catch (err) {
      console.error("Failed to delete contact:", err);
      fetchContacts();
    }
  };

  const handlePrefillForContact = (contact: ContactItem) => {
    setRecipientName(contact.name);
    setRecipientTitle(contact.role);
    setTargetCompany(contact.company);
    setSharedContext(contact.notes || "");
    // Scroll smoothly to generator
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyToClipboard = (text: string, isSubject: boolean) => {
    navigator.clipboard.writeText(text);
    if (isSubject) {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    } else {
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Insider Networking & Referrals</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              TNT Surface
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Generate high-converting referral requests, cold outreach messages, and track your target company insiders.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-sm shadow-blue-500/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Target Insider</span>
        </button>
      </div>

      {/* TOP: OUTREACH GENERATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Input Form */}
        <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <h2 className="text-base font-bold text-foreground">AI Outreach Message Architect</h2>
          </div>

          <form onSubmit={handleGenerateMessage} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Message Goal</label>
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none"
                >
                  <option value="referral_request">Ask for Job Referral</option>
                  <option value="cold_hiring_manager">Cold Message to Hiring Manager</option>
                  <option value="alumni_connection">Alumni Warm Introduction</option>
                  <option value="post_interview_followup">Post-Interview Thank You & Follow-up</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Outreach Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none"
                >
                  <option value="linkedin_connection_note">LinkedIn Note (&lt;280 chars)</option>
                  <option value="linkedin_dm">LinkedIn InMail / DM</option>
                  <option value="email">Direct Work Email</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Target Company *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe, OpenAI, Datadog"
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Target Role *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Frontend Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Recipient Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jordan Smith"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Recipient Title</label>
                <input
                  type="text"
                  placeholder="e.g. Engineering Lead / Recruiter"
                  value={recipientTitle}
                  onChange={(e) => setRecipientTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Mutual Hook / Shared Context (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Both studied at UC Berkeley, met at PyCon, or admiring their recent blog post on Rust"
                value={sharedContext}
                onChange={(e) => setSharedContext(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating || !targetCompany.trim() || !targetRole.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-md shadow-blue-500/20"
            >
              {isGenerating ? (
                <>Generating Tailored Message...</>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Generate High-Conversion Outreach
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Generated Output Card */}
        <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-6 min-h-[360px] flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Generated Message
              </span>
              {generatedResult && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Send
                </span>
              )}
            </div>

            {generatedResult ? (
              <div className="space-y-4 mt-4">
                {generatedResult.subject && (
                  <div className="bg-background border border-border rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="font-semibold text-foreground">Subject Line:</span>
                      <button
                        onClick={() => copyToClipboard(generatedResult.subject, true)}
                        className="hover:text-blue-400 flex items-center gap-1"
                      >
                        {copiedSubject ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedSubject ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="text-sm font-medium text-foreground">{generatedResult.subject}</p>
                  </div>
                )}

                <div className="bg-background border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span className="font-semibold text-foreground">Message Body:</span>
                    <button
                      onClick={() => copyToClipboard(generatedResult.message, false)}
                      className="hover:text-blue-400 flex items-center gap-1 text-xs font-medium"
                    >
                      {copiedBody ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedBody ? "Copied Message" : "Copy Message"}
                    </button>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {generatedResult.message}
                  </p>
                </div>

                {generatedResult.tips && generatedResult.tips.length > 0 && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                    <span className="font-semibold text-blue-400 block mb-1">💡 Pro Tips:</span>
                    {generatedResult.tips.map((t, idx) => (
                      <p key={idx}>• {t}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                <MessageSquare className="w-10 h-10 stroke-[1.5] text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">No message generated yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Fill in your target company and role details on the left, then click Generate to create tailored networking copy.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM: SAVED INSIDERS & CONTACTS TABLE */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-foreground">Target Company Insiders</h2>
            <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground font-mono">
              {contacts.length}
            </span>
          </div>
        </div>

        {loadingContacts ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="h-36 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground text-center p-6">
            <p className="text-sm font-medium text-foreground">No contacts saved yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add engineers, alumni, or recruiters at your target companies to track outreach & warm referrals.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="pb-3 font-semibold">Insider / Contact</th>
                  <th className="pb-3 font-semibold">Company & Role</th>
                  <th className="pb-3 font-semibold">Outreach Status</th>
                  <th className="pb-3 font-semibold">Notes / Mutuals</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 font-bold text-xs flex items-center justify-center">
                          {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{contact.name}</p>
                          {contact.linkedinUrl && (
                            <a
                              href={contact.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <Linkedin className="w-3 h-3" /> Profile
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3">
                      <p className="font-medium text-foreground">{contact.company}</p>
                      <p className="text-xs text-muted-foreground">{contact.role}</p>
                    </td>

                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          contact.status === "Referral Submitted"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : contact.status === "In Conversation"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : contact.status === "Reached Out"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {contact.status}
                      </span>
                    </td>

                    <td className="py-3 text-xs text-muted-foreground max-w-xs truncate">
                      {contact.notes || "—"}
                    </td>

                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handlePrefillForContact(contact)}
                          className="px-2.5 py-1 text-xs rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-medium transition-colors"
                        >
                          Draft Note
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1 hover:text-rose-400 text-muted-foreground"
                          title="Delete contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD CONTACT MODAL */}
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
                <h2 className="text-lg font-bold text-foreground">Add Target Company Insider</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveContact} className="space-y-3.5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Company *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stripe"
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Role / Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Tech Lead"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/alexmorgan"
                    value={formLinkedin}
                    onChange={(e) => setFormLinkedin(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ContactItem["status"])}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none"
                  >
                    <option value="Identified">Identified (Not yet contacted)</option>
                    <option value="Reached Out">Reached Out (Waiting for response)</option>
                    <option value="In Conversation">In Conversation</option>
                    <option value="Referral Submitted">Referral Submitted 🎉</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Notes / Context</label>
                  <textarea
                    rows={2}
                    placeholder="Alumni from 2020; met at hackathon; working on infra team..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none resize-none"
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
                    Save Insider
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
