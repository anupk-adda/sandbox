import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Watch, RefreshCw, TrendingUp, Target } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  { icon: RefreshCw, text: 'Auto-sync after every run' },
  { icon: TrendingUp, text: 'Historical trend analysis' },
  { icon: Target, text: 'Fitness level detection' },
];

export default function GarminSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<(HTMLDivElement | null)[]>([]);
  const streamsRef = useRef<HTMLDivElement>(null);

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
        { y: '80vh', opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(iconRef.current,
        { scale: 0, rotation: -180 },
        { scale: 1, rotation: 0, ease: 'none' },
        0.05
      );

      featuresRef.current.forEach((feature, i) => {
        if (!feature) return;
        scrollTl.fromTo(feature,
          { x: -30, opacity: 0 },
          { x: 0, opacity: 1, ease: 'none' },
          0.1 + i * 0.03
        );
      });

      // Data streams draw on
      if (streamsRef.current) {
        const streams = streamsRef.current.querySelectorAll('.data-stream');
        scrollTl.fromTo(streams,
          { scaleX: 0 },
          { scaleX: 1, ease: 'none' },
          0.08
        );
      }

      // Phase 3: EXIT (70-100%)
      scrollTl.fromTo(cardRef.current,
        { x: 0, opacity: 1 },
        { x: '-50vw', opacity: 0, ease: 'power2.in' },
        0.7
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-screen h-screen overflow-hidden z-20"
    >
      {/* Background */}
      <img
        src="/v2_garmin_watch.jpg"
        alt="Garmin watch"
        className="section-bg"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0C0F]/90 via-[#0A0C0F]/70 to-transparent" />

      {/* Data Streams Decoration */}
      <div ref={streamsRef} className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="data-stream absolute h-[2px] bg-gradient-to-r from-transparent via-[#00D4AA]/50 to-[#00D4AA] origin-left"
            style={{
              top: `${20 + i * 15}%`,
              left: '5%',
              width: '40%',
            }}
          />
        ))}
      </div>

      {/* Content Card */}
      <div className="absolute inset-0 flex items-center px-6 lg:px-[10vw]">
        <div
          ref={cardRef}
          className="glass-card max-w-lg p-8 lg:p-10"
        >
          {/* Icon */}
          <div
            ref={iconRef}
            className="w-16 h-16 rounded-full bg-[#00D4AA]/20 flex items-center justify-center mb-6 animate-pulse-glow"
          >
            <Watch className="w-8 h-8 text-[#00D4AA]" />
          </div>

          <h2 className="font-display font-bold text-[clamp(28px,3.5vw,44px)] text-white mb-4 leading-tight">
            Your data,<br />
            <span className="text-[#00D4AA]">automatically</span>
          </h2>

          <p className="text-white/65 text-base lg:text-lg mb-8 leading-relaxed">
            Connect your Garmin once. We analyze every metric — pace, heart rate, 
            cadence, VO2 max, training load, and recovery — to build your personalized profile.
          </p>

          {/* Features */}
          <div className="space-y-4">
            {features.map((feature, i) => (
              <div
                key={i}
                ref={(el) => { featuresRef.current[i] = el; }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-[#00D4AA]/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-4 h-4 text-[#00D4AA]" />
                </div>
                <span className="text-white/80 text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
