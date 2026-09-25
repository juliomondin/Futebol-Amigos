import "server-only";

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashSync } from "bcryptjs";

const globalForDb = globalThis as unknown as { __futebolDb?: DatabaseSync };

function seedAdmin(db: DatabaseSync) {
  const existing = db.prepare("SELECT id FROM users LIMIT 1").get();
  if (existing) return;

  const username = process.env.ADMIN_USER ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "futebol123";
  db.prepare(
    "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
  ).run(crypto.randomUUID(), username, hashSync(password, 10), new Date().toISOString());
}

function openDatabase() {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new DatabaseSync(path.join(dataDir, "futebol.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS days (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
      created_at TEXT NOT NULL,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      day_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      player_key TEXT NOT NULL,
      position INTEGER NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1)),
      created_at TEXT NOT NULL,
      FOREIGN KEY (day_id) REFERENCES days(id)
    );

    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL UNIQUE,
      player_name TEXT NOT NULL,
      player_key TEXT NOT NULL,
      day_id TEXT NOT NULL,
      day_label TEXT NOT NULL,
      settled INTEGER NOT NULL DEFAULT 0 CHECK (settled IN (0, 1)),
      created_at TEXT NOT NULL,
      settled_at TEXT,
      FOREIGN KEY (entry_id) REFERENCES entries(id),
      FOREIGN KEY (day_id) REFERENCES days(id)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_day ON entries(day_id, position);
    CREATE INDEX IF NOT EXISTS idx_debts_open ON debts(settled, player_key);
    CREATE INDEX IF NOT EXISTS idx_days_status ON days(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_day ON days(status) WHERE status = 'open';
  `);

  seedAdmin(db);
  return db;
}

export function getDb() {
  if (!globalForDb.__futebolDb) {
    globalForDb.__futebolDb = openDatabase();
  }

  return globalForDb.__futebolDb;
}

export function withTransaction<T>(fn: () => T) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");

  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
