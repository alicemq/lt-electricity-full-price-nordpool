/**
 * Database Migration Runner
 * 
 * Automatically executes migration files from database/migrations/ directory
 * on application startup. Tracks executed migrations in a migrations table.
 */

import pool from './database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_by VARCHAR(255) DEFAULT 'system'
      );
    `);
    console.log('[MIGRATIONS] Migrations table ready');
  } catch (err) {
    console.error('[MIGRATIONS] Error creating migrations table:', err.message);
    throw err;
  }
}

/**
 * Get list of executed migrations
 */
async function getExecutedMigrations() {
  try {
    const result = await pool.query('SELECT filename FROM migrations ORDER BY executed_at');
    return new Set(result.rows.map(row => row.filename));
  } catch (err) {
    console.error('[MIGRATIONS] Error fetching executed migrations:', err.message);
    return new Set();
  }
}

/**
 * Mark migration as executed
 */
async function markMigrationExecuted(filename) {
  try {
    await pool.query(
      'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      [filename]
    );
  } catch (err) {
    console.error(`[MIGRATIONS] Error marking ${filename} as executed:`, err.message);
    throw err;
  }
}

/**
 * Get all migration files from the migrations directory
 */
function getMigrationFiles() {
  const possiblePaths = [
    path.join('/app/database/migrations'),           // Docker - primary path
    path.join(__dirname, '../../database/migrations'), // From backend/src
    path.join(process.cwd(), 'database/migrations'),    // From working directory
  ];

  let migrationsDir = null;
  for (const dirPath of possiblePaths) {
    if (fs.existsSync(dirPath)) {
      migrationsDir = dirPath;
      break;
    }
  }

  if (!migrationsDir) {
    console.warn('[MIGRATIONS] Migrations directory not found. Skipping migrations.');
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .filter(file => file !== 'README.md' && file !== 'CLI_COMMANDS.md')
    .sort(); // Execute in alphabetical order (should be date-prefixed)

  return files.map(file => ({
    filename: file,
    path: path.join(migrationsDir, file)
  }));
}

/**
 * Execute a single migration file
 */
async function executeMigration(migration) {
  try {
    console.log(`[MIGRATIONS] Executing: ${migration.filename}`);
    const sql = fs.readFileSync(migration.path, 'utf8');
    
    // Execute migration in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await markMigrationExecuted(migration.filename);
      await client.query('COMMIT');
      console.log(`[MIGRATIONS] ✓ Successfully executed: ${migration.filename}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`[MIGRATIONS] ✗ Error executing ${migration.filename}:`, err.message);
    throw err;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations() {
  console.log('[MIGRATIONS] ========================================');
  console.log('[MIGRATIONS] Starting migration runner');
  console.log('[MIGRATIONS] ========================================');

  try {
    // Ensure migrations table exists
    await ensureMigrationsTable();

    // Get executed migrations
    const executed = await getExecutedMigrations();
    console.log(`[MIGRATIONS] Found ${executed.size} previously executed migrations`);

    // Get all migration files
    const migrationFiles = getMigrationFiles();
    console.log(`[MIGRATIONS] Found ${migrationFiles.length} migration files`);

    if (migrationFiles.length === 0) {
      console.log('[MIGRATIONS] No migration files found. Skipping.');
      return;
    }

    // Filter out already executed migrations
    const pending = migrationFiles.filter(m => !executed.has(m.filename));

    if (pending.length === 0) {
      console.log('[MIGRATIONS] All migrations are up to date.');
      return;
    }

    console.log(`[MIGRATIONS] Found ${pending.length} pending migration(s)`);

    // Execute pending migrations in order
    for (const migration of pending) {
      await executeMigration(migration);
    }

    console.log('[MIGRATIONS] ✓ All migrations completed successfully');
    console.log('[MIGRATIONS] ========================================');
  } catch (err) {
    console.error('[MIGRATIONS] ✗ Migration runner failed:');
    console.error('[MIGRATIONS] Error:', err.message);
    console.error('[MIGRATIONS] Stack:', err.stack);
    console.error('[MIGRATIONS] ========================================');
    // Don't throw - allow application to continue even if migrations fail
    // (they might already be applied manually)
  }
}

