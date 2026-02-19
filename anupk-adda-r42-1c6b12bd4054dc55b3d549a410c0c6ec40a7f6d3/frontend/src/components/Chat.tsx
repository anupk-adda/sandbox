/**
 * Chat Component
 * Simple chat interface for interacting with pace42.ai
 */

import { useState, useRef, useEffect } from 'react';
import { chatService } from '../services/chatService';
import type { Message, Chart, WeatherPayload, PlanSummary, WeeklyDetail, AssistantPrompt, TrainingSummary } from '../services/chatService';
import { GraphWidget } from './graphs/v2/GraphWidget';
import './Chat.css';

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
  "If you run, you are a runner. It doesn't matter how fast or how far. It doesn't matter if today is your first day or if you've been running for twenty years. There is no test to pass, no license to earn, no membership card to get. You just run. - John Bingham"
];

type ChatMessage = Message & {
  charts?: Chart[];
  weather?: WeatherPayload;
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

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m pace42.ai. I can help you analyze your running performance, create training plans, and provide personalized coaching advice. How can I help you today?'
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
      try {
        const { plan, prompts } = await chatService.fetchActivePlan('anup');
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
                content: 'Welcome back — here’s your current plan.',
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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim()
    };

    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    // Clear any previous inline error state by resetting progress/labels.
    setProgress(0);
    
    const isWeatherRequest = /running conditions|weather|conditions near me/i.test(userMessage.content);
    setLoadingLabel(isWeatherRequest ? 'Fetching weather data...' : 'Analyzing your running data...');

    // Pick a random motivational quote
    const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    setCurrentQuote(randomQuote);

    // Simulate progress (since we don't have real progress from backend)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev; // Cap at 95% until we get response
        return prev + Math.random() * 3; // Increment by 0-3%
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
      
      // Complete progress
      setProgress(100);
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        charts: response.charts,
        weather: response.weather,
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
    // Trigger submit after setting input
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

  const renderPlanSummaryCard = (plan?: PlanSummary) => {
    if (!plan) return null;
    return (
      <div className="plan-summary-card">
        <div className="plan-summary-header">
          <div className="plan-summary-title">Plan Summary</div>
          <div className="plan-summary-goal">
            Goal: {plan.goalDistance === 'half' ? 'Half Marathon' : plan.goalDistance === 'marathon' ? 'Marathon' : plan.goalDistance.toUpperCase()} — {plan.goalDate}
          </div>
        </div>
        <div className="plan-summary-meta">
          <div><strong>Phase:</strong> {plan.phase}</div>
          <div><strong>This week:</strong> {plan.weeklyFocus}</div>
        </div>
        {plan.personalizationReason && (
          <div className="plan-summary-personalized">
            <strong>Made for you:</strong> {plan.personalizationReason}
          </div>
        )}
        <div className="plan-summary-next">
          <div className="plan-summary-section">Next 3 workouts</div>
          <ul>
            {plan.nextWorkouts.map((workout) => (
              <li key={`${workout.date}-${workout.name}`}>
                {workout.date}: {workout.name} ({workout.effort})
              </li>
            ))}
          </ul>
        </div>
        <div className="plan-summary-actions">
          {plan.actions.map(action => (
            <button
              key={action}
              className="plan-action-btn"
              onClick={() => handlePlanAction(action)}
              disabled={isLoading}
            >
              {action === 'show_full_plan'
                ? 'Show full plan'
                : action === 'edit_goal'
                  ? 'Edit goal'
                  : action === 'reschedule'
                    ? 'Reschedule'
                    : action}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderWeeklyDetailCard = (weeklyDetail?: WeeklyDetail) => {
    if (!weeklyDetail) return null;
    return (
      <div className="plan-week-card">
        <div className="plan-week-title">This Week ({weeklyDetail.weekStart} to {weeklyDetail.weekEnd})</div>
        <ul className="plan-week-list">
          {weeklyDetail.days.map((day) => (
            <li key={`${day.date}-${day.name}`} className="plan-week-item">
              <div className="plan-week-day">{day.date}</div>
              <div className="plan-week-desc">
                <span className="plan-week-name">{day.name}</span>
                <span className="plan-week-intensity">{day.intensity}</span>
              </div>
              {day.why && <div className="plan-week-why">Why: {day.why}</div>}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderSubscribeCard = (plan?: PlanSummary) => {
    if (!plan) return null;
    const isSubscribed = Boolean(plan.isSubscribed);
    return (
      <div className="subscribe-card">
        <div className="subscribe-title">
          {isSubscribed ? 'You are subscribed to adaptive tracking' : 'Unlock adaptive coaching + run tracking'}
        </div>
        <button
          className="subscribe-btn"
          disabled={isLoading}
          onClick={() => handleQuickPrompt(isSubscribed ? 'Unsubscribe from plan' : 'Subscribe to plan')}
        >
          {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
        </button>
      </div>
    );
  };

  const renderTrainingSummaryCard = (summary?: TrainingSummary, charts?: Chart[]) => {
    if (!summary) return null;
    return (
      <div className="training-summary-card">
        <div className="training-summary-title">Recent Runs (Plan)</div>
        <GraphWidget charts={charts} />
        <div className="training-summary-list">
          {summary.runs.map((run, idx) => (
            <div key={`${run.label}-${idx}`} className="training-summary-item">
              <div className="training-summary-label">{run.label}</div>
              <div className="training-summary-metrics">
                {run.distanceKm !== undefined && <span>{run.distanceKm} km</span>}
                {run.pace && <span>{run.pace}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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

  const renderWeatherCard = (weather: WeatherPayload | undefined) => {
    if (!weather || !weather.hours || weather.hours.length === 0) {
      return null;
    }

    return (
      <div className="weather-card">
        <div className="weather-header">
          <div className="weather-title">Running Conditions</div>
          <div className="weather-location">{weather.location_label || 'Near you'}</div>
        </div>
        {weather.current_time && (
          <div className="weather-asof">As of {weather.current_time}</div>
        )}
        <div className="weather-summary">
          <strong>{weather.summary}</strong> {weather.recommendation}
        </div>
        {weather.detail && <div className="weather-detail">{weather.detail}</div>}
        <div className="weather-bars">
          <div className="weather-axis">
            <span>Good</span>
            <span>Fair</span>
            <span>Poor</span>
          </div>
          <div className="weather-bar-row">
            {weather.hours.map((hour, idx) => (
              <div key={`hour-${idx}`} className="weather-bar-item">
                <div className="weather-bar-track">
                  <div
                    className={`weather-bar ${hour.label.toLowerCase()}`}
                    style={{ height: `${Math.max(10, hour.score)}%` }}
                  ></div>
                </div>
                <span className="weather-time">{hour.time}</span>
                <div className="weather-tooltip">
                  <div className="weather-tooltip-title">{hour.label}</div>
                  {hour.details && (
                    <div className="weather-tooltip-body">
                      {hour.details.temperature !== undefined && (
                        <div>Temp: {hour.details.temperature.toFixed(0)}°C</div>
                      )}
                      {hour.details.humidity !== undefined && (
                        <div>Humidity: {hour.details.humidity.toFixed(0)}%</div>
                      )}
                      {hour.details.dew_point !== undefined && (
                        <div>Dew point: {hour.details.dew_point.toFixed(0)}°C</div>
                      )}
                      {hour.details.wind_speed !== undefined && (
                        <div>Wind: {hour.details.wind_speed.toFixed(0)} km/h</div>
                      )}
                      {hour.details.precip_prob !== undefined && (
                        <div>Rain: {hour.details.precip_prob.toFixed(0)}%</div>
                      )}
                    </div>
                  )}
                  {hour.reason && <div className="weather-tooltip-reason">{hour.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        {weather.attribution && <div className="weather-attribution">{weather.attribution}</div>}
      </div>
    );
  };

  const topPrompt = assistantPrompts.length > 0
    ? [...assistantPrompts].sort((a, b) => a.priority - b.priority)[0]
    : null;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>🏃 pace42.ai</h1>
        <p>Run smarter, not harder.</p>
      </div>

      {topPrompt && (
        <div className="assistant-top-prompt">
          <button
            className="assistant-top-prompt-btn"
            onClick={() => handlePromptAction(topPrompt)}
            disabled={isLoading}
          >
            {topPrompt.label}
          </button>
        </div>
      )}

      <div className="quick-prompts">
        <button
          className="quick-prompt-btn"
          onClick={() => handleQuickPrompt('Analyze my last run')}
          disabled={isLoading}
          title="Agent 1: Current Run Analyzer"
        >
          📊 Analyze my last run
        </button>
        <button
          className="quick-prompt-btn"
          onClick={() => handleQuickPrompt('Recommend my next run')}
          disabled={isLoading}
          title="Agent 2: Last 3 Runs Comparator"
        >
          🎯 Recommend my next run
        </button>
        <button
          className="quick-prompt-btn"
          onClick={handleRunningConditions}
          disabled={isLoading}
          title="Weather Agent: Running conditions near you"
        >
          ☀️ Running conditions
        </button>
        <button
          className="quick-prompt-btn"
          onClick={() => handleQuickPrompt('Analyze my running progress')}
          disabled={isLoading}
          title="Agent 3: Fitness Trend Analyzer"
        >
          📈 Analyze my running progress
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role === 'user' ? 'message-user' : 'message-assistant'}`}
          >
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              {message.role === 'assistant' ? (() => {
                const hasPlanContent = Boolean(message.planSummary) || Boolean(message.weeklyDetail);
                const isAnalysis = Boolean(message.charts?.length) || /(^|\n)##?\s/.test(message.content);
                const highlights = extractHighlights(message.content);

                if (!isAnalysis && !hasPlanContent) {
                  return (
                    <>
                      <div className="message-text">{message.content}</div>
                      {renderWeatherCard(message.weather)}
                    </>
                  );
                }

                return (
                  <div className="assistant-panel">
                      {!isAnalysis && message.content && (
                        <div className="message-text">{message.content}</div>
                      )}
                      {renderTrainingSummaryCard(message.trainingSummary, message.charts)}
                      {renderPlanSummaryCard(message.planSummary)}
                      {renderSubscribeCard(message.planSummary)}
                      {renderWeeklyDetailCard(message.weeklyDetail)}
                    {isAnalysis && highlights.length > 0 && (
                      <div className="assistant-focus">
                          <div className="assistant-focus-title">Coach Focus</div>
                          <div className="assistant-focus-list">
                            {highlights.map((item, idx) => {
                              const splitIndex = item.indexOf(':');
                              const hasLabel = splitIndex > -1 && splitIndex < 32;
                              const label = hasLabel ? item.slice(0, splitIndex) : null;
                              const value = hasLabel ? item.slice(splitIndex + 1).trim() : item;
                              return (
                                <div key={`${index}-focus-${idx}`} className="assistant-focus-item">
                                  {label && <span className="assistant-focus-label">{label}</span>}
                                  <span className="assistant-focus-value">{value}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {isAnalysis && !message.trainingSummary && renderWeatherCard(message.weather)}
                      {isAnalysis && !message.trainingSummary && <GraphWidget charts={message.charts} />}
                      {isAnalysis && (
                        <details className="assistant-details">
                          <summary>Full analysis</summary>
                          <div className="message-text">
                            {dedupeLines(message.content.split('\n'))
                              .map(line => cleanText(line.replace(/^#+\s*/, '')))
                              .join('\n')}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })() : (
                <div className="message-text">{message.content}</div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message message-assistant loading-message">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="loading-container">
                <div className="loading-header">
                  <span className="loading-icon">🏃‍♂️</span>
                  <span className="loading-text">{loadingLabel}</span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="progress-percentage">{Math.round(progress)}%</div>
                <div className="motivational-quote">
                  <span className="quote-icon">💪</span>
                  <em>{currentQuote}</em>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about your running performance, training plans, or coaching advice..."
          rows={3}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="chat-submit"
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? '⏳' : '📤'} Send
        </button>
      </form>
    </div>
  );
}

// Made with Bob
