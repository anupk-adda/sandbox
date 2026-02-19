import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseService {
  private db: Database.Database | null = null;

  async connect(dbPath: string): Promise<void> {
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
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  private async initializeSchema(): Promise<void> {
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
      } else {
        logger.warn('Schema file not found, skipping initialization');
      }
    }
  }

  exec(sql: string): void {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    this.db.exec(sql);
  }

  prepare(sql: string): Database.Statement {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql);
  }

  run(sql: string, params: any[] = []): Database.RunResult {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql).run(...params);
  }

  get<T = any>(sql: string, params: any[] = []): T | undefined {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  all<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql).all(...params) as T[];
  }

  transaction<T>(fn: () => T): T {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  // Helper method to generate UUIDs
  generateId(): string {
    return randomUUID();
  }

  // Helper method to get current timestamp
  now(): string {
    return new Date().toISOString();
  }
}

export const databaseService = new DatabaseService();

// Made with Bob
