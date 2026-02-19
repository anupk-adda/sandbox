import { useEffect, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadlineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const microLabelRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const crosshairHRef = useRef<HTMLDivElement>(null);
  const crosshairVRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);

  // Load animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      // Background fade in
      tl.fromTo(
        bgRef.current,
        { opacity: 0, scale: 1.05 },
        { opacity: 1, scale: 1, duration: 1.2 }
      );

      // Card entrance
      tl.fromTo(
        cardRef.current,
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.8 },
        '-=0.6'
      );

      // Crosshair draw
      tl.fromTo(
        crosshairHRef.current,
        { scaleX: 0 },
        { scaleX: 1, duration: 0.5 },
        '-=0.4'
      );
      tl.fromTo(
        crosshairVRef.current,
        { scaleY: 0 },
        { scaleY: 1, duration: 0.5 },
        '-=0.4'
      );

      // Headline words
      if (headlineRef.current) {
        const words = headlineRef.current.querySelectorAll('.word');
        tl.fromTo(
          words,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.04 },
          '-=0.3'
        );
      }

      // Subheadline + CTAs
      tl.fromTo(
        [subheadlineRef.current, ctaRef.current],
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 },
        '-=0.2'
      );

      // Micro label + metrics
      tl.fromTo(
        [microLabelRef.current, metricsRef.current],
        { opacity: 0, x: (i) => (i === 0 ? -10 : 10) },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.1 },
        '-=0.3'
      );
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
          end: '+=120%',
          pin: true,
          scrub: 0.6,
          onLeaveBack: () => {
            // Reset all elements to visible when scrolling back to top
            gsap.set(cardRef.current, { opacity: 1, y: 0, scale: 1 });
            gsap.set(headlineRef.current, { opacity: 1, y: 0 });
            gsap.set(subheadlineRef.current, { opacity: 1, y: 0 });
            gsap.set(ctaRef.current, { opacity: 1, y: 0 });
            gsap.set(crosshairHRef.current, { scaleX: 1, opacity: 1 });
            gsap.set(crosshairVRef.current, { scaleY: 1, opacity: 1 });
            gsap.set(metricsRef.current, { opacity: 1, x: 0 });
          },
        },
      });

      // Phase 3: EXIT (70-100%)
      scrollTl.fromTo(
        cardRef.current,
        { y: 0, scale: 1, opacity: 1 },
        { y: '-22vh', scale: 0.86, opacity: 0, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        headlineRef.current,
        { y: 0, opacity: 1 },
        { y: '-10vh', opacity: 0, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        [subheadlineRef.current, ctaRef.current],
        { y: 0, opacity: 1 },
        { y: '-6vh', opacity: 0, ease: 'power2.in' },
        0.72
      );

      scrollTl.fromTo(
        [crosshairHRef.current, crosshairVRef.current],
        { opacity: 1 },
        { opacity: 0, ease: 'power2.in' },
        0.75
      );

      scrollTl.fromTo(
        metricsRef.current,
        { x: 0, opacity: 1 },
        { x: '10vw', opacity: 0, ease: 'power2.in' },
        0.7
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative w-screen h-screen overflow-hidden z-10"
    >
      {/* Background Image */}
      <img
        ref={bgRef}
        src="/hero_road_runner.jpg"
        alt="Runner on road"
        className="section-bg"
      />
      <div className="section-overlay" />

      {/* Micro Label - Top Left */}
      <div
        ref={microLabelRef}
        className="absolute left-[4vw] top-[7vh] micro-label"
      >
        pace42 / COACH
      </div>

      {/* Center Tracking Card */}
      <div
        ref={cardRef}
        className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-[min(72vw,980px)] h-[min(46vh,420px)] tracking-card flex flex-col items-center justify-center"
      >
        {/* Crosshair Lines */}
        <div ref={crosshairHRef} className="crosshair-h origin-center" />
        <div ref={crosshairVRef} className="crosshair-v origin-center" />

        {/* Content */}
        <div className="relative z-10 text-center px-8">
          <h1
            ref={headlineRef}
            className="font-display font-bold text-[clamp(32px,5vw,72px)] leading-[0.95] tracking-[-0.02em] text-[#F4F6F8] mb-6"
          >
            <span className="word inline-block">YOUR</span>{' '}
            <span className="word inline-block">AI</span>{' '}
            <span className="word inline-block">RUNNING</span>{' '}
            <span className="word inline-block">COACH</span>
          </h1>

          <p
            ref={subheadlineRef}
            className="text-[rgba(244,246,248,0.72)] text-base md:text-lg max-w-md mx-auto mb-8"
          >
            Pace, form, and recovery—personalized for every run.
          </p>

          <div ref={ctaRef} className="flex items-center justify-center gap-4">
            <button className="btn-accent">Start free trial</button>
            <button className="btn-outline">See how it works</button>
          </div>
        </div>
      </div>

      {/* Bottom Right Metrics */}
      <div
        ref={metricsRef}
        className="absolute right-[4vw] bottom-[8vh] text-right"
      >
        <div className="mb-3">
          <div className="micro-label mb-1">AVG PACE</div>
          <div className="metric-value">05:42 /km</div>
        </div>
        <div className="mb-3">
          <div className="micro-label mb-1">AVG HR</div>
          <div className="metric-value">148 bpm</div>
        </div>
        <div>
          <div className="micro-label mb-1">CADENCE</div>
          <div className="metric-value">172 spm</div>
        </div>
      </div>
    </section>
  );
}
