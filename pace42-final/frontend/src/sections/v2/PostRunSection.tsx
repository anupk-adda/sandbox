import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MessageSquare, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const insights = [
  {
    type: 'success',
    icon: CheckCircle,
    message: 'Great job! Your aerobic base is improving.',
    detail: 'VO2 max up 2% from last month',
  },
  {
    type: 'warning',
    icon: AlertCircle,
    message: 'Pace was 8% faster than target',
    detail: 'Consider dialing back next easy run',
  },
  {
    type: 'info',
    icon: TrendingUp,
    message: 'Cadence looking good',
    detail: '172 spm average — right in your sweet spot',
  },
];

export default function PostRunSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const insightsRef = useRef<(HTMLDivElement | null)[]>([]);

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
        { y: '80vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'none' },
        0
      );

      // Insights stack in
      insightsRef.current.forEach((insight, i) => {
        if (!insight) return;
        scrollTl.fromTo(insight,
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.08 + i * 0.04
        );
      });

      // Phase 3: EXIT (70-100%)
      scrollTl.fromTo(cardRef.current,
        { y: 0, opacity: 1 },
        { y: '-30vh', opacity: 0, ease: 'power2.in' },
        0.7
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-screen h-screen overflow-hidden z-50"
    >
      {/* Background */}
      <img
        src="/v2_finish_runner.jpg"
        alt="Finish run"
        className="section-bg"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0C0F] via-[#0A0C0F]/80 to-[#0A0C0F]/60" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div
          ref={cardRef}
          className="glass-card max-w-xl w-full p-8 lg:p-10"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-[#00D4AA]/20 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-[#00D4AA]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-[clamp(24px,3vw,36px)] text-white">
                Insights after <span className="text-[#00D4AA]">every run</span>
              </h2>
            </div>
          </div>

          <p className="text-white/65 text-base lg:text-lg mb-8 leading-relaxed">
            Within seconds of saving your activity, get personalized analysis: 
            what went well, what to watch, and how it fits your bigger picture.
          </p>

          {/* Insight Cards */}
          <div className="space-y-4">
            {insights.map((insight, i) => (
              <div
                key={i}
                ref={(el) => { insightsRef.current[i] = el; }}
                className={`tip-card flex items-start gap-4 ${
                  insight.type === 'success' ? 'border-l-2 border-l-[#00D4AA]' : ''
                } ${insight.type === 'warning' ? 'border-l-2 border-l-orange-400' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  insight.type === 'success' ? 'bg-[#00D4AA]/20' :
                  insight.type === 'warning' ? 'bg-orange-400/20' :
                  'bg-blue-400/20'
                }`}>
                  <insight.icon className={`w-5 h-5 ${
                    insight.type === 'success' ? 'text-[#00D4AA]' :
                    insight.type === 'warning' ? 'text-orange-400' :
                    'text-blue-400'
                  }`} />
                </div>
                <div>
                  <p className="text-white font-medium mb-1">{insight.message}</p>
                  <p className="text-white/50 text-sm">{insight.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Notification badge */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
            <span className="text-white/50 text-sm">Delivered in seconds</span>
          </div>
        </div>
      </div>
    </section>
  );
}
