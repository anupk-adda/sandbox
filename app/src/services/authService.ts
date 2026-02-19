/**
 * Authentication Service - Production
 * Handles user login, Garmin connection, and secure credential storage
 */

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000';

export interface UserCredentials {
  username: string;
  password: string;
}

export interface GarminCredentials {
  garminUsername: string;
  garminPassword: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isGarminConnected: boolean;
  user: {
    username: string;
    garminUsername?: string;
  } | null;
}

export interface User {
  id: string;
  username: string;
  createdAt: string;
}

const AUTH_KEY = 'pace42_auth';
const GARMIN_KEY = 'pace42_garmin';

class AuthService {
  private state: AuthState = {
    isAuthenticated: false,
    isGarminConnected: false,
    user: null,
  };

  private listeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const authData = localStorage.getItem(AUTH_KEY);
      const garminData = localStorage.getItem(GARMIN_KEY);

      if (authData) {
        const parsed = JSON.parse(authData);
        this.state = {
          ...this.state,
          isAuthenticated: true,
          user: { username: parsed.username },
        };
      }

      if (garminData && this.state.user) {
        const parsed = JSON.parse(garminData);
        this.state = {
          ...this.state,
          isGarminConnected: true,
          user: {
            username: this.state.user.username,
            garminUsername: parsed.garminUsername,
          },
        };
      }
    } catch {
      this.clearStorage();
    }
  }

  private clearStorage() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(GARMIN_KEY);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getState(): AuthState {
    return { ...this.state };
  }

  async login(credentials: UserCredentials): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      if (!credentials.username || !credentials.password) {
        return { success: false, error: 'Username and password are required' };
      }

      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Invalid username or password' };
      }

      localStorage.setItem(AUTH_KEY, JSON.stringify({
        token: data.token,
        username: data.user.username,
        userId: data.user.id,
      }));

      this.state = {
        ...this.state,
        isAuthenticated: true,
        user: { username: data.user.username },
      };

      this.notifyListeners();
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: 'Unable to connect to server. Please try again.' };
    }
  }

  async signup(credentials: UserCredentials): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      if (!credentials.username || !credentials.password) {
        return { success: false, error: 'Username and password are required' };
      }

      if (credentials.password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to create account' };
      }

      localStorage.setItem(AUTH_KEY, JSON.stringify({
        token: data.token,
        username: data.user.username,
        userId: data.user.id,
      }));

      this.state = {
        ...this.state,
        isAuthenticated: true,
        user: { username: data.user.username },
      };

      this.notifyListeners();
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: 'Unable to connect to server. Please try again.' };
    }
  }

  async connectGarmin(credentials: GarminCredentials): Promise<{ success: boolean; error?: string }> {
    try {
      if (!credentials.garminUsername || !credentials.garminPassword) {
        return { success: false, error: 'Garmin username and password are required' };
      }

      const token = this.getAuthToken();
      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/validate-garmin`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        return { success: false, error: data.error || 'Invalid Garmin credentials. Please check your username and password.' };
      }

      localStorage.setItem(GARMIN_KEY, JSON.stringify({
        garminUsername: credentials.garminUsername,
      }));

      if (this.state.user) {
        this.state = {
          ...this.state,
          isGarminConnected: true,
          user: {
            username: this.state.user.username,
            garminUsername: credentials.garminUsername,
          },
        };
      }

      this.notifyListeners();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Unable to validate Garmin credentials. Please try again.' };
    }
  }

  async checkBackendHealth(): Promise<{ healthy: boolean; services: { backend: boolean; agent: boolean } }> {
    try {
      const response = await fetch(`${BACKEND_API_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { healthy: false, services: { backend: false, agent: false } };
      }

      const data = await response.json();
      return {
        healthy: data.status === 'ok',
        services: {
          backend: true,
          agent: data.agentService === 'healthy',
        },
      };
    } catch {
      return { healthy: false, services: { backend: false, agent: false } };
    }
  }

  getGarminCredentials(): GarminCredentials | null {
    try {
      const garminData = localStorage.getItem(GARMIN_KEY);
      if (garminData) {
        return JSON.parse(garminData);
      }
      return null;
    } catch {
      return null;
    }
  }

  getAuthToken(): string | null {
    try {
      const authData = localStorage.getItem(AUTH_KEY);
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.token || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  logout() {
    this.clearStorage();
    this.state = {
      isAuthenticated: false,
      isGarminConnected: false,
      user: null,
    };
    this.notifyListeners();
  }

  disconnectGarmin() {
    localStorage.removeItem(GARMIN_KEY);
    this.state = {
      ...this.state,
      isGarminConnected: false,
      user: this.state.user ? { username: this.state.user.username } : null,
    };
    this.notifyListeners();
  }
}

export const authService = new AuthService();
