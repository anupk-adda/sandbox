import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Mail, Instagram, Youtube } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function FinalPushSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const legalRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Card animation
      gsap.fromTo(
        cardRef.current,
        { y: 80, scale: 0.98, opacity: 0 },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: cardRef.current,
            start: 'top 80%',
            end: 'top 50%',
            scrub: true,
          },
        }
      );

      // Contact animation
      gsap.fromTo(
        contactRef.current,
        { x: -30, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: contactRef.current,
            start: 'top 85%',
            end: 'top 65%',
            scrub: true,
          },
        }
      );

      // Legal animation
      gsap.fromTo(
        legalRef.current,
        { x: 30, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: legalRef.current,
            start: 'top 85%',
            end: 'top 65%',
            scrub: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen py-[8vh] px-6 lg:px-[6vw] z-[90] flex flex-col justify-center"
    >
      {/* Background Image */}
      <img
        src="/final_push_runner.jpg"
        alt="Final push"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D10]/60 via-[#0B0D10]/40 to-[#0B0D10]/80" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1">
        {/* Center Tracking Card */}
        <div
          ref={cardRef}
          className="w-[min(86vw,840px)] tracking-card py-16 px-8 md:px-12 text-center mb-auto mt-[15vh]"
        >
          <h2 className="font-display font-bold text-[clamp(28px,4.5vw,64px)] leading-[0.95] tracking-[-0.02em] text-[#F4F6F8] mb-6">
            READY TO RUN SMARTER?
          </h2>

          <p className="text-[rgba(244,246,248,0.72)] text-base md:text-lg max-w-md mx-auto mb-8">
            Join thousands of runners training with pace42.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button className="btn-accent">Start free trial</button>
            <button className="btn-outline">Contact us</button>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-8 mt-auto pt-[10vh]">
          {/* Contact Info */}
          <div ref={contactRef} className="text-center md:text-left">
            <a
              href="mailto:hello@pace42.ai"
              className="flex items-center gap-2 text-[rgba(244,246,248,0.72)] hover:text-[#F4F6F8] transition-colors mb-3"
            >
              <Mail className="w-4 h-4" />
              <span className="text-sm">hello@pace42.ai</span>
            </a>
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <a
                href="#"
                className="text-[rgba(244,246,248,0.6)] hover:text-[#F4F6F8] transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="text-[rgba(244,246,248,0.6)] hover:text-[#F4F6F8] transition-colors text-sm"
              >
                Strava
              </a>
              <a
                href="#"
                className="text-[rgba(244,246,248,0.6)] hover:text-[#F4F6F8] transition-colors"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Legal */}
          <div ref={legalRef} className="text-center md:text-right">
            <p className="text-[rgba(244,246,248,0.5)] text-sm mb-2">
              © pace42
            </p>
            <div className="flex items-center gap-4 justify-center md:justify-end">
              <a
                href="#"
                className="text-[rgba(244,246,248,0.5)] hover:text-[#F4F6F8] text-sm transition-colors"
              >
                Privacy
              </a>
              <a
                href="#"
                className="text-[rgba(244,246,248,0.5)] hover:text-[#F4F6F8] text-sm transition-colors"
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
