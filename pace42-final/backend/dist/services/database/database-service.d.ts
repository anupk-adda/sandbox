import Database from 'better-sqlite3';
export declare class DatabaseService {
    private db;
    connect(dbPath: string): Promise<void>;
    private initializeSchema;
    exec(sql: string): void;
    prepare(sql: string): Database.Statement;
    run(sql: string, params?: any[]): Database.RunResult;
    get<T = any>(sql: string, params?: any[]): T | undefined;
    all<T = any>(sql: string, params?: any[]): T[];
    transaction<T>(fn: () => T): T;
    close(): Promise<void>;
    generateId(): string;
    now(): string;
}
export declare const databaseService: DatabaseService;
//# sourceMappingURL=database-service.d.ts.map