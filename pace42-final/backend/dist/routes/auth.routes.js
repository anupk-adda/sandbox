/**
 * Auth Routes - Enhanced with Vault Integration
 * Handles user authentication, password reset, and secure credential management
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../services/database/database-service.js';
import { logger } from '../utils/logger.js';
import { tokenService } from '../services/auth/token-service.js';
import { vaultService } from '../services/vault/vault-service.js';
import { agentClient } from '../services/agent-client/agent-client.js';
import { garminTokenService } from '../services/garmin/garmin-token-service.js';
const router = Router();
const SALT_ROUNDS = 12; // Increased from 10 for better security
// In-memory store for Garmin credentials (temporary until fully migrated to Vault)
const garminCredentialsStore = new Map();
// ============================================
// Middleware to verify JWT access token
// ============================================
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    try {
        const decoded = await tokenService.verifyAccessToken(token);
        if (!decoded) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Invalid token.' });
    }
};
// ============================================
// Signup Route
// ============================================
router.post('/signup', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        // Check password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            });
        }
        // Check if user already exists
        const existingUser = databaseService.get('SELECT * FROM users WHERE email = ?', [username]);
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        // Create user
        const userId = uuidv4();
        databaseService.run('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userId, username, hashedPassword]);
        // Generate token pair
        const tokens = await tokenService.generateTokenPair(userId, username, rememberMe);
        logger.info('User signed up', { userId, username });
        res.status(201).json({
            success: true,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            user: {
                id: userId,
                username,
                garminConnected: false,
                createdAt: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        logger.error('Signup error', { error });
        res.status(500).json({ error: 'Failed to create account' });
    }
});
// ============================================
// Login Route
// ============================================
router.post('/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        // Find user
        const user = databaseService.get('SELECT * FROM users WHERE email = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        // Verify password
        if (!user.password_hash) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        // Generate token pair
        const tokens = await tokenService.generateTokenPair(user.id, user.email, rememberMe);
        logger.info('User logged in', { userId: user.id, username, rememberMe });
        res.json({
            success: true,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            user: {
                id: user.id,
                username: user.email,
                garminConnected: !!user.garmin_user_id,
                garminUsername: user.garmin_user_id,
                createdAt: user.created_at,
            },
        });
    }
    catch (error) {
        logger.error('Login error', { error });
        res.status(500).json({ error: 'Failed to login' });
    }
});
// ============================================
// Refresh Token Route
// ============================================
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }
        // Attempt to refresh the token
        const tokens = await tokenService.refreshAccessToken(refreshToken);
        if (!tokens) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
        logger.info('Token refreshed successfully');
        res.json({
            success: true,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
        });
    }
    catch (error) {
        logger.error('Token refresh error', { error });
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});
// ============================================
// Logout Route
// ============================================
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        // Revoke all sessions for this user (can be enhanced to revoke specific session)
        await tokenService.revokeAllUserSessions(userId);
        logger.info('User logged out', { userId });
        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    }
    catch (error) {
        logger.error('Logout error', { error });
        res.status(500).json({ error: 'Failed to logout' });
    }
});
// ============================================
// Forgot Password Route
// ============================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        // Find user
        const user = databaseService.get('SELECT id, email FROM users WHERE email = ?', [username]);
        // Always return success to prevent username enumeration
        // Even if user doesn't exist, we don't reveal that information
        if (!user) {
            logger.info('Password reset requested for non-existent user', { username });
            return res.json({
                success: true,
                message: 'If an account exists with this username, you will receive password reset instructions.',
            });
        }
        // Generate password reset token
        const resetToken = await tokenService.generatePasswordResetToken(user.id);
        if (!resetToken) {
            return res.status(500).json({ error: 'Failed to generate reset token' });
        }
        // TODO: Send email with reset link
        // For development, we'll return the token in the response
        // In production, this should send an email with a link like:
        // https://pace42.com/reset-password?token=<resetToken.token>
        logger.info('Password reset token generated', { userId: user.id });
        res.json({
            success: true,
            message: 'If an account exists with this username, you will receive password reset instructions.',
            // Development only - remove in production
            devInfo: {
                resetToken: resetToken.token,
                expiresAt: resetToken.expiresAt,
                resetUrl: `/reset-password?token=${resetToken.token}`,
            },
        });
    }
    catch (error) {
        logger.error('Forgot password error', { error });
        res.status(500).json({ error: 'Failed to process request' });
    }
});
// ============================================
// Verify Reset Token Route
// ============================================
router.get('/verify-reset-token', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Token is required' });
        }
        const userId = await tokenService.verifyPasswordResetToken(token);
        if (!userId) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }
        res.json({
            success: true,
            valid: true,
        });
    }
    catch (error) {
        logger.error('Verify reset token error', { error });
        res.status(500).json({ error: 'Failed to verify token' });
    }
});
// ============================================
// Reset Password Route
// ============================================
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        // Validate password strength
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            });
        }
        // Verify the reset token
        const userId = await tokenService.verifyPasswordResetToken(token);
        if (!userId) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        // Update user's password
        databaseService.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);
        // Mark reset token as used
        await tokenService.markPasswordResetTokenUsed(token);
        // Revoke all existing sessions for security
        await tokenService.revokeAllUserSessions(userId);
        logger.info('Password reset successfully', { userId });
        res.json({
            success: true,
            message: 'Password reset successfully. Please log in with your new password.',
        });
    }
    catch (error) {
        logger.error('Reset password error', { error });
        res.status(500).json({ error: 'Failed to reset password' });
    }
});
// ============================================
// Change Password Route (authenticated)
// ============================================
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        // Validate new password
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            });
        }
        // Get user
        const user = databaseService.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user || !user.password_hash) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Verify current password
        const passwordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        databaseService.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);
        // Revoke all sessions except current one
        await tokenService.revokeAllUserSessions(userId);
        logger.info('Password changed successfully', { userId });
        res.json({
            success: true,
            message: 'Password changed successfully. Please log in again.',
        });
    }
    catch (error) {
        logger.error('Change password error', { error });
        res.status(500).json({ error: 'Failed to change password' });
    }
});
// ============================================
// Validate Garmin Credentials
// ============================================
router.post('/validate-garmin', authenticateToken, async (req, res) => {
    try {
        const { garminUsername, garminPassword } = req.body;
        const userId = req.user.userId;
        if (!garminUsername || !garminPassword) {
            return res.status(400).json({ error: 'Garmin username and password are required' });
        }
        // Test the credentials by exchanging for tokens once
        logger.info('Testing Garmin credentials', { userId, garminUsername });
        const testExchange = await garminTokenService.exchangeCredentialsForTokens(userId, { email: garminUsername, password: garminPassword });
        if (!testExchange.success) {
            logger.error('Credential test failed', { userId, error: testExchange.error });
            return res.status(400).json({
                valid: false,
                error: testExchange.error || 'Failed to connect to Garmin. Please check your credentials.'
            });
        }
        // Store credentials in Vault for future on-demand token exchange
        const stored = await garminTokenService.storeCredentials(userId, { email: garminUsername, password: garminPassword });
        if (!stored) {
            return res.status(500).json({
                valid: false,
                error: 'Failed to store credentials securely'
            });
        }
        // Update user record
        databaseService.run('UPDATE users SET garmin_user_id = ? WHERE id = ?', [garminUsername, userId]);
        logger.info('Garmin credentials validated and stored', { userId, garminUsername });
        res.json({
            valid: true,
            message: 'Garmin credentials validated successfully',
        });
    }
    catch (error) {
        logger.error('Garmin validation error', { error });
        res.status(500).json({ error: 'Failed to validate Garmin credentials' });
    }
});
// ============================================
// Get Current User
// ============================================
router.get('/me', authenticateToken, async (req, res) => {
    const user = req.user;
    // Get user details from database
    const userDetails = databaseService.get('SELECT id, email, garmin_user_id, created_at FROM users WHERE id = ?', [user.userId]);
    if (!userDetails) {
        return res.status(404).json({ error: 'User not found' });
    }
    // Get active sessions
    const sessions = tokenService.getActiveSessions(user.userId);
    res.json({
        id: userDetails.id,
        username: userDetails.email,
        garminConnected: !!userDetails.garmin_user_id,
        garminUsername: userDetails.garmin_user_id,
        createdAt: userDetails.created_at,
        activeSessions: sessions.length,
    });
});
// ============================================
// Get Active Sessions
// ============================================
router.get('/sessions', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const sessions = tokenService.getActiveSessions(userId);
    res.json({
        sessions: sessions.map(s => ({
            id: s.id,
            deviceInfo: s.deviceInfo,
            ipAddress: s.ipAddress,
            createdAt: s.createdAt,
            lastUsedAt: s.lastUsedAt,
        })),
    });
});
// ============================================
// Revoke Session
// ============================================
router.post('/sessions/:sessionId/revoke', authenticateToken, async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const userId = req.user.userId;
        // Verify the session belongs to this user
        const session = databaseService.get('SELECT * FROM user_sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        await tokenService.revokeSession(sessionId);
        logger.info('Session revoked', { userId, sessionId });
        res.json({
            success: true,
            message: 'Session revoked successfully',
        });
    }
    catch (error) {
        logger.error('Revoke session error', { error });
        res.status(500).json({ error: 'Failed to revoke session' });
    }
});
// ============================================
// Disconnect Garmin
// ============================================
router.post('/disconnect-garmin', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        // 1. Clear from database
        databaseService.run('UPDATE users SET garmin_user_id = NULL WHERE id = ?', [userId]);
        // 2. Clear from in-memory store
        garminCredentialsStore.delete(userId);
        // 3. Delete credentials from Vault
        try {
            await garminTokenService.deleteCredentials(userId);
            logger.info('Garmin credentials deleted from Vault', { userId });
        }
        catch (credError) {
            logger.warn('Failed to delete Garmin credentials from Vault, but continuing', { userId, error: credError });
        }
        // 4. Reset the Garmin MCP client singleton on the agent service
        // This ensures a fresh connection is established when new credentials are provided
        try {
            const resetResult = await agentClient.resetGarminClient();
            if (resetResult.success) {
                logger.info('Garmin MCP client reset successfully', { userId });
            }
            else {
                logger.warn('Failed to reset Garmin MCP client, but continuing', { userId, message: resetResult.message });
            }
        }
        catch (agentError) {
            logger.warn('Error calling agent service to reset Garmin client, but continuing', { userId, error: agentError });
        }
        logger.info('Garmin disconnected successfully', { userId });
        res.json({
            success: true,
            message: 'Garmin account disconnected successfully',
        });
    }
    catch (error) {
        logger.error('Disconnect Garmin error', { error });
        res.status(500).json({ error: 'Failed to disconnect Garmin account' });
    }
});
// ============================================
// Vault Health Check
// ============================================
router.get('/vault-status', authenticateToken, async (req, res) => {
    try {
        const health = await vaultService.getHealth();
        res.json({
            vault: {
                available: health.available,
                sealed: health.sealed,
                version: health.version,
                configured: vaultService.isConfigured(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check Vault status' });
    }
});
// ============================================
// Helper function to get Garmin credentials for a user
// ============================================
export const getGarminCredentials = (userId) => {
    return garminCredentialsStore.get(userId) || null;
};
export default router;
//# sourceMappingURL=auth.routes.js.map