import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { hashSync } from "bcryptjs";
import { createClient, type Client, type ResultSet, type Transaction } from "@libsql/client/http";

export type SqlValue = string | number | null;

interface SqlExecutor {
  get<T>(sql: string, ...params: SqlValue[]): Promise<T | undefined>;
  all<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  run(sql: string, ...params: SqlValue[]): Promise<void>;
}

interface SqlDb extends SqlExecutor {
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

const txContext = new AsyncLocalStorage<SqlExecutor>();
const lockOwner = new AsyncLocalStorage<true>();

const SCHEMA_VERSION = 2;
const globalForDb = globalThis as unknown as {
  __futebolSql?: Promise<SqlDb>;
  __futebolSchema?: number;
};

const SCHEMA = `
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

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    player_key TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS month_payments (
    id TEXT PRIMARY KEY,
    player_key TEXT NOT NULL,
    year_month TEXT NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1)),
    paid_at TEXT,
    UNIQUE (player_key, year_month)
  );

  CREATE INDEX IF NOT EXISTS idx_month_open ON month_payments(paid, player_key);
`;

function rowObject<T>(columns: string[], row: ResultSet["rows"][number]): T {
  const record: Record<string, unknown> = {};
  for (const column of columns) record[column] = row[column];
  return record as T;
}

class RemoteExecutor implements SqlExecutor {
  constructor(private readonly conn: Pick<Client | Transaction, "execute">) {}

  async get<T>(sql: string, ...params: SqlValue[]): Promise<T | undefined> {
    const result = await this.conn.execute({ sql, args: params });
    const row = result.rows[0];
    return row ? rowObject<T>(result.columns, row) : undefined;
  }

  async all<T>(sql: string, ...params: SqlValue[]): Promise<T[]> {
    const result = await this.conn.execute({ sql, args: params });
    return result.rows.map((row) => rowObject<T>(result.columns, row));
  }

  async run(sql: string, ...params: SqlValue[]): Promise<void> {
    await this.conn.execute({ sql, args: params });
  }
}

class RemoteDb extends RemoteExecutor implements SqlDb {
  constructor(private readonly client: Client) {
    super(client);
  }

  async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const tx = await this.client.transaction("write");
    try {
      const result = await fn(new RemoteExecutor(tx));
      await tx.commit();
      return result;
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  }
}

class LocalDb implements SqlDb {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly raw: import("node:sqlite").DatabaseSync) {}

  private gate<T>(fn: () => T | Promise<T>): Promise<T> {
    if (lockOwner.getStore()) return Promise.resolve().then(fn);

    const job = this.tail.then(() => lockOwner.run(true, fn));
    this.tail = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }

  get<T>(sql: string, ...params: SqlValue[]): Promise<T | undefined> {
    return this.gate(() => this.raw.prepare(sql).get(...params) as T | undefined);
  }

  all<T>(sql: string, ...params: SqlValue[]): Promise<T[]> {
    return this.gate(() => this.raw.prepare(sql).all(...params) as T[]);
  }

  run(sql: string, ...params: SqlValue[]): Promise<void> {
    return this.gate(() => {
      this.raw.prepare(sql).run(...params);
    });
  }

  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.gate(async () => {
      this.raw.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(this);
        this.raw.exec("COMMIT");
        return result;
      } catch (error) {
        this.raw.exec("ROLLBACK");
        throw error;
      }
    });
  }
}

async function seedAdmin(db: SqlDb) {
  const existing = await db.get("SELECT id FROM users LIMIT 1");
  if (existing) return;

  const username = process.env.ADMIN_USER ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "futebol123";
  await db.run(
    "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
    crypto.randomUUID(),
    username,
    hashSync(password, 10),
    new Date().toISOString(),
  );
}

async function openLocal(): Promise<SqlDb> {
  const { DatabaseSync } = await import("node:sqlite");
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const raw = new DatabaseSync(path.join(dataDir, "futebol.db"));
  raw.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
  `);
  raw.exec(SCHEMA);

  const db = new LocalDb(raw);
  await seedAdmin(db);
  await backfillRoster(db);
  return db;
}

async function openRemote(url: string): Promise<SqlDb> {
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: "number",
  });
  await client.executeMultiple(SCHEMA);
  const db = new RemoteDb(client);
  await seedAdmin(db);
  await backfillRoster(db);
  return db;
}

async function openDatabase(): Promise<SqlDb> {
  const url = process.env.TURSO_DATABASE_URL?.trim();

  if (process.env.VERCEL && !url) {
    throw new Error("Falta o banco. Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN na hospedagem.");
  }

  return url ? openRemote(url) : openLocal();
}

async function backfillRoster(db: SqlDb) {
  const rows = await db.all<{ player_name: string; player_key: string; created_at: string }>(
    `SELECT player_name, player_key, MIN(created_at) AS created_at
     FROM entries
     GROUP BY player_key`,
  );

  for (const row of rows) {
    const existing = await db.get<{ id: string }>("SELECT id FROM players WHERE player_key = ?", row.player_key);
    if (existing) continue;
    await db.run(
      "INSERT INTO players (id, name, player_key, active, created_at) VALUES (?, ?, ?, 1, ?)",
      crypto.randomUUID(),
      row.player_name,
      row.player_key,
      row.created_at,
    );
  }
}

function getDb() {
  if (globalForDb.__futebolSchema !== SCHEMA_VERSION) {
    globalForDb.__futebolSql = undefined;
    globalForDb.__futebolSchema = SCHEMA_VERSION;
  }

  globalForDb.__futebolSql ??= openDatabase().catch((error) => {
    globalForDb.__futebolSql = undefined;
    throw error;
  });
  return globalForDb.__futebolSql;
}

async function current() {
  return txContext.getStore() ?? getDb();
}

export async function dbGet<T>(sql: string, ...params: SqlValue[]) {
  const db = await current();
  return db.get<T>(sql, ...params);
}

export async function dbAll<T>(sql: string, ...params: SqlValue[]) {
  const db = await current();
  return db.all<T>(sql, ...params);
}

export async function dbRun(sql: string, ...params: SqlValue[]) {
  const db = await current();
  await db.run(sql, ...params);
}

export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction((tx) => txContext.run(tx, fn));
}
