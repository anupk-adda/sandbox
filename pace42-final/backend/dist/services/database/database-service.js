import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class DatabaseService {
    db = null;
    async connect(dbPath) {
        try {
            // Ensure database directory exists
            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            // Connect to database
            this.db = new Database(dbPath, {
                verbose: process.env.NODE_ENV === 'development' ? logger.debug.bind(logger) : undefined,
            });
            // Enable WAL mode for better concurrency
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('foreign_keys = ON');
            // Initialize schema if database is new
            await this.initializeSchema();
            logger.info('Database connected successfully', { path: dbPath });
        }
        catch (error) {
            logger.error('Failed to connect to database', { error });
            throw error;
        }
    }
    async initializeSchema() {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        // Check if schema is already initialized
        const tables = this.db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
            .all();
        if (tables.length === 0) {
            // Read and execute schema
            const schemaPath = path.join(process.cwd(), '../database/schema.sql');
            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf-8');
                this.db.exec(schema);
                logger.info('Database schema initialized');
            }
            else {
                logger.warn('Schema file not found, skipping initialization');
            }
        }
    }
    exec(sql) {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        this.db.exec(sql);
    }
    prepare(sql) {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        return this.db.prepare(sql);
    }
    run(sql, params = []) {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        return this.db.prepare(sql).run(...params);
    }
    get(sql, params = []) {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        return this.db.prepare(sql).get(...params);
    }
    all(sql, params = []) {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        return this.db.prepare(sql).all(...params);
    }
    transaction(fn) {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        const transaction = this.db.transaction(fn);
        return transaction();
    }
    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            logger.info('Database connection closed');
        }
    }
    // Helper method to generate UUIDs
    generateId() {
        return randomUUID();
    }
    // Helper method to get current timestamp
    now() {
        return new Date().toISOString();
    }
}
export const databaseService = new DatabaseService();
// Made with Bob
//# sourceMappingURL=database-service.js.map