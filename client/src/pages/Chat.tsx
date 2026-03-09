import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, FileSearch, Target, FileText, Linkedin, TrendingUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const quickChips = [
  { icon: FileSearch, label: "ATS Check" },
  { icon: Target, label: "Find Jobs" },
  { icon: FileText, label: "Fix Resume" },
  { icon: Linkedin, label: "LinkedIn" },
  { icon: TrendingUp, label: "Skill Gap" },
];

const Chat = () => {
  const { user } = useAuth();
  const userName = user?.fullName?.split(" ")[0] || "there";

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: `Hi ${userName}! 👋 I'm your AI career coach. I can help you optimize your resume, find matching jobs, prepare for interviews, or improve your LinkedIn profile. What would you like to work on today?` },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);

    try {
      const conversationHistory = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const data = await api.post<{ message: Msg }>("/api/chat", {
        messages: conversationHistory,
      });

      setMessages((prev) => [...prev, data.message]);
    } catch (error: any) {
      console.error("Chat error:", error);
      toast.error(error.message || "Failed to get AI response");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble connecting right now. Please try again in a moment." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleChip = (label: string) => {
    setInput(`Help me with ${label.toLowerCase()}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-6 lg:px-10 py-4 border-b border-border/60">
        <h1 className="font-display font-bold text-xl text-foreground">AI Career Coach</h1>
        <p className="text-white-60 text-sm">Your personal career advisor — powered by AI</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-5 space-y-5">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-blue-electric flex items-center justify-center text-primary-foreground font-display font-bold text-[10px] mr-2 mt-1 shrink-0">
                  JA
                </div>
              )}
              <div
                className={`max-w-[80%] sm:max-w-[70%] px-5 py-3 rounded-2xl text-base leading-relaxed ${msg.role === "user"
                  ? "bg-blue-electric text-primary-foreground rounded-br-md"
                  : "bg-surface-1 text-white-90 rounded-bl-md"
                  }`}
              >
                {msg.role === "assistant" ? (
                  <div className="chat-markdown">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-electric hover:text-blue-bright underline underline-offset-2 break-all"
                          >
                            {children}
                          </a>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-foreground">{children}</strong>
                        ),
                        hr: () => (
                          <hr className="border-border/40 my-3" />
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside space-y-1 my-1">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside space-y-1 my-1">{children}</ol>
                        ),
                        p: ({ children }) => (
                          <p className="my-1">{children}</p>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

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
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask your AI career coach..."
            disabled={isTyping}
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-white-30 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
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
