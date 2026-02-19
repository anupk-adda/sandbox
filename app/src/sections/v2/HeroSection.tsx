import { useEffect, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Watch, Cloud, Activity, MessageSquare } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const floatingData = [
  { icon: Activity, label: "Today's pace", value: '5:32/km', position: 'left-[5%] top-[20%]' },
  { icon: Cloud, label: 'Weather', value: '18°C, 65%', position: 'right-[8%] top-[25%]' },
  { icon: Watch, label: 'Recovery', value: '87%', position: 'left-[8%] bottom-[25%]' },
];

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadlineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const dataCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Load animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Headline words stagger
      if (headlineRef.current) {
        const words = headlineRef.current.querySelectorAll('.word');
        tl.fromTo(words, 
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }
        );
      }

      // Subheadline
      tl.fromTo(subheadlineRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6 },
        '-=0.4'
      );

      // CTAs
      tl.fromTo(ctaRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5 },
        '-=0.3'
      );

      // Floating data cards
      dataCardsRef.current.forEach((card, i) => {
        if (!card) return;
        tl.fromTo(card,
          { x: i % 2 === 0 ? -50 : 50, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.7, ease: 'power2.out' },
          0.4 + i * 0.15
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Scroll animation
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
          onLeaveBack: () => {
            gsap.set(headlineRef.current, { opacity: 1, y: 0 });
            gsap.set(subheadlineRef.current, { opacity: 1, y: 0 });
            gsap.set(ctaRef.current, { opacity: 1, y: 0 });
            dataCardsRef.current.forEach(card => {
              if (card) gsap.set(card, { opacity: 1, x: 0 });
            });
          },
        },
      });

      // Exit animation
      scrollTl.fromTo(headlineRef.current,
        { y: 0, opacity: 1 },
        { y: '-15vh', opacity: 0, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(subheadlineRef.current,
        { y: 0, opacity: 1 },
        { y: '-10vh', opacity: 0, ease: 'power2.in' },
        0.72
      );

      scrollTl.fromTo(ctaRef.current,
        { y: 0, opacity: 1 },
        { y: '-8vh', opacity: 0, ease: 'power2.in' },
        0.74
      );

      dataCardsRef.current.forEach((card, i) => {
        if (!card) return;
        scrollTl.fromTo(card,
          { opacity: 1 },
          { opacity: 0, ease: 'power2.in' },
          0.75 + i * 0.02
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-screen h-screen overflow-hidden z-10"
    >
      {/* Background */}
      <img
        src="/v2_hero_runner.jpg"
        alt="Runner with data"
        className="section-bg"
      />
      <div className="section-overlay" />
      <div className="absolute inset-0 data-grid opacity-50" />

      {/* Floating Data Cards */}
      {floatingData.map((item, i) => (
        <div
          key={i}
          ref={(el) => { dataCardsRef.current[i] = el; }}
          className={`absolute ${item.position} hidden lg:block`}
        >
          <div className="glass-card px-5 py-4 animate-float" style={{ animationDelay: `${i * 0.5}s` }}>
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-[#00D4AA]" />
              <div>
                <div className="micro-label">{item.label}</div>
                <div className="font-mono text-white font-medium">{item.value}</div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-4xl">
          <h1
            ref={headlineRef}
            className="font-display font-bold text-[clamp(40px,6vw,80px)] leading-[1.0] tracking-[-0.03em] text-white mb-6"
          >
            <span className="word inline-block">Your</span>{' '}
            <span className="word inline-block">run.</span>{' '}
            <span className="word inline-block">Your</span>{' '}
            <span className="word inline-block">plan.</span>{' '}
            <span className="word inline-block text-[#00D4AA] glow-text">Your</span>{' '}
            <span className="word inline-block text-[#00D4AA] glow-text">progress.</span>
          </h1>

          <p
            ref={subheadlineRef}
            className="text-white/65 text-lg md:text-xl max-w-2xl mx-auto mb-10"
          >
            AI-powered training that adapts to your Garmin data, weather conditions, 
            and how you actually feel.
          </p>

          <div ref={ctaRef} className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/chat" className="btn-accent flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Start chatting
            </Link>
            <button 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-outline"
            >
              See how it works
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
