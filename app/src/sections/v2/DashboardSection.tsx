import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Calendar, TrendingUp, Activity, Sun, Droplets, Wind, Clock, MapPin } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const activities = [
  { day: 'Mon', type: 'Easy Run', distance: '8km', done: true },
  { day: 'Tue', type: 'Intervals', distance: '10km', done: true },
  { day: 'Wed', type: 'Rest', distance: '-', done: true },
  { day: 'Thu', type: 'Tempo', distance: '12km', done: false },
  { day: 'Fri', type: 'Easy Run', distance: '6km', done: false },
  { day: 'Sat', type: 'Long Run', distance: '21km', done: false },
  { day: 'Sun', type: 'Recovery', distance: '5km', done: false },
];

export default function DashboardSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(headingRef.current,
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

      gsap.fromTo(dashboardRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: dashboardRef.current,
            start: 'top 85%',
            end: 'top 50%',
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
      className="relative bg-[#0A0C0F] py-20 lg:py-32 px-6 z-[70]"
    >
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div ref={headingRef} className="text-center mb-12 lg:mb-16">
          <h2 className="font-display font-bold text-[clamp(28px,4vw,48px)] text-white mb-4">
            Your training <span className="text-[#00D4AA]">command center</span>
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Everything you need to track progress, plan ahead, and train smarter.
          </p>
        </div>

        {/* Dashboard Mockup */}
        <div ref={dashboardRef} className="dashboard-mockup">
          {/* Header */}
          <div className="bg-[#111418] border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="text-white/40 text-sm font-mono">pace42.ai/dashboard</div>
            <div className="w-16" />
          </div>

          {/* Content */}
          <div className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Plan */}
            <div className="lg:col-span-2 bg-[#0A0C0F] rounded-lg p-5 border border-white/10">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#00D4AA]" />
                  This Week's Plan
                </h3>
                <span className="text-white/40 text-sm">Week 12 of 16</span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {activities.map((activity, i) => (
                  <div
                    key={i}
                    className={`text-center p-3 rounded-lg border ${
                      activity.done
                        ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="text-white/40 text-xs mb-2">{activity.day}</div>
                    <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                      activity.done ? 'bg-[#00D4AA]/20' : 'bg-white/10'
                    }`}>
                      {activity.done ? (
                        <Activity className="w-4 h-4 text-[#00D4AA]" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-white/30" />
                      )}
                    </div>
                    <div className="text-white text-xs font-medium">{activity.type}</div>
                    <div className="text-white/50 text-xs">{activity.distance}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's Workout */}
            <div className="bg-[#0A0C0F] rounded-lg p-5 border border-white/10">
              <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
                <Sun className="w-4 h-4 text-[#00D4AA]" />
                Today's Workout
              </h3>

              <div className="bg-gradient-to-br from-[#00D4AA]/20 to-[#00D4AA]/5 rounded-lg p-4 mb-4 border border-[#00D4AA]/30">
                <div className="text-[#00D4AA] text-sm font-medium mb-1">Tempo Run</div>
                <div className="text-white text-2xl font-bold mb-2">12 km</div>
                <div className="flex items-center gap-4 text-white/60 text-sm">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    55 min
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    4:35/km
                  </span>
                </div>
              </div>

              {/* Weather */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#00D4AA]/10 flex items-center justify-center">
                    <Sun className="w-5 h-5 text-[#00D4AA]" />
                  </div>
                  <div>
                    <div className="text-white font-medium">22°C</div>
                    <div className="text-white/50 text-xs">Sunny</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-white/60 text-xs">
                    <Droplets className="w-3 h-3" />
                    45%
                  </div>
                  <div className="flex items-center gap-1 text-white/60 text-xs">
                    <Wind className="w-3 h-3" />
                    8 km/h
                  </div>
                </div>
              </div>
            </div>

            {/* Fitness Trend */}
            <div className="bg-[#0A0C0F] rounded-lg p-5 border border-white/10">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#00D4AA]" />
                Fitness Trend
              </h3>

              <div className="h-32 flex items-end gap-1">
                {[40, 45, 42, 48, 52, 50, 55, 58, 56, 62, 65, 68].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-[#00D4AA]/40 to-[#00D4AA] rounded-t"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>

              <div className="flex justify-between mt-3 text-white/40 text-xs">
                <span>12 weeks ago</span>
                <span>Today</span>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">VO2 Max</span>
                  <span className="text-[#00D4AA] font-mono font-bold">48.2</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-white/60 text-sm">Training Load</span>
                  <span className="text-white font-mono font-bold">842</span>
                </div>
              </div>
            </div>

            {/* Recent Activities */}
            <div className="lg:col-span-2 bg-[#0A0C0F] rounded-lg p-5 border border-white/10">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00D4AA]" />
                Recent Activities
              </h3>

              <div className="space-y-3">
                {[
                  { type: 'Interval Run', date: 'Yesterday', distance: '10.2 km', pace: '4:28/km', hr: '165 bpm' },
                  { type: 'Easy Run', date: '2 days ago', distance: '8.5 km', pace: '5:45/km', hr: '142 bpm' },
                  { type: 'Long Run', date: '4 days ago', distance: '18.0 km', pace: '5:12/km', hr: '155 bpm' },
                ].map((run, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#00D4AA]/10 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-[#00D4AA]" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{run.type}</div>
                        <div className="text-white/50 text-xs">{run.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-white font-mono">{run.distance}</div>
                        <div className="text-white/50 text-xs">Distance</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-mono">{run.pace}</div>
                        <div className="text-white/50 text-xs">Pace</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-mono">{run.hr}</div>
                        <div className="text-white/50 text-xs">Avg HR</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
