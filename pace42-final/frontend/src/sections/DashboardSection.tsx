import { useState, useEffect } from 'react';
import { chatService, type PlanSummary } from '../services/chatService';
import { Calendar, Target, TrendingUp, Award, Clock, ChevronRight, CheckCircle2, Circle } from 'lucide-react';

interface DashboardSectionProps {
  onBack: () => void;
}

export function DashboardSection({ onBack }: DashboardSectionProps) {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      // Check subscription status
      const subStatus = await chatService.getSubscriptionStatus();
      setIsSubscribed(subStatus.subscribed);
      
      // Load active plan
      const planData = await chatService.fetchActivePlan();
      if (planData.plan) {
        setPlan(planData.plan);
        // TODO: Load current week details if needed
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeToggle = async () => {
    const newStatus = !isSubscribed;
    const success = await chatService.setSubscription(newStatus);
    if (success) {
      setIsSubscribed(newStatus);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0C0F] flex items-center justify-center">
        <div className="text-white/60">Loading dashboard...</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#0A0C0F] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={onBack} className="text-white/60 hover:text-white transition-colors">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-white">Training Dashboard</h1>
          </div>
          
          <div className="glass-card p-8 text-center">
            <Target className="w-16 h-16 text-[#00D4AA] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Active Training Plan</h2>
            <p className="text-white/60 mb-6">
              You don't have an active training plan yet. Subscribe to a plan to track your progress.
            </p>
            <button 
              onClick={onBack}
              className="px-6 py-3 bg-[#00D4AA] text-black font-semibold rounded-lg hover:bg-[#00D4AA]/90 transition-colors"
            >
              Browse Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0C0F] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-white/60 hover:text-white transition-colors">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-white">Training Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isSubscribed 
                ? 'bg-[#00D4AA]/20 text-[#00D4AA]' 
                : 'bg-white/10 text-white/60'
            }`}>
              {isSubscribed ? 'Subscribed' : 'Not Subscribed'}
            </span>
            <button
              onClick={handleSubscribeToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isSubscribed
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-[#00D4AA] text-black hover:bg-[#00D4AA]/90'
              }`}
            >
              {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
            </button>
          </div>
        </div>

        {/* Plan Overview Card */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-6 h-6 text-[#00D4AA]" />
                <h2 className="text-xl font-bold text-white">
                  {plan.goalDistance === '5k' && '5K Race'}
                  {plan.goalDistance === '10k' && '10K Race'}
                  {plan.goalDistance === 'half' && 'Half Marathon'}
                  {plan.goalDistance === 'marathon' && 'Marathon'}
                </h2>
              </div>
              <p className="text-white/60">{plan.personalizationReason}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/40 mb-1">Goal Date</div>
              <div className="text-lg font-semibold text-white">
                {new Date(plan.goalDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                <TrendingUp className="w-4 h-4" />
                Current Phase
              </div>
              <div className="text-lg font-semibold text-white">{plan.phase}</div>
              <div className="text-sm text-white/50">{plan.weeklyFocus}</div>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                <Clock className="w-4 h-4" />
                Weekly Commitment
              </div>
              <div className="text-lg font-semibold text-white">{plan.nextWorkouts.length} runs</div>
              <div className="text-sm text-white/50">Per week</div>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                <Calendar className="w-4 h-4" />
                Next Workout
              </div>
              <div className="text-lg font-semibold text-white">
                {plan.nextWorkouts[0]?.name || 'Rest Day'}
              </div>
              <div className="text-sm text-white/50">
                {plan.nextWorkouts[0]?.date 
                  ? new Date(plan.nextWorkouts[0].date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })
                  : 'No upcoming'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Schedule */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">This Week's Schedule</h3>
          
          <div className="space-y-3">
            {plan.nextWorkouts.map((workout, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    idx === 0 
                      ? 'bg-[#00D4AA]/20 text-[#00D4AA]' 
                      : 'bg-white/10 text-white/40'
                  }`}>
                    {idx === 0 ? <Circle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-medium text-white">{workout.name}</div>
                    <div className="text-sm text-white/50">
                      {new Date(workout.date).toLocaleDateString('en-US', { 
                        weekday: 'long',
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    workout.effort === 'easy' ? 'bg-green-500/20 text-green-400' :
                    workout.effort === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                    workout.effort === 'hard' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {workout.effort}
                  </span>
                  <ChevronRight className="w-5 h-5 text-white/30" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          {plan.actions.map((action, idx) => (
            <button
              key={idx}
              className="flex-1 glass-card p-4 text-left hover:bg-white/10 transition-colors group"
            >
              <div className="text-white font-medium group-hover:text-[#00D4AA] transition-colors">
                {action}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
