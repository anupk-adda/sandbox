/**
 * Token Service
 * Manages JWT tokens with Vault integration for enhanced security
 */
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { vaultService } from '../vault/vault-service.js';
import { databaseService } from '../database/database-service.js';
import { logger } from '../../utils/logger.js';
// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access tokens
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days for refresh tokens
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
// Fallback secrets (used when Vault is not available)
const FALLBACK_JWT_SECRET = process.env.JWT_SECRET || 'pace42-development-secret-change-in-production';
const FALLBACK_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'pace42-refresh-secret-change-in-production';
class TokenService {
    jwtSecret = null;
    refreshSecret = null;
    secretsLoaded = false;
    constructor() {
        this.loadSecrets();
    }
    /**
     * Load JWT secrets from Vault or fallback
     */
    async loadSecrets() {
        try {
            // Try to get secrets from Vault
            const vaultSecrets = await vaultService.getJWTSecrets();
            if (vaultSecrets) {
                this.jwtSecret = vaultSecrets.accessSecret;
                this.refreshSecret = vaultSecrets.refreshSecret;
                this.secretsLoaded = true;
                logger.info('JWT secrets loaded from Vault');
            }
            else {
                // Use fallback secrets
                this.jwtSecret = FALLBACK_JWT_SECRET;
                this.refreshSecret = FALLBACK_REFRESH_SECRET;
                logger.warn('Using fallback JWT secrets (Vault not available)');
            }
        }
        catch (error) {
            logger.error('Failed to load JWT secrets, using fallback', { error });
            this.jwtSecret = FALLBACK_JWT_SECRET;
            this.refreshSecret = FALLBACK_REFRESH_SECRET;
        }
    }
    /**
     * Ensure secrets are loaded
     */
    async ensureSecrets() {
        if (!this.secretsLoaded) {
            await this.loadSecrets();
        }
    }
    /**
     * Generate a token pair (access + refresh)
     */
    async generateTokenPair(userId, username, rememberMe = false) {
        await this.ensureSecrets();
        const refreshExpiryDays = rememberMe ? 30 : 7;
        const refreshExpiryMs = refreshExpiryDays * 24 * 60 * 60 * 1000;
        // Generate access token (short-lived)
        const accessPayload = {
            userId,
            username,
            type: 'access',
        };
        const accessToken = jwt.sign(accessPayload, this.jwtSecret, {
            expiresIn: ACCESS_TOKEN_EXPIRY,
            issuer: 'pace42-running-coach',
            audience: 'pace42-users',
        });
        // Generate refresh token (long-lived, stored hashed)
        const refreshToken = uuidv4() + uuidv4();
        const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        // Store refresh token in database
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + refreshExpiryMs);
        databaseService.run(`INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`, [sessionId, userId, refreshTokenHash, expiresAt.toISOString(), new Date().toISOString()]);
        // Also store in Vault if available
        if (vaultService.getAvailability()) {
            await vaultService.storeRefreshToken(userId, refreshTokenHash, expiresAt);
        }
        logger.info('Generated token pair', { userId, rememberMe, sessionId });
        return {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 minutes in seconds
        };
    }
    /**
     * Verify access token
     */
    async verifyAccessToken(token) {
        try {
            await this.ensureSecrets();
            const decoded = jwt.verify(token, this.jwtSecret, {
                issuer: 'pace42-running-coach',
                audience: 'pace42-users',
            });
            if (decoded.type !== 'access') {
                return null;
            }
            return decoded;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken) {
        try {
            await this.ensureSecrets();
            // Hash the provided refresh token
            const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            // Find the session
            const session = databaseService.get(`SELECT * FROM user_sessions 
         WHERE refresh_token_hash = ? 
         AND revoked_at IS NULL 
         AND expires_at > datetime('now')`, [refreshTokenHash]);
            if (!session) {
                logger.warn('Invalid or expired refresh token');
                return null;
            }
            // Update last used timestamp
            databaseService.run(`UPDATE user_sessions SET last_used_at = ? WHERE id = ?`, [new Date().toISOString(), session.id]);
            // Get user info
            const user = databaseService.get('SELECT id, email FROM users WHERE id = ?', [session.user_id]);
            if (!user) {
                return null;
            }
            // Revoke old refresh token
            await this.revokeSession(session.id);
            // Generate new token pair
            return await this.generateTokenPair(user.id, user.email);
        }
        catch (error) {
            logger.error('Failed to refresh access token', { error });
            return null;
        }
    }
    /**
     * Revoke a session
     */
    async revokeSession(sessionId) {
        try {
            databaseService.run(`UPDATE user_sessions SET revoked_at = ? WHERE id = ?`, [new Date().toISOString(), sessionId]);
            return true;
        }
        catch (error) {
            logger.error('Failed to revoke session', { error, sessionId });
            return false;
        }
    }
    /**
     * Revoke all sessions for a user
     */
    async revokeAllUserSessions(userId) {
        try {
            databaseService.run(`UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [new Date().toISOString(), userId]);
            // Also delete from Vault if available
            if (vaultService.getAvailability()) {
                await vaultService.deleteRefreshToken(userId);
            }
            logger.info('Revoked all sessions for user', { userId });
            return true;
        }
        catch (error) {
            logger.error('Failed to revoke user sessions', { error, userId });
            return false;
        }
    }
    /**
     * Generate password reset token
     */
    async generatePasswordResetToken(userId) {
        try {
            // Generate a secure random token
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            // Token expires in 1 hour
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            // Store in database
            const tokenId = uuidv4();
            databaseService.run(`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`, [tokenId, userId, tokenHash, expiresAt.toISOString(), new Date().toISOString()]);
            // Invalidate any existing unused tokens for this user
            databaseService.run(`UPDATE password_reset_tokens 
         SET used_at = ? 
         WHERE user_id = ? 
         AND used_at IS NULL 
         AND id != ?`, [new Date().toISOString(), userId, tokenId]);
            logger.info('Generated password reset token', { userId, tokenId });
            return {
                token, // Return the unhashed token (will be sent via email)
                expiresAt,
            };
        }
        catch (error) {
            logger.error('Failed to generate password reset token', { error, userId });
            return null;
        }
    }
    /**
     * Verify password reset token
     */
    async verifyPasswordResetToken(token) {
        try {
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const resetToken = databaseService.get(`SELECT * FROM password_reset_tokens 
         WHERE token_hash = ? 
         AND used_at IS NULL 
         AND expires_at > datetime('now')`, [tokenHash]);
            if (!resetToken) {
                return null;
            }
            return resetToken.user_id;
        }
        catch (error) {
            logger.error('Failed to verify password reset token', { error });
            return null;
        }
    }
    /**
     * Mark password reset token as used
     */
    async markPasswordResetTokenUsed(token) {
        try {
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            databaseService.run(`UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?`, [new Date().toISOString(), tokenHash]);
            return true;
        }
        catch (error) {
            logger.error('Failed to mark password reset token as used', { error });
            return false;
        }
    }
    /**
     * Clean up expired tokens and sessions
     */
    async cleanupExpiredTokens() {
        try {
            // Delete expired password reset tokens
            databaseService.run(`DELETE FROM password_reset_tokens WHERE expires_at < datetime('now', '-7 days')`);
            // Delete expired sessions
            databaseService.run(`DELETE FROM user_sessions WHERE expires_at < datetime('now', '-7 days')`);
            logger.info('Cleaned up expired tokens and sessions');
        }
        catch (error) {
            logger.error('Failed to cleanup expired tokens', { error });
        }
    }
    /**
     * Get active sessions for a user
     */
    getActiveSessions(userId) {
        try {
            return databaseService.all(`SELECT id, device_info as deviceInfo, ip_address as ipAddress, 
                created_at as createdAt, last_used_at as lastUsedAt
         FROM user_sessions 
         WHERE user_id = ? 
         AND revoked_at IS NULL 
         AND expires_at > datetime('now')
         ORDER BY last_used_at DESC`, [userId]);
        }
        catch (error) {
            logger.error('Failed to get active sessions', { error, userId });
            return [];
        }
    }
}
// Export singleton instance
export const tokenService = new TokenService();
//# sourceMappingURL=token-service.js.map