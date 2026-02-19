import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import Navigation from './components/Navigation';
import HeroSection from './sections/v2/HeroSection';
import GarminSection from './sections/v2/GarminSection';
import WeatherSection from './sections/v2/WeatherSection';
import AdaptationSection from './sections/v2/AdaptationSection';
import PostRunSection from './sections/v2/PostRunSection';
import CoachingSection from './sections/v2/CoachingSection';
import DashboardSection from './sections/v2/DashboardSection';
import FinalCTASection from './sections/v2/FinalCTASection';
import { AuthFlow } from './components/auth/AuthFlow';

gsap.registerPlugin(ScrollTrigger);

// Landing Page Component
function LandingPage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      const pinned = ScrollTrigger.getAll()
        .filter((st) => st.vars.pin)
        .sort((a, b) => a.start - b.start);

      const maxScroll = ScrollTrigger.maxScroll(window);
      if (!maxScroll || pinned.length === 0) return;

      const pinnedRanges = pinned.map((st) => ({
        start: st.start / maxScroll,
        end: (st.end ?? st.start) / maxScroll,
        center: (st.start + ((st.end ?? st.start) - st.start) * 0.5) / maxScroll,
      }));

      ScrollTrigger.create({
        snap: {
          snapTo: (value: number) => {
            const inPinned = pinnedRanges.some(
              (r) => value >= r.start - 0.02 && value <= r.end + 0.02
            );
            if (!inPinned) return value;

            const target = pinnedRanges.reduce(
              (closest, r) =>
                Math.abs(r.center - value) < Math.abs(closest - value)
                  ? r.center
                  : closest,
              pinnedRanges[0]?.center ?? 0
            );
            return target;
          },
          duration: { min: 0.15, max: 0.35 },
          delay: 0,
          ease: 'power2.out',
        },
      });
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return (
    <div className="relative bg-[#0A0C0F] min-h-screen">
      <Navigation />
      <main className="relative">
        <section id="hero">
          <HeroSection />
        </section>
        <section id="features">
          <GarminSection />
        </section>
        <section id="how-it-works">
          <WeatherSection />
        </section>
        <AdaptationSection />
        <PostRunSection />
        <CoachingSection />
        <section id="dashboard">
          <DashboardSection />
        </section>
        <FinalCTASection />
      </main>
    </div>
  );
}

// Main App with Router
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/chat" element={<AuthFlow />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
