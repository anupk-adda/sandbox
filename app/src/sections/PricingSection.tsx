import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const plans = [
  {
    name: 'Free',
    description: 'Basic pacing + weekly summary',
    price: '$0',
    period: '/month',
    features: ['Basic pace tracking', 'Weekly summary', '5K race plans', 'Community access'],
    cta: 'Get started free',
    highlighted: false,
  },
  {
    name: 'Pro',
    description: 'AI coaching + race plans',
    price: '$12',
    period: '/month',
    features: ['Everything in Free', 'AI-powered coaching', 'Unlimited race plans', 'Recovery insights', 'Interval workouts', 'Advanced analytics'],
    cta: 'Start Pro trial',
    highlighted: true,
  },
  {
    name: 'Team',
    description: 'Multi-athlete + coach dashboard',
    price: '$49',
    period: '/month',
    features: ['Everything in Pro', 'Up to 10 athletes', 'Coach dashboard', 'Team analytics', 'Priority support', 'Custom integrations'],
    cta: 'Contact sales',
    highlighted: false,
  },
];

export default function PricingSection() {
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
        { y: 30, opacity: 0 },
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
          { y: 50, scale: 0.98, opacity: 0 },
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
            delay: index * 0.1,
          }
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative bg-[#0B0D10] py-[8vh] px-6 lg:px-[6vw] z-[80]"
    >
      {/* Heading */}
      <div ref={headingRef} className="text-center mb-12">
        <h2 className="font-display font-bold text-[clamp(28px,3.5vw,48px)] text-[#F4F6F8] mb-4">
          Pick your pace
        </h2>
        <p className="text-[rgba(244,246,248,0.72)] text-base md:text-lg max-w-md mx-auto">
          Start free. Upgrade when you're ready to race.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1100px] mx-auto">
        {plans.map((plan, index) => (
          <div
            key={index}
            ref={(el) => { cardsRef.current[index] = el; }}
            className={`pricing-card ${plan.highlighted ? 'pricing-card-highlight' : ''}`}
          >
            <div className="mb-6">
              <h3 className="font-display font-semibold text-xl text-[#F4F6F8] mb-1">
                {plan.name}
              </h3>
              <p className="text-[rgba(244,246,248,0.6)] text-sm">
                {plan.description}
              </p>
            </div>

            <div className="mb-6">
              <span className="font-display font-bold text-4xl text-[#F4F6F8]">
                {plan.price}
              </span>
              <span className="text-[rgba(244,246,248,0.6)] text-sm">
                {plan.period}
              </span>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, fIndex) => (
                <li key={fIndex} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-[#FF4D14] mt-0.5 flex-shrink-0" />
                  <span className="text-[rgba(244,246,248,0.8)] text-sm">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <button
              className={`w-full py-3 rounded-full font-medium text-sm transition-all duration-200 ${
                plan.highlighted
                  ? 'bg-[#FF4D14] text-white hover:translate-y-[-2px] hover:scale-[1.02]'
                  : 'border border-[rgba(244,246,248,0.25)] text-[#F4F6F8] hover:border-[rgba(244,246,248,0.5)]'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
