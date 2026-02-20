/**
 * Chat Service - Production
 * Handles communication with the backend API chat endpoint
 */

import { authService } from './authService';

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
  error?: string;
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

export interface ServiceStatus {
  backend: boolean;
  agent: boolean;
  chat: boolean;
}

class ChatService {
  private sessionId?: string;

  async sendMessage(
    messages: Message[], 
    location?: { latitude: number; longitude: number }
  ): Promise<ChatResponse> {
    // Check session validity before making request
    if (!authService.isSessionValid()) {
      authService.logout();
      throw new Error('Session expired. Please login again.');
    }

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    
    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    const token = authService.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const request: ChatRequest = {
      message: lastUserMessage.content,
      sessionId: this.sessionId,
      location,
    };

    const response = await fetch(`${BACKEND_API_URL}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      // Handle 401/403 by logging out
      if (response.status === 401 || response.status === 403) {
        authService.logout();
        throw new Error('Session expired. Please login again.');
      }
      const error = await response.json();
      throw new Error(error.error || error.detail || 'Failed to send message');
    }

    const data = await response.json();
    
    if (data.sessionId) {
      this.sessionId = data.sessionId;
    }

    return data;
  }

  async fetchActivePlan(): Promise<{ plan?: PlanSummary; prompts?: AssistantPrompt[] }> {
    const token = authService.getAuthToken();
    if (!token) {
      return {};
    }

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/v1/training-plans/active`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return {};
      }

      const data = await response.json() as ActivePlanResponse;
      if (data.status !== 'success' || !data.plan) {
        return { prompts: data.prompts || [] };
      }

      return { plan: data.plan, prompts: data.prompts || [] };
    } catch {
      return {};
    }
  }

  async fetchRunData(count: number): Promise<Chart[]> {
    const token = authService.getAuthToken();
    if (!token) {
      return [];
    }

    const response = await fetch(`${BACKEND_API_URL}/api/v1/chat/fetch-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ count, sessionId: this.sessionId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch run data');
    }

    const data = await response.json();
    return data.charts || [];
  }

  async healthCheck(): Promise<ServiceStatus> {
    try {
      const response = await fetch(`${BACKEND_API_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { backend: false, agent: false, chat: false };
      }

      const data = await response.json();
      return {
        backend: data.status === 'ok',
        agent: data.agentService === 'healthy',
        chat: data.chatService === 'healthy',
      };
    } catch {
      return { backend: false, agent: false, chat: false };
    }
  }

  async chatHealthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_API_URL}/api/v1/chat/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getSubscriptionStatus(): Promise<{ subscribed: boolean; hasActivePlan: boolean; planId?: string }> {
    const token = authService.getAuthToken();
    if (!token) {
      return { subscribed: false, hasActivePlan: false };
    }

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/v1/training-plans/subscription-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return { subscribed: false, hasActivePlan: false };
      }

      const data = await response.json();
      return {
        subscribed: data.subscribed,
        hasActivePlan: data.hasActivePlan,
        planId: data.planId,
      };
    } catch {
      return { subscribed: false, hasActivePlan: false };
    }
  }

  async setSubscription(subscribed: boolean): Promise<boolean> {
    const token = authService.getAuthToken();
    if (!token) {
      return false;
    }

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/v1/training-plans/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subscribed }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

export const chatService = new ChatService();
