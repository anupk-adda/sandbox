/**
 * Token Service
 * Manages JWT tokens with Vault integration for enhanced security
 */
export interface TokenPayload {
    userId: string;
    username: string;
    type: 'access' | 'refresh';
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface PasswordResetToken {
    token: string;
    expiresAt: Date;
}
declare class TokenService {
    private jwtSecret;
    private refreshSecret;
    private secretsLoaded;
    constructor();
    /**
     * Load JWT secrets from Vault or fallback
     */
    private loadSecrets;
    /**
     * Ensure secrets are loaded
     */
    private ensureSecrets;
    /**
     * Generate a token pair (access + refresh)
     */
    generateTokenPair(userId: string, username: string, rememberMe?: boolean): Promise<TokenPair>;
    /**
     * Verify access token
     */
    verifyAccessToken(token: string): Promise<TokenPayload | null>;
    /**
     * Refresh access token using refresh token
     */
    refreshAccessToken(refreshToken: string): Promise<TokenPair | null>;
    /**
     * Revoke a session
     */
    revokeSession(sessionId: string): Promise<boolean>;
    /**
     * Revoke all sessions for a user
     */
    revokeAllUserSessions(userId: string): Promise<boolean>;
    /**
     * Generate password reset token
     */
    generatePasswordResetToken(userId: string): Promise<PasswordResetToken | null>;
    /**
     * Verify password reset token
     */
    verifyPasswordResetToken(token: string): Promise<string | null>;
    /**
     * Mark password reset token as used
     */
    markPasswordResetTokenUsed(token: string): Promise<boolean>;
    /**
     * Clean up expired tokens and sessions
     */
    cleanupExpiredTokens(): Promise<void>;
    /**
     * Get active sessions for a user
     */
    getActiveSessions(userId: string): Array<{
        id: string;
        deviceInfo: string | null;
        ipAddress: string | null;
        createdAt: string;
        lastUsedAt: string;
    }>;
}
export declare const tokenService: TokenService;
export {};
//# sourceMappingURL=token-service.d.ts.map