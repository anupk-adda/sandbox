import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CloudSun, Droplets, Wind, Thermometer } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function WeatherSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<(HTMLDivElement | null)[]>([]);

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
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(widgetRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, ease: 'none' },
        0.1
      );

      statsRef.current.forEach((stat, i) => {
        if (!stat) return;
        scrollTl.fromTo(stat,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, ease: 'none' },
          0.15 + i * 0.02
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
      className="relative w-screen h-screen overflow-hidden z-30"
    >
      {/* Background */}
      <img
        src="/v2_weather_runner.jpg"
        alt="Weather conditions"
        className="section-bg"
      />
      <div className="absolute inset-0 bg-[#0A0C0F]/75" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div
          ref={cardRef}
          className="glass-card max-w-xl w-full p-8 lg:p-10"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-[#00D4AA]/20 flex items-center justify-center">
              <CloudSun className="w-7 h-7 text-[#00D4AA]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-[clamp(24px,3vw,36px)] text-white">
                Weather-aware training
              </h2>
            </div>
          </div>

          <p className="text-white/65 text-base lg:text-lg mb-8 leading-relaxed">
            Heat, humidity, wind, and air quality — we factor it all in. 
            Your planned pace automatically adjusts so you train smart, not just hard.
          </p>

          {/* Weather Widget */}
          <div
            ref={widgetRef}
            className="bg-[#111418] rounded-xl p-6 border border-white/10 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="micro-label">Current Conditions</span>
              <span className="text-[#00D4AA] text-xs font-mono">LIVE</span>
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div className="flex items-center gap-3">
                <Thermometer className="w-5 h-5 text-[#00D4AA]" />
                <span className="font-mono text-2xl text-white">28°C</span>
              </div>
              <div className="flex items-center gap-3">
                <Droplets className="w-5 h-5 text-[#00D4AA]" />
                <span className="font-mono text-2xl text-white">72%</span>
              </div>
              <div className="flex items-center gap-3">
                <Wind className="w-5 h-5 text-[#00D4AA]" />
                <span className="font-mono text-2xl text-white">12km/h</span>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Adjusted pace target</span>
                <span className="font-mono text-[#00D4AA] text-lg">+15s/km</span>
              </div>
              <p className="text-white/40 text-xs mt-1">Due to heat & humidity</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Hydration reminder', value: '500ml/hour' },
              { label: 'UV Index', value: 'High (7)' },
            ].map((stat, i) => (
              <div
                key={i}
                ref={(el) => { statsRef.current[i] = el; }}
                className="data-card"
              >
                <div className="micro-label mb-1">{stat.label}</div>
                <div className="font-mono text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
