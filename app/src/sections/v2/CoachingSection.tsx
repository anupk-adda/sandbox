import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Lightbulb, ChevronRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const tips = [
  {
    title: 'Pace adjustment',
    message: 'Your easy runs are too fast. Slow down 20s/km to build aerobic base.',
    context: 'Based on your heart rate data',
  },
  {
    title: 'Form cue',
    message: 'Great cadence! Try increasing stride length on intervals.',
    context: '172 spm average this week',
  },
  {
    title: 'Readiness check',
    message: "You're ready for a long run this weekend.",
    context: 'Recovery score: 92%',
  },
];

export default function CoachingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tipsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [activeTip, setActiveTip] = useState(0);

  // Auto-rotate tips
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTip((prev) => (prev + 1) % tips.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
        },
      });

      // Phase 1: ENTRANCE (0-30%)
      scrollTl.fromTo(cardRef.current,
        { x: '-60vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0
      );

      // Tips fan out
      tipsRef.current.forEach((tip, i) => {
        if (!tip) return;
        scrollTl.fromTo(tip,
          { x: -30, rotation: -5, opacity: 0 },
          { x: 0, rotation: 0, opacity: 1, ease: 'none' },
          0.08 + i * 0.03
        );
      });

      // Phase 3: EXIT (70-100%)
      scrollTl.fromTo(cardRef.current,
        { opacity: 1 },
        { opacity: 0, scale: 0.9, ease: 'power2.in' },
        0.7
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-screen h-screen overflow-hidden z-[60]"
    >
      {/* Background */}
      <img
        src="/v2_focused_runner.jpg"
        alt="Focused runner"
        className="section-bg"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0C0F]/95 via-[#0A0C0F]/80 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center px-6 lg:px-[10vw]">
        <div
          ref={cardRef}
          className="glass-card max-w-lg p-8 lg:p-10"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-[#00D4AA]/20 flex items-center justify-center animate-pulse-glow">
              <Lightbulb className="w-7 h-7 text-[#00D4AA]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-[clamp(24px,3vw,36px)] text-white">
                Coaching tips <br />
                <span className="text-[#00D4AA]">that fit you</span>
              </h2>
            </div>
          </div>

          <p className="text-white/65 text-base lg:text-lg mb-8 leading-relaxed">
            Generic advice doesn't work. Get tips based on your actual data, 
            your goals, and where you are in your training cycle.
          </p>

          {/* Active Tip Display */}
          <div className="bg-[#111418] rounded-xl p-6 border border-[#00D4AA]/30 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
              <span className="micro-label">PERSONALIZED TIP</span>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">
              {tips[activeTip].title}
            </h3>
            <p className="text-white/80 mb-3">
              {tips[activeTip].message}
            </p>
            <p className="text-white/50 text-sm">
              {tips[activeTip].context}
            </p>
          </div>

          {/* Tip Indicators */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {tips.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTip(i)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === activeTip ? 'w-6 bg-[#00D4AA]' : 'bg-white/30'
                }`}
              />
            ))}
          </div>

          {/* All Tips Preview */}
          <div className="space-y-3">
            {tips.map((tip, i) => (
              <div
                key={i}
                ref={(el) => { tipsRef.current[i] = el; }}
                onClick={() => setActiveTip(i)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-300 ${
                  i === activeTip 
                    ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/30' 
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                <ChevronRight className={`w-4 h-4 ${i === activeTip ? 'text-[#00D4AA]' : 'text-white/40'}`} />
                <span className={`text-sm ${i === activeTip ? 'text-white' : 'text-white/60'}`}>
                  {tip.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
