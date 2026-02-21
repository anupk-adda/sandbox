/**
 * Garmin Token Service
 * Handles credential storage in Vault and on-demand token exchange
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../utils/logger.js';
import { vaultService } from '../vault/vault-service.js';

export interface GarminCredentials {
  email: string;
  password: string;
}

export interface TokenExchangeResult {
  success: boolean;
  tokens?: string;
  error?: string;
}

/**
 * Service for managing Garmin OAuth tokens
 * 
 * Architecture:
 * - Store credentials in Vault (one-time during connect)
 * - Exchange credentials for tokens on-demand (when fetching data)
 * - Tokens are temporary, credentials are permanent
 */
export class GarminTokenService {
  private mcpPythonPath: string;
  private mcpServerPath: string;

  constructor() {
    this.mcpPythonPath = process.env.GARMIN_MCP_PYTHON_PATH || 
      '/Users/anupk/devops/mcp/garmin_mcp/.venv/bin/python';
    this.mcpServerPath = process.env.GARMIN_MCP_SERVER_PATH || 
      '/Users/anupk/devops/mcp/garmin_mcp/garmin_mcp_server.py';
  }

  /**
   * Store Garmin credentials in Vault (called during connect)
   */
  async storeCredentials(
    userId: string,
    credentials: GarminCredentials
  ): Promise<boolean> {
    try {
      logger.info(`Storing Garmin credentials for user ${userId}`);
      
      const stored = await vaultService.storeGarminCredentials(
        userId,
        credentials.email,
        credentials.password
      );
      
      if (!stored) {
        logger.error('Failed to store credentials in Vault');
        return false;
      }

      logger.info(`Credentials stored for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to store credentials for user ${userId}:`, { error });
      return false;
    }
  }

  /**
   * Get credentials from Vault (called before token exchange)
   */
  async getCredentials(userId: string): Promise<GarminCredentials | null> {
    try {
      const creds = await vaultService.getGarminCredentials(userId);
      if (creds) {
        logger.info(`Retrieved credentials for user ${userId}`);
        return { email: creds.username, password: creds.password };
      }
      return null;
    } catch (error) {
      logger.error(`Failed to get credentials for user ${userId}:`, { error });
      return null;
    }
  }

  /**
   * Exchange credentials for OAuth tokens (on-demand)
   * Called every time we need to fetch data from Garmin
   * 
   * @param userId - The user ID
   * @param credentials - Optional credentials (if not provided, will fetch from Vault)
   */
  async exchangeCredentialsForTokens(
    userId: string,
    credentials?: GarminCredentials
  ): Promise<TokenExchangeResult> {
    try {
      // 1. Get credentials (from parameter or Vault)
      const creds = credentials || await this.getCredentials(userId);
      if (!creds) {
        return { success: false, error: 'No Garmin credentials found' };
      }

      logger.info(`Exchanging credentials for tokens for user ${userId}`);

      // 2. Spawn MCP server with credentials to perform login
      const tokens = await this.performLoginAndExtractTokens(creds);
      
      if (!tokens) {
        return { success: false, error: 'Failed to obtain tokens from Garmin' };
      }

      logger.info(`Token exchange successful for user ${userId}`);
      return { success: true, tokens };

    } catch (error) {
      logger.error(`Token exchange failed for user ${userId}:`, { error });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Delete credentials (called during disconnect)
   */
  async deleteCredentials(userId: string): Promise<boolean> {
    try {
      await vaultService.deleteGarminCredentials(userId);
      logger.info(`Credentials deleted for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete credentials for user ${userId}:`, { error });
      return false;
    }
  }

  /**
   * Perform login with MCP server and extract tokens
   */
  private async performLoginAndExtractTokens(
    credentials: GarminCredentials
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'garminconnect-'));
      // Explicit token store paths to avoid relying on user HOME defaults.
      const tokenDir = path.join(tmpRoot, 'tokens');
      const base64Path = path.join(tmpRoot, '.garminconnect_base64');

      try {
        fs.mkdirSync(tokenDir, { recursive: true });
        // Some Garmin libraries expect a nested "tokens" directory.
        fs.mkdirSync(path.join(tokenDir, 'tokens'), { recursive: true });
      } catch (error) {
        logger.warn('Failed to pre-create Garmin token directory', { error, tokenDir });
      }

      const env = {
        ...process.env,
        GARMIN_EMAIL: credentials.email,
        GARMIN_PASSWORD: credentials.password,
        // Force per-request token isolation by scoping HOME to temp directory
        HOME: tmpRoot,
        // Explicit token locations for garmin_mcp_server.py
        GARMINTOKENS: tokenDir,
        GARMINTOKENS_BASE64: base64Path,
      };

      logger.info('Spawning MCP server for token extraction...');

      const child = spawn(this.mcpPythonPath, [this.mcpServerPath], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let finished = false;

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const cleanup = () => {
        try {
          if (fs.existsSync(tmpRoot)) {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
          }
        } catch (error) {
          logger.warn('Failed to cleanup Garmin token temp dir', { error });
        }
      };

      const finish = async () => {
        if (finished) return;
        finished = true;

        const tokens = await this.readTokensFromStore(base64Path, tokenDir);

        if (!tokens) {
          const stderrSnippet = stderr.trim().slice(-2000);
          const stdoutSnippet = stdout.trim().slice(-2000);
          if (stderrSnippet) {
            logger.error('Garmin MCP stderr', { stderr: stderrSnippet });
          }
          if (stdoutSnippet) {
            logger.warn('Garmin MCP stdout', { stdout: stdoutSnippet });
          }
        }

        cleanup();
        resolve(tokens);
      };

      const pollInterval = setInterval(async () => {
        if (finished) return;
        const oauth1Path = path.join(tokenDir, 'oauth1_token.json');
        const oauth1AltPath = path.join(tokenDir, 'tokens', 'oauth1_token.json');
        if (fs.existsSync(base64Path) || fs.existsSync(oauth1Path) || fs.existsSync(oauth1AltPath)) {
          clearInterval(pollInterval);
          try {
            child.kill();
          } catch {}
          await finish();
        }
      }, 500);

      // Give it time to login (up to 30 seconds)
      const timeout = setTimeout(async () => {
        clearInterval(pollInterval);
        try {
          child.kill();
        } catch {}
        await finish();
      }, 30000);

      child.on('error', (error) => {
        logger.error('MCP server spawn error:', { error });
        clearInterval(pollInterval);
        clearTimeout(timeout);
        cleanup();
        reject(error);
      });

      child.on('exit', async () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
        await finish();
      });
    });
  }

  /**
   * Read tokens from filesystem store
   */
  private async readTokensFromStore(
    base64PathOverride?: string,
    tokenDirOverride?: string
  ): Promise<string | null> {
    try {
      // Try base64 file first
      const base64Path = base64PathOverride || path.resolve(os.homedir(), '.garminconnect_base64');
      if (fs.existsSync(base64Path)) {
        const tokens = fs.readFileSync(base64Path, 'utf-8').trim();
        logger.info(`Read tokens from ${base64Path}`);
        return tokens;
      }

      // Try directory with oauth files
      const tokenDir = tokenDirOverride || path.resolve(os.homedir(), '.garminconnect');
      const tokenDirCandidates = [tokenDir, path.join(tokenDir, 'tokens')];

      for (const dir of tokenDirCandidates) {
        const oauth1Path = path.join(dir, 'oauth1_token.json');
        const oauth2Path = path.join(dir, 'oauth2_token.json');

        if (fs.existsSync(oauth1Path) && fs.existsSync(oauth2Path)) {
          const oauth1 = JSON.parse(fs.readFileSync(oauth1Path, 'utf-8'));
          const oauth2 = JSON.parse(fs.readFileSync(oauth2Path, 'utf-8'));

          const tokenData = {
            oauth1_token: oauth1,
            oauth2_token: oauth2,
          };

          const tokens = Buffer.from(JSON.stringify(tokenData)).toString('base64');
          logger.info(`Created base64 tokens from directory`);
          return tokens;
        }
      }

      logger.warn('No token files found');
      return null;

    } catch (error) {
      logger.error('Failed to read tokens from store:', { error });
      return null;
    }
  }

  /**
   * Clear token store files
   */
  private async clearTokenStore(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const base64Path = path.resolve(os.homedir(), '.garminconnect_base64');
      if (fs.existsSync(base64Path)) {
        fs.unlinkSync(base64Path);
        logger.info(`Cleared ${base64Path}`);
      }

      const tokenDir = path.resolve(os.homedir(), '.garminconnect');
      if (fs.existsSync(tokenDir)) {
        fs.rmSync(tokenDir, { recursive: true, force: true });
        logger.info(`Cleared ${tokenDir}`);
      }

    } catch (error) {
      logger.warn('Failed to clear token store:', { error });
    }
  }
}

// Singleton instance
export const garminTokenService = new GarminTokenService();
