/**
 * HashiCorp Vault Service
 * Provides secure credential management and encryption services
 */
interface JWTPair {
    accessSecret: string;
    refreshSecret: string;
    issuer: string;
    audience: string;
}
declare class VaultService {
    private client;
    private config;
    private token;
    private tokenExpiry;
    private isAvailable;
    constructor();
    /**
     * Check if Vault is configured and available
     */
    isConfigured(): boolean;
    /**
     * Authenticate with Vault using AppRole
     */
    authenticate(): Promise<boolean>;
    /**
     * Ensure we have a valid token
     */
    private ensureToken;
    /**
     * Get JWT signing secrets from Vault
     */
    getJWTSecrets(): Promise<JWTPair | null>;
    /**
     * Store encrypted sensitive data
     */
    encryptData(plaintext: string, keyName?: string): Promise<string | null>;
    /**
     * Decrypt sensitive data
     */
    decryptData(ciphertext: string, keyName?: string): Promise<string | null>;
    /**
     * Store API keys securely
     */
    storeAPIKeys(keys: {
        openai?: string;
        garminClientId?: string;
        garminClientSecret?: string;
    }): Promise<boolean>;
    /**
     * Retrieve API keys
     */
    getAPIKeys(): Promise<{
        openai?: string;
        garminClientId?: string;
        garminClientSecret?: string;
    } | null>;
    /**
     * Store refresh token for a user
     */
    storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<boolean>;
    /**
     * Get refresh token for a user
     */
    getRefreshToken(userId: string): Promise<{
        tokenHash: string;
        expiresAt: Date;
    } | null>;
    /**
     * Delete refresh token for a user
     */
    deleteRefreshToken(userId: string): Promise<boolean>;
    /**
     * Get Vault health status
     */
    getHealth(): Promise<{
        available: boolean;
        sealed: boolean;
        version?: string;
    }>;
    /**
     * Check if Vault integration is available
     */
    getAvailability(): boolean;
}
export declare const vaultService: VaultService;
export {};
//# sourceMappingURL=vault-service.d.ts.map