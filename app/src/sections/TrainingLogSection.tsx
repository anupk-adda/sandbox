import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const trainingData = [
  { title: 'Morning tempo', image: '/training_1.jpg', stats: '8.2 km • 05:10/km • 162 bpm' },
  { title: 'Hill repeats', image: '/training_2.jpg', stats: '6.5 km • 06:20/km • 175 bpm' },
  { title: 'Long run', image: '/training_3.jpg', stats: '21.1 km • 05:45/km • 155 bpm' },
  { title: 'Recovery loop', image: '/training_4.jpg', stats: '5.0 km • 06:30/km • 140 bpm' },
  { title: 'Track intervals', image: '/training_5.jpg', stats: '10.0 km • 04:30/km • 170 bpm' },
  { title: 'Night 10K', image: '/training_6.jpg', stats: '10.0 km • 05:20/km • 158 bpm' },
];

export default function TrainingLogSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Heading animation
      gsap.fromTo(
        headingRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: headingRef.current,
            start: 'top 80%',
            end: 'top 55%',
            scrub: true,
          },
        }
      );

      // Cards animation
      cardsRef.current.forEach((card, index) => {
        if (!card) return;
        gsap.fromTo(
          card,
          { y: 60, scale: 0.98, opacity: 0 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.6,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              end: 'top 60%',
              scrub: true,
            },
            delay: index * 0.08,
          }
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="community"
      className="relative bg-[#0B0D10] py-[8vh] px-6 lg:px-[6vw] z-[70]"
    >
      {/* Heading */}
      <div ref={headingRef} className="max-w-[520px] mb-12">
        <h2 className="font-display font-bold text-[clamp(28px,3.5vw,48px)] text-[#F4F6F8] mb-4">
          Training log
        </h2>
        <p className="text-[rgba(244,246,248,0.72)] text-base md:text-lg">
          See what the pace42 community is running this week.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {trainingData.map((item, index) => (
          <div
            key={index}
            ref={(el) => { cardsRef.current[index] = el; }}
            className="training-card group cursor-pointer"
          >
            <div className="relative overflow-hidden rounded-md mb-4">
              <img
                src={item.image}
                alt={item.title}
                className="w-full aspect-[16/10] object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <h3 className="font-display font-semibold text-lg text-[#F4F6F8] mb-1">
              {item.title}
            </h3>
            <p className="font-mono text-xs text-[rgba(244,246,248,0.6)]">
              {item.stats}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
