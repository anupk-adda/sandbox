interface AppConfig {
    app: {
        name: string;
        version: string;
        environment: string;
    };
    api: {
        port: number;
        host: string;
        baseUrl: string;
        cors: {
            enabled: boolean;
            origins: string[];
            credentials: boolean;
        };
        rateLimit: {
            windowMs: number;
            maxRequests: number;
        };
    };
    agentService: {
        host: string;
        port: number;
        protocol: string;
    };
    database: {
        type: string;
        path: string;
    };
    mcp: {
        garmin: {
            command: string;
            args: string[];
            timeout: number;
        };
    };
}
export declare const config: AppConfig;
export {};
//# sourceMappingURL=config-loader.d.ts.map