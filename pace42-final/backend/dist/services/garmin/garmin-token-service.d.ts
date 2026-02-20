/**
 * Garmin Token Service
 * Handles credential storage in Vault and on-demand token exchange
 */
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
export declare class GarminTokenService {
    private mcpPythonPath;
    private mcpServerPath;
    constructor();
    /**
     * Store Garmin credentials in Vault (called during connect)
     */
    storeCredentials(userId: string, credentials: GarminCredentials): Promise<boolean>;
    /**
     * Get credentials from Vault (called before token exchange)
     */
    getCredentials(userId: string): Promise<GarminCredentials | null>;
    /**
     * Exchange credentials for OAuth tokens (on-demand)
     * Called every time we need to fetch data from Garmin
     *
     * @param userId - The user ID
     * @param credentials - Optional credentials (if not provided, will fetch from Vault)
     */
    exchangeCredentialsForTokens(userId: string, credentials?: GarminCredentials): Promise<TokenExchangeResult>;
    /**
     * Delete credentials (called during disconnect)
     */
    deleteCredentials(userId: string): Promise<boolean>;
    /**
     * Perform login with MCP server and extract tokens
     */
    private performLoginAndExtractTokens;
    /**
     * Read tokens from filesystem store
     */
    private readTokensFromStore;
    /**
     * Clear token store files
     */
    private clearTokenStore;
}
export declare const garminTokenService: GarminTokenService;
//# sourceMappingURL=garmin-token-service.d.ts.map