/**
 * Garmin Token Service
 * Handles token exchange and Vault storage for Garmin OAuth tokens
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
 */
export declare class GarminTokenService {
    private mcpPythonPath;
    private mcpServerPath;
    constructor();
    /**
     * Exchange credentials for OAuth tokens.
     * Spawns MCP server, logs in, extracts tokens, stores in Vault.
     */
    exchangeCredentialsForTokens(userId: string, credentials: GarminCredentials): Promise<TokenExchangeResult>;
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
    /**
     * Delete tokens from Vault (on disconnect)
     */
    deleteTokens(userId: string): Promise<boolean>;
}
export declare const garminTokenService: GarminTokenService;
//# sourceMappingURL=garmin-token-service.d.ts.map