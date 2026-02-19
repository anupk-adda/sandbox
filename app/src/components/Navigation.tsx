import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Watch, MessageSquare } from 'lucide-react';

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isChatPage = location.pathname === '/chat';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Don't show navigation on chat page
  if (isChatPage) return null;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0A0C0F]/90 backdrop-blur-md py-4 border-b border-white/5'
          : 'bg-transparent py-6'
      }`}
    >
      <div className="w-full px-6 lg:px-10 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00D4AA]" />
          <span className="font-display font-semibold text-lg tracking-tight text-white">
            pace42
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection('features')}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            How it works
          </button>
          <button
            onClick={() => scrollToSection('dashboard')}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Dashboard
          </button>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <Link
            to="/chat"
            className="hidden sm:flex items-center gap-2 text-sm text-white/60 hover:text-[#00D4AA] transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </Link>
          <Link
            to="/chat"
            className="btn-accent text-xs py-2.5 px-5 flex items-center gap-2"
          >
            <Watch className="w-3.5 h-3.5" />
            Connect
          </Link>
        </div>
      </div>
    </nav>
  );
}
