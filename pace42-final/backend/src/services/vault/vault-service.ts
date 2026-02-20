/**
 * HashiCorp Vault Service
 * Provides secure credential management and encryption services
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.js';

interface VaultConfig {
  address: string;
  roleId: string;
  secretId: string;
}

interface VaultToken {
  client_token: string;
  lease_duration: number;
  renewable: boolean;
}

interface JWTPair {
  accessSecret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
}

class VaultService {
  private client: AxiosInstance;
  private config: VaultConfig;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private isAvailable: boolean = false;

  constructor() {
    this.config = {
      address: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
      roleId: process.env.VAULT_ROLE_ID || '',
      secretId: process.env.VAULT_SECRET_ID || '',
    };

    this.client = axios.create({
      baseURL: this.config.address,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Check for direct token (development mode)
    const directToken = process.env.VAULT_TOKEN;
    if (directToken) {
      this.token = directToken;
      this.isAvailable = true;
      this.client.defaults.headers['X-Vault-Token'] = this.token;
      logger.info('Using direct Vault token (development mode)');
    }

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 403 && this.token) {
          logger.warn('Vault token expired, attempting to re-authenticate');
          await this.authenticate();
          // Retry the original request
          const config = error.config;
          config.headers['X-Vault-Token'] = this.token;
          return this.client.request(config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if Vault is configured and available
   */
  isConfigured(): boolean {
    // Support both AppRole and direct token auth
    return !!(this.token || (this.config.roleId && this.config.secretId));
  }

  /**
   * Authenticate with Vault using AppRole or verify direct token
   */
  async authenticate(): Promise<boolean> {
    try {
      // If we have a direct token, verify it works
      if (this.token && !this.config.roleId) {
        try {
          await this.client.get('/v1/auth/token/lookup-self', {
            headers: { 'X-Vault-Token': this.token }
          });
          this.isAvailable = true;
          logger.info('Direct Vault token verified');
          return true;
        } catch (error) {
          logger.error('Direct Vault token invalid');
          this.isAvailable = false;
          return false;
        }
      }

      // Otherwise use AppRole
      if (!this.config.roleId || !this.config.secretId) {
        logger.warn('Vault not configured, using fallback mode');
        this.isAvailable = false;
        return false;
      }

      const response = await this.client.post('/v1/auth/approle/login', {
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      });

      const auth = response.data.auth as VaultToken;
      this.token = auth.client_token;
      this.tokenExpiry = new Date(Date.now() + auth.lease_duration * 1000);
      this.isAvailable = true;

      // Set token for future requests
      this.client.defaults.headers['X-Vault-Token'] = this.token;

      logger.info('Successfully authenticated with Vault via AppRole');
      return true;
    } catch (error) {
      logger.error('Failed to authenticate with Vault', { error });
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureToken(): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    // Check if token needs refresh
    if (!this.token || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      return await this.authenticate();
    }

    return true;
  }

  /**
   * Get JWT signing secrets from Vault
   */
  async getJWTSecrets(): Promise<JWTPair | null> {
    try {
      if (!(await this.ensureToken())) {
        return null;
      }

      const response = await this.client.get('/v1/pace42/data/jwt-config');
      const data = response.data.data.data;

      return {
        accessSecret: data.secret,
        refreshSecret: data.refresh_secret,
        issuer: data.issuer,
        audience: data.audience,
      };
    } catch (error) {
      logger.error('Failed to get JWT secrets from Vault', { error });
      return null;
    }
  }

  /**
   * Store encrypted sensitive data
   */
  async encryptData(plaintext: string, keyName: string = 'pace42-data-encryption'): Promise<string | null> {
    try {
      if (!(await this.ensureToken())) {
        return null;
      }

      // Base64 encode the plaintext
      const encoded = Buffer.from(plaintext).toString('base64');

      const response = await this.client.post(`/v1/transit/encrypt/${keyName}`, {
        plaintext: encoded,
      });

      return response.data.data.ciphertext;
    } catch (error) {
      logger.error('Failed to encrypt data', { error });
      return null;
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(ciphertext: string, keyName: string = 'pace42-data-encryption'): Promise<string | null> {
    try {
      if (!(await this.ensureToken())) {
        return null;
      }

      const response = await this.client.post(`/v1/transit/decrypt/${keyName}`, {
        ciphertext,
      });

      const decoded = Buffer.from(response.data.data.plaintext, 'base64').toString();
      return decoded;
    } catch (error) {
      logger.error('Failed to decrypt data', { error });
      return null;
    }
  }

  /**
   * Store API keys securely
   */
  async storeAPIKeys(keys: { openai?: string; garminClientId?: string; garminClientSecret?: string }): Promise<boolean> {
    try {
      if (!(await this.ensureToken())) {
        return false;
      }

      await this.client.post('/v1/pace42/data/api-keys', {
        data: {
          openai_key: keys.openai || 'placeholder',
          garmin_client_id: keys.garminClientId || 'placeholder',
          garmin_client_secret: keys.garminClientSecret || 'placeholder',
          updated_at: new Date().toISOString(),
        },
      });

      logger.info('API keys stored in Vault');
      return true;
    } catch (error) {
      logger.error('Failed to store API keys', { error });
      return false;
    }
  }

  /**
   * Retrieve API keys
   */
  async getAPIKeys(): Promise<{ openai?: string; garminClientId?: string; garminClientSecret?: string } | null> {
    try {
      if (!(await this.ensureToken())) {
        return null;
      }

      const response = await this.client.get('/v1/pace42/data/api-keys');
      const data = response.data.data.data;

      return {
        openai: data.openai_key,
        garminClientId: data.garmin_client_id,
        garminClientSecret: data.garmin_client_secret,
      };
    } catch (error) {
      logger.error('Failed to get API keys from Vault', { error });
      return null;
    }
  }

  /**
   * Store refresh token for a user
   */
  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<boolean> {
    try {
      if (!(await this.ensureToken())) {
        return false;
      }

      await this.client.post(`/v1/pace42/data/refresh-tokens/${userId}`, {
        data: {
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      logger.error('Failed to store refresh token', { error, userId });
      return false;
    }
  }

  /**
   * Get refresh token for a user
   */
  async getRefreshToken(userId: string): Promise<{ tokenHash: string; expiresAt: Date } | null> {
    try {
      if (!(await this.ensureToken())) {
        return null;
      }

      const response = await this.client.get(`/v1/pace42/data/refresh-tokens/${userId}`);
      const data = response.data.data.data;

      return {
        tokenHash: data.token_hash,
        expiresAt: new Date(data.expires_at),
      };
    } catch (error) {
      // Token not found is not an error
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get refresh token', { error, userId });
      return null;
    }
  }

  /**
   * Delete refresh token for a user
   */
  async deleteRefreshToken(userId: string): Promise<boolean> {
    try {
      if (!(await this.ensureToken())) {
        return false;
      }

      await this.client.delete(`/v1/pace42/data/refresh-tokens/${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete refresh token', { error, userId });
      return false;
    }
  }

  /**
   * Store Garmin credentials for a user
   */
  async storeGarminCredentials(userId: string, username: string, password: string): Promise<boolean> {
    try {
      if (!(await this.ensureToken())) {
        return false;
      }

      await this.client.post(`/v1/pace42/data/garmin-credentials/${userId}`, {
        data: {
          username,
          password,
          user_id: userId,
          created_at: new Date().toISOString(),
        },
      });

      logger.info('Garmin credentials stored in Vault', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to store Garmin credentials', { error, userId });
      return false;
    }
  }

  /**
   * Get Garmin credentials for a user
   */
  async getGarminCredentials(userId: string): Promise<{ username: string; password: string } | null> {
    try {
      if (!(await this.ensureToken())) {
        return null;
      }

      const response = await this.client.get(`/v1/pace42/data/garmin-credentials/${userId}`);
      const data = response.data?.data?.data;

      if (!data?.username || !data?.password) {
        return null;
      }

      return {
        username: data.username,
        password: data.password,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get Garmin credentials', { error, userId });
      return null;
    }
  }

  /**
   * Delete Garmin credentials for a user
   */
  async deleteGarminCredentials(userId: string): Promise<boolean> {
    try {
      if (!(await this.ensureToken())) {
        return false;
      }

      await this.client.delete(`/v1/pace42/data/garmin-credentials/${userId}`);
      logger.info('Garmin credentials deleted from Vault', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to delete Garmin credentials', { error, userId });
      return false;
    }
  }

  /**
   * Get Vault health status
   */
  async getHealth(): Promise<{ available: boolean; sealed: boolean; version?: string }> {
    try {
      const response = await this.client.get('/v1/sys/health', {
        // Health endpoint returns different status codes based on state
        validateStatus: () => true,
      });

      return {
        available: response.status === 200,
        sealed: response.status === 503,
        version: response.data.version,
      };
    } catch (error) {
      return {
        available: false,
        sealed: false,
      };
    }
  }

  /**
   * Check if Vault integration is available
   */
  getAvailability(): boolean {
    return this.isAvailable;
  }
}

// Export singleton instance
export const vaultService = new VaultService();
