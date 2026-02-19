/**
 * Chat Service
 * Handles communication with the backend API chat endpoint
 */

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  intent: string;
  requiresGarminData: boolean;
  agent?: string;
  confidence: number;
  charts?: Chart[];
  weather?: WeatherPayload;
  planSummary?: PlanSummary;
  weeklyDetail?: WeeklyDetail;
  prompts?: AssistantPrompt[];
  trainingSummary?: TrainingSummary;
}

export interface ChartSeries {
  label: string;
  data: number[];
  color?: string;
  rawData?: number[];
  unit?: string;
}

export interface Chart {
  id: string;
  type: 'line';
  title: string;
  xLabels: string[];
  yLabel?: string;
  series: ChartSeries[];
  note?: string;
}

export interface WeatherHour {
  time: string;
  score: number;
  label: 'Good' | 'Fair' | 'Poor';
  reason?: string;
  details?: {
    temperature?: number;
    humidity?: number;
    dew_point?: number;
    wind_speed?: number;
    precip_prob?: number;
    precipitation?: number;
  };
}

export interface WeatherPayload {
  location_label?: string;
  timezone?: string;
  current_time?: string | null;
  detail?: string | null;
  summary?: string;
  recommendation?: string;
  rating_now?: string;
  current?: {
    temperature?: number;
    apparent_temperature?: number;
    humidity?: number;
    precipitation?: number;
    wind_speed?: number;
    weather_code?: number;
  };
  hours: WeatherHour[];
  attribution?: string;
  needs_location_confirm?: boolean;
}

export interface PlanSummary {
  planId: string;
  goalDistance: '5k' | '10k' | 'half' | 'marathon';
  goalDate: string;
  phase: string;
  weeklyFocus: string;
  personalizationReason?: string;
  isSubscribed?: boolean;
  nextWorkouts: Array<{ date: string; name: string; effort: string }>;
  actions: string[];
}

export interface WeeklyDetail {
  weekStart: string;
  weekEnd: string;
  days: Array<{ date: string; name: string; intensity: string; why?: string }>;
}

export interface AssistantPrompt {
  id: string;
  label: string;
  action: string;
  priority: number;
}

export interface TrainingSummary {
  runs: Array<{
    label: string;
    distanceKm?: number;
    pace?: string;
  }>;
}

export interface ActivePlanResponse {
  status: 'success' | 'empty';
  plan: PlanSummary | null;
  prompts?: AssistantPrompt[];
}

export class ChatService {
  private baseUrl: string;
  private sessionId?: string;
  private runDataCache: Map<number, { charts: Chart[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  constructor(baseUrl: string = BACKEND_API_URL) {
    this.baseUrl = baseUrl;
  }

  async sendMessage(messages: Message[], location?: { latitude: number; longitude: number }): Promise<ChatResponse> {
    // Get the last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    
    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    const request: ChatRequest = {
      message: lastUserMessage.content,
      sessionId: this.sessionId,
      location,
    };

    const response = await fetch(`${this.baseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage =
        error?.error?.message ||
        error?.error ||
        error?.detail ||
        'Failed to send message';
      throw new Error(
        typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)
      );
    }

    const data = await response.json();
    
    // Store session ID for future requests
    if (data.sessionId) {
      this.sessionId = data.sessionId;
    }

    return data;
  }

  async fetchActivePlan(userId: string): Promise<{ plan?: PlanSummary; prompts?: AssistantPrompt[] }> {
    const response = await fetch(`${this.baseUrl}/api/v1/training-plans/users/${userId}/active`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {};
    }

    const data = (await response.json()) as ActivePlanResponse;
    if (data.status !== 'success' || !data.plan) {
      return { prompts: data.prompts || [] };
    }

    return { plan: data.plan, prompts: data.prompts || [] };
  }

  /**
   * Fetch run data for a specific count with caching
   */
  async fetchRunData(count: number): Promise<Chart[]> {
    // Check cache first
    const cached = this.runDataCache.get(count);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.debug('Returning cached run data', { count });
      return cached.charts;
    }

    logger.info('Fetching run data from API', { count });

    const response = await fetch(`${this.baseUrl}/api/v1/chat/fetch-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        count,
        sessionId: this.sessionId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.detail || 'Failed to fetch run data');
    }

    const data = await response.json();

    // Update session ID if provided
    if (data.sessionId) {
      this.sessionId = data.sessionId;
    }

    // Cache the result
    this.runDataCache.set(count, {
      charts: data.charts || [],
      timestamp: Date.now(),
    });

    return data.charts || [];
  }

  /**
   * Clear the run data cache
   */
  clearRunDataCache(): void {
    this.runDataCache.clear();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Simple logger for frontend
const logger = {
  debug: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.debug(`[ChatService] ${message}`, data);
    }
  },
  info: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.info(`[ChatService] ${message}`, data);
    }
  },
  error: (message: string, data?: any) => {
    console.error(`[ChatService] ${message}`, data);
  },
};

export const chatService = new ChatService();

// Made with Bob
