import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Paperclip, FileSearch, Target, FileText, Linkedin, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const quickChips = [
  { icon: FileSearch, label: "ATS Check" },
  { icon: Target, label: "Find Jobs" },
  { icon: FileText, label: "Fix Resume" },
  { icon: Linkedin, label: "LinkedIn" },
  { icon: TrendingUp, label: "Skill Gap" },
];

const Chat = () => {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] || "there";

  const [messages, setMessages] = useState<Msg[]>([
    { id: "msg-0", role: "assistant", content: `Hi ${firstName}! 👋 I'm your AI career coach. I can help you optimize your resume, find matching jobs, prepare for interviews, or improve your LinkedIn profile. What would you like to work on today?` },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    console.log("sendMessage called with input:", input);
    if (!input.trim()) return;
    const userMsg: Msg = { id: `msg-${Date.now()}`, role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "Great question! Based on your current resume, I'd recommend focusing on quantifying your achievements. For example, instead of 'Worked on APIs', try 'Designed 12 REST APIs serving 2M requests/day, reducing latency by 40%'. This kind of specific metric-driven language significantly boosts your ATS score.",
        "I've analyzed your profile and found 3 high-match positions: Senior Software Engineer at Stripe (87% match), Full Stack Developer at Notion (82% match), and Backend Lead at Linear (79% match). Would you like me to tailor your resume for any of these?",
        "Your LinkedIn headline could be stronger. Currently it reads like a job title, but top-performing profiles include a value proposition. Try: 'Senior Software Engineer | Building Scalable Systems That Serve 2M+ Users | React, Node.js, AWS'. This format gets 3x more profile views.",
      ];
      setMessages((prev) => [
        ...prev,
        { id: `msg-${Date.now() + 1}`, role: "assistant", content: responses[Math.floor(Math.random() * responses.length)] },
      ]);
      setIsTyping(false);
    }, 1500);
  };

  const handleChip = (label: string) => {
    setInput(`Help me with ${label.toLowerCase()}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-6 lg:px-10 py-4 border-b border-border/60">
        <h1 className="font-display font-bold text-xl text-foreground">AI Career Coach</h1>
        <p className="text-white-60 text-sm">Your personal career advisor</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-5 space-y-5">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-blue-electric flex items-center justify-center text-white font-display font-bold text-[10px] mr-2 mt-1 shrink-0">
                JA
              </div>
            )}
            <div
              className={`max-w-[75%] sm:max-w-[65%] px-5 py-3 rounded-2xl text-base leading-relaxed ${msg.role === "user"
                ? "bg-blue-electric text-white rounded-br-md"
                : "bg-surface-1 text-white-90 rounded-bl-md"
                }`}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-electric flex items-center justify-center text-primary-foreground font-display font-bold text-[10px] shrink-0">
              JA
            </div>
            <div className="flex gap-1 px-4 py-3 bg-surface-1 rounded-2xl rounded-bl-md">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-blue-electric"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick chips */}
      <div className="px-6 lg:px-10 pb-3 flex gap-2.5 overflow-x-auto">
        {quickChips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => handleChip(chip.label)}
            className="glass rounded-full px-4 py-2 text-sm text-white-60 hover:text-foreground hover:border-blue-electric whitespace-nowrap flex items-center gap-2 transition-all shrink-0"
          >
            <span className="text-blue-electric">✦</span>
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-6 lg:px-10 py-4 border-t border-border/60">
        <div className="flex items-center gap-2 bg-surface-1 border border-blue-muted/50 rounded-2xl px-4 py-2 focus-within:border-blue-electric transition-colors">
          <Paperclip className="w-4 h-4 text-white-30 shrink-0 cursor-pointer hover:text-white-60" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask your AI career coach..."
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-white-30"
          />
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); sendMessage(); }}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-full bg-blue-electric hover:bg-blue-bright flex items-center justify-center transition-all disabled:opacity-30 hover:shadow-[0_0_20px_rgba(59,91,255,0.4)]"
          >
            <Send className="w-3.5 h-3.5 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
