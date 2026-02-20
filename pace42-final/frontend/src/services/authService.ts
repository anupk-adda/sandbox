/**
 * Authentication Service - Enhanced with Refresh Tokens & Persistent Sessions
 * Handles user login, password management, and secure credential storage
 */

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000';

export interface UserCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface GarminCredentials {
  garminUsername: string;
  garminPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
  garminConnected?: boolean;
  garminUsername?: string;
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
}

// Storage keys
const AUTH_KEY = 'pace42_auth';
const GARMIN_KEY = 'pace42_garmin';
const REFRESH_TOKEN_KEY = 'pace42_refresh_token';

// Token refresh buffer (refresh 2 minutes before expiry)
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

class AuthService {
  private state: AuthState = {
    isAuthenticated: false,
    isGarminConnected: false,
    user: null,
  };

  private listeners: ((state: AuthState) => void)[] = [];
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private tokenExpiryTime: number | null = null;

  constructor() {
    this.loadFromStorage();
    this.scheduleTokenRefresh();
    
    // Check token validity periodically
    setInterval(() => this.checkAndRefreshToken(), 60000); // Every minute
  }

  // ============================================
  // Storage Management
  // ============================================
  private loadFromStorage() {
    try {
      const authData = localStorage.getItem(AUTH_KEY);
      const garminData = localStorage.getItem(GARMIN_KEY);

      if (authData) {
        const parsed = JSON.parse(authData);
        this.state = {
          ...this.state,
          isAuthenticated: true,
          isGarminConnected: parsed.garminConnected || false,
          user: { 
            username: parsed.username,
            garminUsername: garminData ? JSON.parse(garminData).garminUsername : undefined,
          },
        };
        this.tokenExpiryTime = parsed.expiresAt || null;
      }
    } catch {
      this.clearStorage();
    }
  }

  private clearStorage() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(GARMIN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private saveAuthData(tokens: AuthTokens, user: User, rememberMe: boolean = false) {
    const expiresAt = Date.now() + (tokens.expiresIn * 1000);
    
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      token: tokens.accessToken,
      username: user.username,
      userId: user.id,
      garminConnected: user.garminConnected || false,
      expiresAt,
      rememberMe,
    }));

    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    
    this.tokenExpiryTime = expiresAt;
    this.scheduleTokenRefresh();
  }

  // ============================================
  // Token Refresh
  // ============================================
  private scheduleTokenRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    if (!this.tokenExpiryTime) return;

    const timeUntilExpiry = this.tokenExpiryTime - Date.now();
    const refreshTime = timeUntilExpiry - TOKEN_REFRESH_BUFFER_MS;

    if (refreshTime > 0) {
      this.refreshTimeout = setTimeout(() => {
        this.performTokenRefresh();
      }, refreshTime);
    } else if (timeUntilExpiry > 0) {
      // Token is about to expire, refresh immediately
      this.performTokenRefresh();
    }
  }

  private async performTokenRefresh(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        this.logout();
        return false;
      }

      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh failed, logout user
        this.logout();
        return false;
      }

      const data = await response.json();
      
      if (data.success) {
        // Update stored tokens
        const authData = localStorage.getItem(AUTH_KEY);
        if (authData) {
          const parsed = JSON.parse(authData);
          this.saveAuthData(
            { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn },
            { id: parsed.userId, username: parsed.username, createdAt: parsed.createdAt },
            parsed.rememberMe
          );
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  private async checkAndRefreshToken() {
    if (!this.state.isAuthenticated || !this.tokenExpiryTime) return;

    const timeUntilExpiry = this.tokenExpiryTime - Date.now();
    
    // If token expires in less than 5 minutes, refresh it
    if (timeUntilExpiry < 5 * 60 * 1000) {
      await this.performTokenRefresh();
    }
  }

  // ============================================
  // Event Listeners
  // ============================================
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

  // ============================================
  // Authentication Methods
  // ============================================
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

      // Save auth data
      this.saveAuthData(
        { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn },
        data.user,
        credentials.rememberMe
      );

      // Save Garmin username to storage if connected
      if (data.user.garminUsername) {
        localStorage.setItem(GARMIN_KEY, JSON.stringify({
          garminUsername: data.user.garminUsername,
        }));
      }

      this.state = {
        ...this.state,
        isAuthenticated: true,
        isGarminConnected: data.user.garminConnected || false,
        user: { 
          username: data.user.username,
          garminUsername: data.user.garminUsername,
        },
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

      if (credentials.password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
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

      // Save auth data
      this.saveAuthData(
        { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn },
        data.user,
        credentials.rememberMe
      );

      this.state = {
        ...this.state,
        isAuthenticated: true,
        isGarminConnected: data.user.garminConnected || false,
        user: { username: data.user.username },
      };

      this.notifyListeners();
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: 'Unable to connect to server. Please try again.' };
    }
  }

  async logout(): Promise<void> {
    try {
      // Call logout endpoint to revoke server-side session
      const token = this.getAuthToken();
      if (token) {
        await fetch(`${BACKEND_API_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
      }
      this.clearStorage();
      this.state = {
        isAuthenticated: false,
        isGarminConnected: false,
        user: null,
      };
      this.tokenExpiryTime = null;
      this.notifyListeners();
    }
  }

  // ============================================
  // Password Reset Methods
  // ============================================
  async forgotPassword(username: string): Promise<{ success: boolean; error?: string; message?: string; devInfo?: any }> {
    try {
      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to process request' };
      }

      return { 
        success: true, 
        message: data.message,
        devInfo: data.devInfo, // Development only
      };
    } catch (error) {
      return { success: false, error: 'Unable to connect to server. Please try again.' };
    }
  }

  async verifyResetToken(token: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!response.ok) {
        return { valid: false, error: data.error || 'Invalid token' };
      }

      return { valid: data.valid };
    } catch (error) {
      return { valid: false, error: 'Unable to verify token' };
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      if (newPassword.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }

      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to reset password' };
      }

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: 'Unable to connect to server. Please try again.' };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to change password' };
      }

      // Logout after password change
      await this.logout();

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: 'Unable to connect to server. Please try again.' };
    }
  }

  // ============================================
  // Session Management
  // ============================================
  async getSessions(): Promise<{ sessions: SessionInfo[]; error?: string }> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        return { sessions: [], error: 'Not authenticated' };
      }

      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        return { sessions: [], error: data.error };
      }

      return { sessions: data.sessions };
    } catch (error) {
      return { sessions: [], error: 'Failed to fetch sessions' };
    }
  }

  async revokeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/sessions/${sessionId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to revoke session' };
    }
  }

  // ============================================
  // Garmin Integration
  // ============================================
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

      // Update auth data to mark Garmin as connected
      const authData = localStorage.getItem(AUTH_KEY);
      if (authData) {
        const parsed = JSON.parse(authData);
        localStorage.setItem(AUTH_KEY, JSON.stringify({
          ...parsed,
          garminConnected: true,
        }));
      }

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

  async disconnectGarmin(): Promise<{ success: boolean; error?: string }> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Call backend to clear credentials from database and Vault
      const response = await fetch(`${BACKEND_API_URL}/auth/disconnect-garmin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        logger.warn('Backend disconnect failed, continuing with local cleanup', { error });
        // Continue with local cleanup even if backend fails
      }

      // Clear localStorage
      localStorage.removeItem(GARMIN_KEY);
      
      // Update auth data to mark Garmin as disconnected
      const authData = localStorage.getItem(AUTH_KEY);
      if (authData) {
        const parsed = JSON.parse(authData);
        localStorage.setItem(AUTH_KEY, JSON.stringify({
          ...parsed,
          garminConnected: false,
        }));
      }
      
      this.state = {
        ...this.state,
        isGarminConnected: false,
        user: this.state.user ? { username: this.state.user.username } : null,
      };
      this.notifyListeners();

      return { success: true };
    } catch (error) {
      logger.error('Disconnect Garmin error', { error });
      // Still do local cleanup even on error
      localStorage.removeItem(GARMIN_KEY);
      this.notifyListeners();
      return { success: false, error: 'Failed to disconnect Garmin' };
    }
  }

  // ============================================
  // Utility Methods
  // ============================================
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

  isSessionValid(): boolean {
    if (!this.tokenExpiryTime) return false;
    return Date.now() < this.tokenExpiryTime;
  }

  getTokenExpiryTime(): number | null {
    return this.tokenExpiryTime;
  }
}

// Export singleton instance
export const authService = new AuthService();
