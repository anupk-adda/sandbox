import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function CityIntervalSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadlineRef = useRef<HTMLDivElement>(null);
  const microLabelRef = useRef<HTMLDivElement>(null);
  const leftMetricRef = useRef<HTMLDivElement>(null);
  const rightMetricRef = useRef<HTMLDivElement>(null);
  const crosshairHRef = useRef<HTMLDivElement>(null);
  const crosshairVRef = useRef<HTMLDivElement>(null);

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
      scrollTl.fromTo(
        cardRef.current,
        { x: '60vw', scale: 0.9, opacity: 0 },
        { x: 0, scale: 1, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(
        headlineRef.current,
        { y: '10vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'none' },
        0.08
      );

      scrollTl.fromTo(
        subheadlineRef.current,
        { y: '6vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'none' },
        0.14
      );

      scrollTl.fromTo(
        microLabelRef.current,
        { y: '-6vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(
        [leftMetricRef.current, rightMetricRef.current],
        { y: '8vh', opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.02, ease: 'none' },
        0.1
      );

      scrollTl.fromTo(
        [crosshairHRef.current, crosshairVRef.current],
        { scaleX: 0, scaleY: 0 },
        { scaleX: 1, scaleY: 1, ease: 'none' },
        0.08
      );

      // Phase 3: EXIT (70-100%)
      scrollTl.fromTo(
        cardRef.current,
        { y: 0, scale: 1, opacity: 1 },
        { y: '18vh', scale: 0.84, opacity: 0, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        headlineRef.current,
        { y: 0, opacity: 1 },
        { y: '-8vh', opacity: 0, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        subheadlineRef.current,
        { y: 0, opacity: 1 },
        { y: '10vh', opacity: 0, ease: 'power2.in' },
        0.72
      );

      scrollTl.fromTo(
        [leftMetricRef.current, rightMetricRef.current],
        { y: 0, opacity: 1 },
        { y: '6vh', opacity: 0, ease: 'power2.in' },
        0.7
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="coaching"
      className="relative w-screen h-screen overflow-hidden z-30"
    >
      {/* Background Image */}
      <img
        src="/city_interval_runner.jpg"
        alt="City runner"
        className="section-bg"
      />
      <div className="section-overlay" />

      {/* Top Micro Label */}
      <div
        ref={microLabelRef}
        className="absolute top-[7vh] left-1/2 -translate-x-1/2 micro-label"
      >
        INTERVAL MODE
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
          <h2
            ref={headlineRef}
            className="font-display font-bold text-[clamp(36px,5.5vw,80px)] leading-[0.95] tracking-[-0.02em] text-[#F4F6F8] mb-6"
          >
            CITY INTERVALS
          </h2>

          <div ref={subheadlineRef} className="text-center">
            <p className="text-[rgba(244,246,248,0.72)] text-base md:text-lg max-w-md mx-auto mb-6">
              Structured efforts that fit your streets.
            </p>
            <button className="btn-accent text-xs py-2.5 px-5">
              Try interval mode
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Left Metric */}
      <div
        ref={leftMetricRef}
        className="absolute left-[4vw] bottom-[8vh]"
      >
        <div className="micro-label mb-1">CURRENT</div>
        <div className="metric-value">04:12 /km</div>
      </div>

      {/* Bottom Right Metric */}
      <div
        ref={rightMetricRef}
        className="absolute right-[4vw] bottom-[8vh] text-right"
      >
        <div className="micro-label mb-1">HEART RATE</div>
        <div className="metric-value">161 bpm</div>
      </div>
    </section>
  );
}
