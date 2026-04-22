/**
 * Initialize the SQLite database schema + optional seed data.
 * Usage:
 *   node scripts/init-db.js          — create schema only
 *   node scripts/init-db.js --seed   — create schema + insert sample data
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'hangboard.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema — same as server.js auto-init
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL DEFAULT (datetime('now')),
    end_time TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp INTEGER NOT NULL,
    raw INTEGER NOT NULL,
    force REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calibration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    "offset" REAL NOT NULL,
    scale REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_samples_session_id ON samples(session_id);
  CREATE INDEX IF NOT EXISTS idx_samples_timestamp ON samples(timestamp);
  CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
  CREATE INDEX IF NOT EXISTS idx_calibration_created_at ON calibration(created_at);
`);

console.log(`Schema initialized: ${dbPath}`);

// Seed if requested
if (process.argv.includes('--seed')) {
  const seedPath = path.join(__dirname, 'seed.sql');
  if (fs.existsSync(seedPath)) {
    db.exec(fs.readFileSync(seedPath, 'utf8'));
    const sessions = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
    const samples = db.prepare('SELECT COUNT(*) as c FROM samples').get().c;
    console.log(`Seed complete: ${sessions} sessions, ${samples} samples`);
  } else {
    console.error(`Seed file not found: ${seedPath}`);
  }
}

db.close();
