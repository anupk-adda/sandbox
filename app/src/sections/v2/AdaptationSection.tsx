import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Calendar, Zap, RotateCcw, TrendingUp } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const timelineData = [
  { week: 'Week 1', status: 'Base plan', icon: Calendar, color: 'bg-white/20' },
  { week: 'Week 2', status: 'Adjusted', detail: 'You ran faster than target', icon: TrendingUp, color: 'bg-[#00D4AA]/40' },
  { week: 'Week 3', status: 'Adapted', detail: 'Added recovery — you needed it', icon: RotateCcw, color: 'bg-[#00D4AA]/60' },
];

export default function AdaptationSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=140%',
          pin: true,
          scrub: 0.6,
        },
      });

      // Phase 1: ENTRANCE (0-30%)
      scrollTl.fromTo(cardRef.current,
        { y: '60vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'none' },
        0
      );

      // Timeline line draws
      if (timelineRef.current) {
        const line = timelineRef.current.querySelector('.timeline-line');
        scrollTl.fromTo(line,
          { scaleX: 0 },
          { scaleX: 1, ease: 'none' },
          0.05
        );
      }

      // Timeline items
      itemsRef.current.forEach((item, i) => {
        if (!item) return;
        scrollTl.fromTo(item,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.1 + i * 0.04
        );
      });

      // Phase 3: EXIT (70-100%)
      scrollTl.fromTo(cardRef.current,
        { x: 0, opacity: 1 },
        { x: '50vw', opacity: 0, ease: 'power2.in' },
        0.7
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-screen h-screen overflow-hidden z-40"
    >
      {/* Background */}
      <img
        src="/v2_data_visualization.jpg"
        alt="Data visualization"
        className="section-bg"
      />
      <div className="absolute inset-0 bg-[#0A0C0F]/85" />
      <div className="absolute inset-0 data-grid opacity-30" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div
          ref={cardRef}
          className="glass-card max-w-2xl w-full p-8 lg:p-10"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-[#00D4AA]/20 flex items-center justify-center animate-pulse-glow">
              <Zap className="w-7 h-7 text-[#00D4AA]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-[clamp(24px,3vw,36px)] text-white">
                Plans that <span className="text-[#00D4AA]">evolve</span> with you
              </h2>
            </div>
          </div>

          <p className="text-white/65 text-base lg:text-lg mb-10 leading-relaxed">
            Missed a workout? Crushed a session? Feeling off? Your plan adapts 
            in real-time — not at the end of the week.
          </p>

          {/* Timeline */}
          <div ref={timelineRef} className="relative">
            {/* Line */}
            <div className="timeline-line absolute top-6 left-0 right-0 h-[2px] bg-gradient-to-r from-white/20 via-[#00D4AA] to-[#00D4AA] origin-left" />

            {/* Items */}
            <div className="grid grid-cols-3 gap-4">
              {timelineData.map((item, i) => (
                <div
                  key={i}
                  ref={(el) => { itemsRef.current[i] = el; }}
                  className="relative"
                >
                  {/* Dot */}
                  <div className={`w-12 h-12 rounded-full ${item.color} flex items-center justify-center mb-4 relative z-10 mx-auto`}>
                    <item.icon className="w-5 h-5 text-white" />
                  </div>

                  {/* Content */}
                  <div className="text-center">
                    <div className="font-mono text-xs text-white/50 mb-1">{item.week}</div>
                    <div className="font-semibold text-white mb-1">{item.status}</div>
                    {item.detail && (
                      <div className="text-xs text-[#00D4AA]">{item.detail}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom note */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-white/50 text-sm">
              Every adjustment is based on your actual data and recovery status
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
