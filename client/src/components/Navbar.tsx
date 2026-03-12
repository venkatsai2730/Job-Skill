import { Link, useLocation } from "react-router-dom";
import { Zap, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "glass border-b border-white/[0.06]" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center shadow-lg shadow-purple-600/20 group-hover:shadow-purple-600/40 transition-shadow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-foreground tracking-tight">JobSkill AI</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}
                className="text-white-60 hover:text-foreground transition-colors text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/[0.04]">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="text-white-60 hover:text-foreground transition-colors text-sm font-medium px-4 py-2">
              Log In
            </Link>
            <Link to="/auth"
              className="bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white font-semibold text-sm px-6 py-2.5 rounded-full transition-all hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]">
              Try for free
            </Link>
          </div>

          <button className="md:hidden text-white-60" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-white/[0.06]">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <a key={link.label} href={link.href}
                  className="block text-white-60 hover:text-foreground text-sm py-2.5 px-3 rounded-lg hover:bg-white/[0.04]"
                  onClick={() => setMobileOpen(false)}>
                  {link.label}
                </a>
              ))}
              <Link to="/auth"
                className="block bg-gradient-to-r from-purple-600 to-violet-500 text-white font-semibold text-sm px-5 py-2.5 rounded-full text-center mt-4"
                onClick={() => setMobileOpen(false)}>
                Try for free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
