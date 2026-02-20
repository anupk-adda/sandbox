/**
 * Chat Component - Redesigned to match landing page
 * Simple chat interface for interacting with pace42.ai
 */

import { useState, useRef, useEffect } from 'react';
import { chatService } from '../services/chatService';
import { authService } from '../services/authService';
import type { Message, WeatherPayload, PlanSummary, WeeklyDetail, AssistantPrompt, TrainingSummary, RunSamplePayload } from '../services/chatService';
import { RunningConditionsWidget } from '../features/weather/RunningConditionsWidget';
import type { HourlyWeather } from '../features/weather/weatherUtils';
import { RunAnalysisInlineCard } from '../features/run-analysis/RunAnalysisInlineCard';
import type { RunSample } from '../features/run-analysis/runAnalysisUtils';
import { Logo } from './auth/Logo';
import { 
  Send, 
  MapPin, 
  TrendingUp, 
  Target, 
  BarChart3, 
  LogOut, 
  Watch,
  AlertCircle,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface ChatProps {
  isGarminConnected?: boolean;
  garminUsername?: string;
}

const MOTIVATIONAL_QUOTES = [
  "The miracle isn't that I finished. The miracle is that I had the courage to start. - John Bingham",
  "Run when you can, walk if you have to, crawl if you must; just never give up. - Dean Karnazes",
  "It's not about having time. It's about making time. - Unknown",
  "The only bad run is the one that didn't happen. - Unknown",
  "Running is nothing more than a series of arguments between the part of your brain that wants to stop and the part that wants to keep going. - Unknown",
  "Your body will argue that there is no justifiable reason to continue. Your only recourse is to call on your spirit, which fortunately functions independently of logic. - Tim Noakes",
  "The obsession with running is really an obsession with the potential for more and more life. - George Sheehan",
  "Ask yourself: 'Can I give more?' The answer is usually: 'Yes'. - Paul Tergat",
  "Don't dream of winning, train for it! - Mo Farah",
  "If you run, you are a runner. It doesn't matter how fast or how far. - John Bingham"
];

type ChatMessage = Message & {
  weather?: WeatherPayload;
  runSamples?: RunSamplePayload[];
  planSummary?: PlanSummary;
  weeklyDetail?: WeeklyDetail;
  trainingSummary?: TrainingSummary;
  prompts?: AssistantPrompt[];
  intent?: string;
};

const cleanText = (text: string) => (
  text
    .replace(/^[-•]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
);

const normalizeLine = (text: string) => (
  cleanText(text)
    .toLowerCase()
    .replace(/[^\w\s%.\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
);

const dedupeLines = (lines: string[]) => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(line);
  }
  return unique;
};

const extractHighlights = (content: string): string[] => {
  const lines = dedupeLines(content.split('\n').map(line => line.trim()).filter(Boolean));
  const bullets = lines.filter(line => line.startsWith('-') || line.startsWith('•'));
  if (bullets.length) {
    return bullets.map(cleanText);
  }
  const headings = lines.filter(line => line.startsWith('##') || line.startsWith('###'));
  if (headings.length) {
    return headings.map(line => cleanText(line.replace(/^#+\s*/, '')));
  }
  return lines.slice(0, 8).map(cleanText);
};

export function Chat({ isGarminConnected = false, garminUsername }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: isGarminConnected 
        ? `Hello! I'm pace42.ai. I can see you're connected as ${garminUsername}. I can help you analyze your running performance, create training plans, and provide personalized coaching advice. How can I help you today?`
        : "Hello! I'm pace42.ai. I can help you with general running advice. Connect your Garmin to unlock personalized coaching based on your actual data."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuote, setCurrentQuote] = useState('');
  const [loadingLabel, setLoadingLabel] = useState('Analyzing your running data...');
  const [progress, setProgress] = useState(0);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [, setLocationError] = useState<string | null>(null);
  const [assistantPrompts, setAssistantPrompts] = useState<AssistantPrompt[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const initLocation = async () => {
      try {
        const coords = await requestLocation();
        setLocation(coords);
      } catch (err) {
        setLocationError(err instanceof Error ? err.message : 'Unable to get location.');
      }
    };
    initLocation();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadActivePlan = async () => {
      if (!isGarminConnected) return;
      try {
        const { plan, prompts } = await chatService.fetchActivePlan();
        if (!isMounted) return;
        if (prompts && prompts.length > 0) {
          setAssistantPrompts(prompts);
        }
        if (plan) {
          setMessages(prev => {
            const alreadyShown = prev.some(msg => msg.planSummary?.planId === plan.planId);
            if (alreadyShown) return prev;
            return [
              ...prev,
              {
                role: 'assistant',
                content: 'Welcome back — here\'s your current plan.',
                planSummary: plan,
              },
            ];
          });
        }
      } catch (err) {
        console.error('Failed to load active plan', err);
      }
    };
    loadActivePlan();
    return () => {
      isMounted = false;
    };
  }, [isGarminConnected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setProgress(0);
    
    const isWeatherRequest = /running conditions|weather|conditions near me/i.test(userMessage.content);
    setLoadingLabel(isWeatherRequest ? 'Fetching weather data...' : 'Analyzing your running data...');

    const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    setCurrentQuote(randomQuote);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 3;
      });
    }, 500);

    try {
      const shouldFetchLocation = /running conditions|weather|conditions near me/i.test(userMessage.content);
      let coords = location || undefined;
      if (shouldFetchLocation && !coords) {
        try {
          coords = await requestLocation();
          setLocation(coords);
        } catch (err) {
          setLocationError(err instanceof Error ? err.message : 'Unable to get location.');
        }
      }

      const response = await chatService.sendMessage([...messages, userMessage], coords);
      
      setProgress(100);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        weather: response.weather,
        runSamples: response.runSamples,
        planSummary: response.planSummary,
        weeklyDetail: response.weeklyDetail,
        trainingSummary: response.trainingSummary,
        prompts: response.prompts,
        intent: response.intent,
      };
      if (response.prompts !== undefined) {
        setAssistantPrompts(response.prompts);
      }

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message || 'Failed to process request.'
          : 'Failed to process request.';
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry — ${message} Please try again.`,
        },
      ]);
      console.error('Chat error:', err);
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
      setProgress(0);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isLoading) return;
    setInput(prompt);
    setTimeout(() => {
      const form = document.querySelector('.chat-input-form') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }, 100);
  };

  const handlePromptAction = (prompt: AssistantPrompt) => {
    if (prompt.action === 'track_training') {
      handleQuickPrompt('Track my training');
      return;
    }
    handleQuickPrompt(prompt.label);
  };

  const handlePlanAction = (action: string) => {
    if (action === 'show_full_plan') {
      handleQuickPrompt('Show full plan');
      return;
    }
    if (action === 'edit_goal') {
      handleQuickPrompt('Edit goal');
      return;
    }
    if (action === 'reschedule') {
      handleQuickPrompt('Reschedule');
      return;
    }
  };

  const handleLogout = () => {
    authService.logout();
    window.location.reload();
  };

  const handleDisconnectGarmin = () => {
    authService.disconnectGarmin();
    window.location.reload();
  };

  const requestLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 8000 }
      );
    });
  };

  const handleRunningConditions = async () => {
    if (isLoading) return;
    setLocationError(null);
    try {
      const coords = location || await requestLocation();
      setLocation(coords);
      setInput('Running conditions near me');
      setTimeout(() => {
        const form = document.querySelector('.chat-input-form') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }, 100);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Unable to get location.');
      setInput('Running conditions near me');
      setTimeout(() => {
        const form = document.querySelector('.chat-input-form') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }, 100);
    }
  };

  const mapWeatherToHourly = (weather?: WeatherPayload): HourlyWeather[] => {
    if (!weather?.hours) return [];
    return weather.hours.map((hour) => ({
      time: hour.time,
      temperatureC: hour.details?.temperature,
      humidity: hour.details?.humidity,
      windKph: hour.details?.wind_speed,
      precipProbability: hour.details?.precip_prob,
      precipitationMm: hour.details?.precipitation,
      lightningProbability: undefined,
    }));
  };

  const mapRunSamples = (samples?: RunSamplePayload[]): RunSample[] => {
    if (!samples) return [];
    return samples.map((sample) => ({
      timestamp: sample.timestamp,
      distanceKm: sample.distance_km,
      metrics: sample.metrics,
    }));
  };

  // Render components
  const renderPlanSummaryCard = (plan?: PlanSummary) => {
    if (!plan) return null;
    return (
      <div className="glass-card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-[#00D4AA]" />
            Plan Summary
          </h3>
          <span className="text-[#00D4AA] text-xs font-mono">
            {plan.goalDistance === 'half' ? 'Half Marathon' : plan.goalDistance === 'marathon' ? 'Marathon' : plan.goalDistance.toUpperCase()}
          </span>
        </div>
        <div className="text-white/60 text-sm mb-3">
          Goal: {plan.goalDate}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-white/40 text-xs mb-1">Phase</div>
            <div className="text-white text-sm">{plan.phase}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-white/40 text-xs mb-1">This week</div>
            <div className="text-white text-sm">{plan.weeklyFocus}</div>
          </div>
        </div>
        {plan.personalizationReason && (
          <div className="text-white/60 text-sm mb-4">
            <span className="text-[#00D4AA]">Made for you:</span> {plan.personalizationReason}
          </div>
        )}
        <div className="border-t border-white/10 pt-4">
          <div className="text-white/40 text-xs mb-2">Next 3 workouts</div>
          <div className="space-y-2">
            {plan.nextWorkouts.map((workout, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-white">{workout.name}</span>
                <span className="text-white/50">{workout.date}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {plan.actions.map(action => (
            <button
              key={action}
              onClick={() => handlePlanAction(action)}
              disabled={isLoading}
              className="flex-1 py-2 px-3 bg-[#00D4AA]/20 hover:bg-[#00D4AA]/30 text-[#00D4AA] text-sm rounded-lg transition-colors"
            >
              {action === 'show_full_plan' ? 'Full plan' : action === 'edit_goal' ? 'Edit goal' : 'Reschedule'}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderWeeklyDetailCard = (weeklyDetail?: WeeklyDetail) => {
    if (!weeklyDetail) return null;
    return (
      <div className="glass-card p-5 mb-4">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#00D4AA]" />
          This Week ({weeklyDetail.weekStart} - {weeklyDetail.weekEnd})
        </h3>
        <div className="space-y-3">
          {weeklyDetail.days.map((day, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
              <div className="w-12 text-white/40 text-sm">{day.date}</div>
              <div className="flex-1">
                <div className="text-white text-sm">{day.name}</div>
                <div className="text-white/50 text-xs">{day.intensity}</div>
              </div>
              {day.why && <div className="text-[#00D4AA] text-xs">{day.why}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTrainingSummaryCard = (summary?: TrainingSummary) => {
    if (!summary) return null;
    return (
      <div className="glass-card p-5 mb-4">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#00D4AA]" />
          Recent Runs
        </h3>
        <div className="mt-4 space-y-2">
          {summary.runs.map((run, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-white text-sm">{run.label}</span>
              <div className="flex gap-4 text-white/60 text-sm">
                {run.distanceKm !== undefined && <span>{run.distanceKm} km</span>}
                {run.pace && <span>{run.pace}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const topPrompt = assistantPrompts.length > 0
    ? [...assistantPrompts].sort((a, b) => a.priority - b.priority)[0]
    : null;

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0A0C0F]/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Logo />
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
            <span className="text-white/60 text-sm">AI Coach Online</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isGarminConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00D4AA]/10 rounded-full">
              <Watch className="w-4 h-4 text-[#00D4AA]" />
              <span className="text-[#00D4AA] text-sm">{garminUsername}</span>
              <button 
                onClick={handleDisconnectGarmin}
                className="text-white/40 hover:text-white ml-1"
                title="Disconnect Garmin"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 rounded-full">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-yellow-500 text-sm">No device</span>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </div>

      {/* Top Prompt */}
      {topPrompt && (
        <div className="px-4 py-3 border-b border-white/5">
          <button
            onClick={() => handlePromptAction(topPrompt)}
            disabled={isLoading}
            className="w-full py-2 px-4 bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 text-[#00D4AA] text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {topPrompt.label}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Prompts */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { icon: BarChart3, label: 'Analyze last run', action: () => handleQuickPrompt('Analyze my last run') },
            { icon: Target, label: 'Next run', action: () => handleQuickPrompt('Recommend my next run') },
            { icon: MapPin, label: 'Conditions', action: handleRunningConditions },
            { icon: TrendingUp, label: 'Progress', action: () => handleQuickPrompt('Analyze my running progress') },
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={prompt.action}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm rounded-full whitespace-nowrap transition-colors"
            >
              <prompt.icon className="w-4 h-4" />
              {prompt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.role === 'user' ? 'bg-white/10' : 'bg-[#00D4AA]/20'
            }`}>
              <span className="text-sm">{message.role === 'user' ? '👤' : '🤖'}</span>
            </div>
            
            <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
              {message.role === 'assistant' ? (() => {
                const hasPlanContent = Boolean(message.planSummary) || Boolean(message.weeklyDetail);
                const hourlyWeather = mapWeatherToHourly(message.weather);
                const shouldShowWeather = Boolean(message.weather) || message.intent === 'weather';
                const runSamples = mapRunSamples(message.runSamples);
                const isAnalysis = /(^|\n)##?\s/.test(message.content);
                const highlights = extractHighlights(message.content);

                if (!isAnalysis && !hasPlanContent) {
                  return (
                    <>
                      <div className="glass-card p-4 text-white/80 text-left">
                        {message.content}
                      </div>
                      {shouldShowWeather && (
                        <RunningConditionsWidget
                          hourly={hourlyWeather}
                          locationLabel={message.weather?.location_label || 'Near you'}
                        />
                      )}
                    </>
                  );
                }

                return (
                  <div className="text-left">
                    {!isAnalysis && message.content && (
                      <div className="glass-card p-4 text-white/80 mb-4">
                        {message.content}
                      </div>
                    )}
                    {renderTrainingSummaryCard(message.trainingSummary)}
                    {renderPlanSummaryCard(message.planSummary)}
                    {renderWeeklyDetailCard(message.weeklyDetail)}
                    {shouldShowWeather && (
                      <RunningConditionsWidget
                        hourly={hourlyWeather}
                        locationLabel={message.weather?.location_label || 'Near you'}
                      />
                    )}
                    
                    {isAnalysis && highlights.length > 0 && (
                      <div className="glass-card p-4 mb-4">
                        <h4 className="text-[#00D4AA] font-semibold mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Coach Focus
                        </h4>
                        <div className="space-y-2">
                          {highlights.map((item, idx) => {
                            const splitIndex = item.indexOf(':');
                            const hasLabel = splitIndex > -1 && splitIndex < 32;
                            const label = hasLabel ? item.slice(0, splitIndex) : null;
                            const value = hasLabel ? item.slice(splitIndex + 1).trim() : item;
                            return (
                              <div key={idx} className="flex gap-2 text-sm">
                                {label && <span className="text-[#00D4AA] whitespace-nowrap">{label}:</span>}
                                <span className="text-white/70">{value}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {runSamples.length > 0 && (
                      <RunAnalysisInlineCard samples={runSamples} />
                    )}
                    
                    {isAnalysis && (
                      <details className="glass-card">
                        <summary className="p-4 cursor-pointer text-white/60 hover:text-white text-sm">
                          Full analysis
                        </summary>
                        <div className="p-4 pt-0 text-white/70 text-sm whitespace-pre-line">
                          {dedupeLines(message.content.split('\n'))
                            .map(line => cleanText(line.replace(/^#+\s*/, '')))
                            .join('\n')}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })() : (
                <div className="glass-card p-4 text-white/80 inline-block text-left">
                  {message.content}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#00D4AA]/20 flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
            <div className="flex-1 max-w-[80%]">
              <div className="glass-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 text-[#00D4AA] animate-spin" />
                  <span className="text-white/60">{loadingLabel}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                  <div 
                    className="h-full bg-[#00D4AA] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-white/40 text-xs italic">
                  "{currentQuote}"
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10 bg-[#0A0C0F]/50 backdrop-blur-md">
        <form className="flex gap-3" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isGarminConnected 
              ? "Ask about your running performance, training plans, or coaching advice..."
              : "Connect your Garmin for personalized coaching..."
            }
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-[#00D4AA] transition-colors resize-none"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-[#00D4AA] hover:bg-[#00D4AA]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-black rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

// Made with Bob
