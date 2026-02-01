/**
 * Database Connection - SQLite connection with pragmas and initialization
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface DatabaseOptions {
  path?: string;
  readonly?: boolean;
  verbose?: boolean;
}

let db: Database.Database | null = null;

/**
 * Get or create the database connection
 */
export function getDatabase(options: DatabaseOptions = {}): Database.Database {
  if (db) return db;

  const dbPath = options.path ||
    process.env.DATABASE_PATH ||
    join(__dirname, '../../database/research.db');

  // Ensure directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const dbOptions: { readonly?: boolean; verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void } = {};
  if (options.readonly === true) {
    dbOptions.readonly = true;
  }
  if (options.verbose) {
    dbOptions.verbose = console.log;
  }

  db = new Database(dbPath, dbOptions);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Optimize for performance
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('temp_store = MEMORY');

  return db;
}

/**
 * Initialize database schema
 */
export function initializeDatabase(options: DatabaseOptions = {}): void {
  const database = getDatabase(options);

  // Read and execute schema
  const schemaPath = join(__dirname, '../../database/schema.sql');
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8');
    database.exec(schema);
  }
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Execute a transaction
 */
export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}

/**
 * Check database health
 */
export function checkDatabaseHealth(): { ok: boolean; tables: string[]; error?: string } {
  try {
    const database = getDatabase();

    // Check if we can query
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    // Verify foreign keys are enabled
    const fkEnabled = database.pragma('foreign_keys') as { foreign_keys: number }[];
    if (!fkEnabled[0]?.foreign_keys) {
      return { ok: false, tables: [], error: 'Foreign keys not enabled' };
    }

    return {
      ok: true,
      tables: tables.map(t => t.name)
    };
  } catch (error) {
    return {
      ok: false,
      tables: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  directories: number;
  researchers: number;
  publications: number;
  scrape_jobs: number;
  pending_enrichment: number;
} {
  const database = getDatabase();

  const stats = {
    directories: 0,
    researchers: 0,
    publications: 0,
    scrape_jobs: 0,
    pending_enrichment: 0,
  };

  try {
    stats.directories = (database.prepare('SELECT COUNT(*) as count FROM directories').get() as { count: number }).count;
    stats.researchers = (database.prepare('SELECT COUNT(*) as count FROM researchers').get() as { count: number }).count;
    stats.publications = (database.prepare('SELECT COUNT(*) as count FROM publications').get() as { count: number }).count;
    stats.scrape_jobs = (database.prepare('SELECT COUNT(*) as count FROM scrape_jobs').get() as { count: number }).count;
    stats.pending_enrichment = (database.prepare("SELECT COUNT(*) as count FROM enrichment_queue WHERE status = 'pending'").get() as { count: number }).count;
  } catch {
    // Tables might not exist yet
  }

  return stats;
}

export default getDatabase;
