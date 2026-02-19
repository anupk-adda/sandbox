import { useRef, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Mail, Instagram, Twitter, Send, MessageSquare } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function FinalCTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(contentRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: contentRef.current,
            start: 'top 80%',
            end: 'top 50%',
            scrub: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col z-[80]"
    >
      {/* Background */}
      <img
        src="/v2_final_cta.jpg"
        alt="Sunrise runner"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0C0F] via-[#0A0C0F]/70 to-[#0A0C0F]/50" />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div ref={contentRef} className="text-center max-w-2xl">
          <h2 className="font-display font-bold text-[clamp(32px,5vw,56px)] text-white mb-6 leading-tight">
            Ready to train <span className="text-[#00D4AA] glow-text">smarter</span>?
          </h2>

          <p className="text-white/65 text-lg md:text-xl mb-10">
            Join thousands of runners who've made every run count with 
            personalized, adaptive training.
          </p>

          {/* Email Form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-full text-white placeholder:text-white/40 focus:outline-none focus:border-[#00D4AA] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-accent flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Join waitlist
                </button>
              </div>
            </form>
          ) : (
            <div className="glass-card max-w-md mx-auto p-6 mb-8">
              <div className="w-12 h-12 rounded-full bg-[#00D4AA]/20 flex items-center justify-center mx-auto mb-4">
                <Send className="w-6 h-6 text-[#00D4AA]" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">You're on the list!</h3>
              <p className="text-white/60">We'll let you know when pace42 is ready.</p>
            </div>
          )}

          {/* Or connect now */}
          <div className="flex items-center justify-center gap-4 mb-16">
            <div className="h-px w-16 bg-white/20" />
            <span className="text-white/40 text-sm">or</span>
            <div className="h-px w-16 bg-white/20" />
          </div>

          <Link
            to="/chat"
            className="flex items-center gap-2 mx-auto text-[#00D4AA] hover:text-white transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="font-medium">Start chatting with your coach</span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-white/10 bg-[#0A0C0F]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00D4AA]" />
              <span className="font-display font-semibold text-white">pace42</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">Features</a>
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">How it works</a>
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">Privacy</a>
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">Terms</a>
            </div>

            {/* Social */}
            <div className="flex items-center gap-4">
              <a href="#" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#00D4AA]/20 transition-colors">
                <Instagram className="w-4 h-4 text-white/60" />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#00D4AA]/20 transition-colors">
                <Twitter className="w-4 h-4 text-white/60" />
              </a>
            </div>
          </div>

          <div className="text-center mt-6 pt-6 border-t border-white/5">
            <p className="text-white/30 text-sm">© 2025 pace42. All rights reserved.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
