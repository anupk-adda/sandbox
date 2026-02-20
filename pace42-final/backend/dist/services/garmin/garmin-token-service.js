/**
 * Garmin Token Service
 * Handles token exchange and Vault storage for Garmin OAuth tokens
 */
import { spawn } from 'child_process';
import { logger } from '../../utils/logger.js';
import { vaultService } from '../vault/vault-service.js';
/**
 * Service for managing Garmin OAuth tokens
 */
export class GarminTokenService {
    mcpPythonPath;
    mcpServerPath;
    constructor() {
        this.mcpPythonPath = process.env.GARMIN_MCP_PYTHON_PATH ||
            '/Users/anupk/devops/mcp/garmin_mcp/.venv/bin/python';
        this.mcpServerPath = process.env.GARMIN_MCP_SERVER_PATH ||
            '/Users/anupk/devops/mcp/garmin_mcp/garmin_mcp_server.py';
    }
    /**
     * Exchange credentials for OAuth tokens.
     * Spawns MCP server, logs in, extracts tokens, stores in Vault.
     */
    async exchangeCredentialsForTokens(userId, credentials) {
        try {
            logger.info(`Starting token exchange for user ${userId}`);
            // 1. Clear any existing tokens to force fresh login
            await this.clearTokenStore();
            // 2. Spawn MCP server with credentials to perform login
            const tokens = await this.performLoginAndExtractTokens(credentials);
            if (!tokens) {
                return { success: false, error: 'Failed to obtain tokens from Garmin' };
            }
            // 3. Store tokens in Vault
            const stored = await vaultService.storeGarminTokens(userId, tokens);
            if (!stored) {
                return { success: false, error: 'Failed to store tokens in Vault' };
            }
            // 4. Clear local token store for security
            await this.clearTokenStore();
            logger.info(`Token exchange successful for user ${userId}`);
            return { success: true, tokens };
        }
        catch (error) {
            logger.error(`Token exchange failed for user ${userId}:`, { error });
            return { success: false, error: String(error) };
        }
    }
    /**
     * Perform login with MCP server and extract tokens
     */
    async performLoginAndExtractTokens(credentials) {
        return new Promise((resolve, reject) => {
            const env = {
                ...process.env,
                GARMIN_EMAIL: credentials.email,
                GARMIN_PASSWORD: credentials.password,
            };
            logger.info('Spawning MCP server for token extraction...');
            const child = spawn(this.mcpPythonPath, [this.mcpServerPath], {
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            // Give it time to login (up to 15 seconds)
            setTimeout(async () => {
                child.kill();
                const tokens = await this.readTokensFromStore();
                resolve(tokens);
            }, 15000);
            child.on('error', (error) => {
                logger.error('MCP server spawn error:', { error });
                reject(error);
            });
        });
    }
    /**
     * Read tokens from filesystem store
     */
    async readTokensFromStore() {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');
            // Try base64 file first
            const base64Path = path.resolve(os.homedir(), '.garminconnect_base64');
            if (fs.existsSync(base64Path)) {
                const tokens = fs.readFileSync(base64Path, 'utf-8').trim();
                logger.info(`Read tokens from ${base64Path}`);
                return tokens;
            }
            // Try directory with oauth files
            const tokenDir = path.resolve(os.homedir(), '.garminconnect');
            const oauth1Path = path.join(tokenDir, 'oauth1_token.json');
            const oauth2Path = path.join(tokenDir, 'oauth2_token.json');
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
            logger.warn('No token files found');
            return null;
        }
        catch (error) {
            logger.error('Failed to read tokens from store:', { error });
            return null;
        }
    }
    /**
     * Clear token store files
     */
    async clearTokenStore() {
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
        }
        catch (error) {
            logger.warn('Failed to clear token store:', { error });
        }
    }
    /**
     * Delete tokens from Vault (on disconnect)
     */
    async deleteTokens(userId) {
        try {
            return await vaultService.deleteGarminTokens(userId);
        }
        catch (error) {
            logger.error(`Failed to delete tokens for user ${userId}:`, { error });
            return false;
        }
    }
}
// Singleton instance
export const garminTokenService = new GarminTokenService();
//# sourceMappingURL=garmin-token-service.js.map