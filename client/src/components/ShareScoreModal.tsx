import React, { useRef, useState } from "react";
import { X, Download, Share2, Linkedin, Twitter, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  score: number;
  label: string;
  keywords: string[];
  userName: string;
}

export const ShareScoreModal: React.FC<Props> = ({
  isOpen,
  onClose,
  score,
  label,
  keywords,
  userName,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    
    try {
      // Small delay to ensure any fonts/animations finish rendering
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // High resolution
        backgroundColor: null,
        logging: false,
        useCORS: true, // Allow external images/fonts if any
      });
      
      const image = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = image;
      a.download = `JobSkill_ATS_Score_${score}.png`;
      a.click();
      toast.success("Image saved! Ready to share on LinkedIn 🚀");
    } catch (err) {
      console.error("Failed to generate image", err);
      toast.error("Failed to generate image. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = () => {
    // In a real app, this would be a public unique share URL
    // For now, we copy a generic promotional message
    navigator.clipboard.writeText(`I just scored a ${score}/100 on my resume using JobSkill AI! 🚀 Check your ATS score for free: https://jobskill.ai`);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-display font-semibold text-lg text-foreground flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-500" /> Share Your Flex
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-slate-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* The actual card to be captured */}
            <div 
              ref={cardRef} 
              className="relative p-8 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0c0a1d] via-[#1a1438] to-[#2d1b54] mb-6 shadow-xl"
            >
              {/* Decorative elements for the "Wrapped" look */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/20 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-border text-white font-medium text-xs tracking-widest uppercase mb-6 backdrop-blur-md">
                  JobSkill.ai
                </span>
                
                <h4 className="font-display font-bold text-white text-2xl mb-1">
                  {userName}'s ATS Score
                </h4>
                
                <div className="my-6 relative">
                  <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full" />
                  <div className="relative w-32 h-32 rounded-full border-4 border-blue-500/30 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <span className="font-mono font-bold text-5xl text-white drop-shadow-[0_0_15px_rgba(99,91,255,0.8)]">
                      {score}
                    </span>
                  </div>
                </div>
                
                <p className="text-blue-500 font-semibold text-lg mb-4 tracking-wide uppercase">
                  {label} Rating
                </p>
                
                {keywords.length > 0 && (
                  <div className="w-full">
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Top Keywords</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {keywords.slice(0, 5).map(kw => (
                        <span key={kw} className="px-2 py-1 bg-white/5 border border-border rounded border text-[10px] text-white/90">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownloadImage}
                disabled={isExporting}
                className="flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {isExporting ? (
                  <div className="w-5 h-5 border-2 border-border border-t-white rounded-full animate-spin" />
                ) : (
                  <><Download className="w-4 h-4" /> Save Image</>
                )}
              </button>
              
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 border border-border text-foreground rounded-xl font-medium transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-4">
              <span className="text-xs text-gray-400">Quick share:</span>
              <a 
                href={`https://www.linkedin.com/sharing/share-offsite/?url=https://jobskill.ai`} 
                target="_blank" rel="noopener noreferrer"
                className="text-[#0a66c2] hover:opacity-80 transition-opacity"
              >
                <Linkedin className="w-5 h-5 fill-current" />
              </a>
              <a 
                href={`https://twitter.com/intent/tweet?text=I just scored ${score}/100 on my resume using JobSkill AI! 🚀&url=https://jobskill.ai`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#1da1f2] hover:opacity-80 transition-opacity"
              >
                <Twitter className="w-5 h-5 fill-current" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
