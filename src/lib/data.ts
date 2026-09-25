import "server-only";

import { formatDayLabel, formatTime, saoPauloDateKey } from "@/lib/dates";
import { getDb, withTransaction } from "@/lib/db";
import { cleanName, playerKey } from "@/lib/names";
import type {
  DayView,
  DebtItem,
  DebtorGroup,
  EntryView,
  HistoryDay,
  SettledDebt,
} from "@/lib/types";

export type { DayView, DebtItem, DebtorGroup, EntryView, HistoryDay, SettledDebt };
export class AppError extends Error {}

type DayRow = {
  id: string;
  label: string;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
};

type EntryRow = {
  id: string;
  player_name: string;
  position: number;
  paid: number;
  previous_debts: number;
};

type DebtRow = {
  id: string;
  entry_id: string;
  player_name: string;
  player_key: string;
  day_id: string;
  day_label: string;
  created_at: string;
  settled_at: string | null;
};

type EntryContext = {
  id: string;
  day_id: string;
  player_name: string;
  player_key: string;
  position: number;
  paid: number;
  day_status: "open" | "closed";
  day_label: string;
};

function one<T>(sql: string, ...params: Array<string | number | null>) {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

function many<T>(sql: string, ...params: Array<string | number | null>) {
  return getDb().prepare(sql).all(...params) as T[];
}

function run(sql: string, ...params: Array<string | number | null>) {
  return getDb().prepare(sql).run(...params);
}

function nowIso() {
  return new Date().toISOString();
}

function uniqueLabel(date = new Date()) {
  const base = formatDayLabel(date);
  if (!one("SELECT id FROM days WHERE label = ?", base)) return base;

  const withTime = `${base} · ${formatTime(date)}`;
  if (!one("SELECT id FROM days WHERE label = ?", withTime)) return withTime;

  return `${withTime} · ${date.getTime().toString().slice(-5)}`;
}

function mapEntry(row: EntryRow): EntryView {
  return {
    id: row.id,
    playerName: row.player_name,
    position: row.position,
    paid: row.paid === 1,
    previousDebts: Number(row.previous_debts ?? 0),
  };
}

function readEntries(dayId: string) {
  return many<EntryRow>(
    `SELECT
       e.id,
       e.player_name,
       e.position,
       e.paid,
       (
         SELECT COUNT(*)
         FROM debts dt
         WHERE dt.player_key = e.player_key
           AND dt.settled = 0
           AND dt.entry_id != e.id
       ) AS previous_debts
     FROM entries e
     WHERE e.day_id = ?
     ORDER BY e.position ASC`,
    dayId,
  ).map(mapEntry);
}

function toDayView(row: DayRow): DayView {
  return {
    id: row.id,
    label: row.label,
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    entries: readEntries(row.id),
  };
}

function findOpenDay() {
  return one<DayRow>(
    "SELECT id, label, status, created_at, closed_at FROM days WHERE status = 'open'",
  );
}

function entryContext(entryId: string) {
  return one<EntryContext>(
    `SELECT
       e.id,
       e.day_id,
       e.player_name,
       e.player_key,
       e.position,
       e.paid,
       d.status AS day_status,
       d.label AS day_label
     FROM entries e
     JOIN days d ON d.id = e.day_id
     WHERE e.id = ?`,
    entryId,
  );
}

function insertOpenDay() {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  run(
    "INSERT INTO days (id, label, status, created_at, closed_at) VALUES (?, ?, 'open', ?, NULL)",
    id,
    uniqueLabel(),
    createdAt,
  );

  const row = one<DayRow>(
    "SELECT id, label, status, created_at, closed_at FROM days WHERE id = ?",
    id,
  );

  if (!row) throw new AppError("Não deu para abrir o dia.");
  return toDayView(row);
}

function applyPaid(entryId: string, paid: boolean) {
  const entry = entryContext(entryId);
  if (!entry) throw new AppError("Esse nome não está na lista.");

  run("UPDATE entries SET paid = ? WHERE id = ?", paid ? 1 : 0, entryId);

  if (paid) {
    run(
      "UPDATE debts SET settled = 1, settled_at = ? WHERE entry_id = ? AND settled = 0",
      nowIso(),
      entryId,
    );
    return;
  }

  if (entry.day_status === "open") {
    run("DELETE FROM debts WHERE entry_id = ?", entryId);
    return;
  }

  const existing = one<{ id: string }>("SELECT id FROM debts WHERE entry_id = ?", entryId);
  if (existing) {
    run(
      "UPDATE debts SET settled = 0, settled_at = NULL, player_name = ?, player_key = ? WHERE entry_id = ?",
      entry.player_name,
      entry.player_key,
      entryId,
    );
    return;
  }

  run(
    `INSERT INTO debts (
       id, entry_id, player_name, player_key, day_id, day_label, settled, created_at, settled_at
     ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
    crypto.randomUUID(),
    entry.id,
    entry.player_name,
    entry.player_key,
    entry.day_id,
    entry.day_label,
    nowIso(),
  );
}

export function ensureOpenDay() {
  const existing = findOpenDay();
  const today = saoPauloDateKey(new Date());

  if (!existing) {
    try {
      return withTransaction(() => insertOpenDay());
    } catch (error) {
      const raced = findOpenDay();
      if (raced) return toDayView(raced);
      throw error;
    }
  }

  const count = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM entries WHERE day_id = ?",
    existing.id,
  );

  if (Number(count?.n ?? 0) === 0 && saoPauloDateKey(new Date(existing.created_at)) !== today) {
    return withTransaction(() => {
      run(
        "UPDATE days SET label = ?, created_at = ? WHERE id = ?",
        uniqueLabel(),
        nowIso(),
        existing.id,
      );
      const row = one<DayRow>(
        "SELECT id, label, status, created_at, closed_at FROM days WHERE id = ?",
        existing.id,
      );
      if (!row) throw new AppError("Não deu para atualizar o dia.");
      return toDayView(row);
    });
  }

  return toDayView(existing);
}

export function entryDayId(entryId: string) {
  return one<{ day_id: string }>("SELECT day_id FROM entries WHERE id = ?", entryId)?.day_id;
}

export function getDay(id: string) {
  const row = one<DayRow>(
    "SELECT id, label, status, created_at, closed_at FROM days WHERE id = ?",
    id,
  );
  return row ? toDayView(row) : null;
}

export function listHistory() {
  return many<{
    id: string;
    label: string;
    closed_at: string;
    total: number;
    paid: number;
  }>(
    `SELECT
       d.id,
       d.label,
       d.closed_at,
       (SELECT COUNT(*) FROM entries e WHERE e.day_id = d.id) AS total,
       (SELECT COUNT(*) FROM entries e WHERE e.day_id = d.id AND e.paid = 1) AS paid
     FROM days d
     WHERE d.status = 'closed'
     ORDER BY d.closed_at DESC`,
  ).map((row) => ({
    id: row.id,
    label: row.label,
    closedAt: row.closed_at,
    total: Number(row.total),
    paid: Number(row.paid),
  }));
}

export function countDebtorPeople() {
  const row = one<{ n: number }>(
    "SELECT COUNT(DISTINCT player_key) AS n FROM debts WHERE settled = 0",
  );
  return Number(row?.n ?? 0);
}

export function getDebtors() {
  const open = many<DebtRow>(
    `SELECT id, entry_id, player_name, player_key, day_id, day_label, created_at, settled_at
     FROM debts
     WHERE settled = 0
     ORDER BY created_at ASC`,
  );

  const groups = new Map<string, DebtorGroup>();

  for (const debt of open) {
    const current = groups.get(debt.player_key) ?? {
      playerKey: debt.player_key,
      playerName: debt.player_name,
      debts: [],
    };
    current.playerName = debt.player_name;
    current.debts.push({
      id: debt.id,
      entryId: debt.entry_id,
      dayId: debt.day_id,
      dayLabel: debt.day_label,
      createdAt: debt.created_at,
    });
    groups.set(debt.player_key, current);
  }

  const settled = many<DebtRow>(
    `SELECT id, entry_id, player_name, player_key, day_id, day_label, created_at, settled_at
     FROM debts
     WHERE settled = 1
     ORDER BY settled_at DESC
     LIMIT 12`,
  ).map((debt) => ({
    id: debt.id,
    playerName: debt.player_name,
    dayLabel: debt.day_label,
    settledAt: debt.settled_at ?? debt.created_at,
  }));

  return {
    groups: [...groups.values()].sort(
      (a, b) => b.debts.length - a.debts.length || a.playerName.localeCompare(b.playerName, "pt-BR"),
    ),
    settled,
  };
}

export function addPlayer(dayId: string, rawName: string) {
  const name = cleanName(rawName);
  const key = playerKey(name);

  return withTransaction(() => {
    const day = one<DayRow>(
      "SELECT id, label, status, created_at, closed_at FROM days WHERE id = ? AND status = 'open'",
      dayId,
    );
    if (!day) throw new AppError("Não há uma lista aberta.");

    const latest = one<{ player_key: string; created_at: string }>(
      "SELECT player_key, created_at FROM entries WHERE day_id = ? ORDER BY position DESC LIMIT 1",
      dayId,
    );
    if (latest?.player_key === key) {
      const age = Date.now() - new Date(latest.created_at).getTime();
      if (age >= 0 && age < 2500) {
        throw new AppError(`${name} acabou de entrar. Se for outra pessoa, espera um instante e anota de novo.`);
      }
    }

    const position = one<{ n: number }>(
      "SELECT COALESCE(MAX(position), 0) + 1 AS n FROM entries WHERE day_id = ?",
      dayId,
    );

    run(
      `INSERT INTO entries (id, day_id, player_name, player_key, position, paid, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      crypto.randomUUID(),
      dayId,
      name,
      key,
      Number(position?.n ?? 1),
      nowIso(),
    );

    const debts = one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM debts WHERE player_key = ? AND settled = 0",
      key,
    );

    return { name, debtCount: Number(debts?.n ?? 0) };
  });
}

export function setPlayerPaid(entryId: string, paid: boolean) {
  withTransaction(() => applyPaid(entryId, paid));
}

export function movePlayer(entryId: string, direction: "up" | "down") {
  withTransaction(() => {
    const entry = entryContext(entryId);
    if (!entry) throw new AppError("Esse nome não está na lista.");
    if (entry.day_status !== "open") throw new AppError("Essa lista já fechou.");

    const neighborPosition = entry.position + (direction === "up" ? -1 : 1);
    const neighbor = one<{ id: string }>(
      "SELECT id FROM entries WHERE day_id = ? AND position = ?",
      entry.day_id,
      neighborPosition,
    );
    if (!neighbor) return;

    run("UPDATE entries SET position = ? WHERE id = ?", neighborPosition, entry.id);
    run("UPDATE entries SET position = ? WHERE id = ?", entry.position, neighbor.id);
  });
}

export function removePlayer(entryId: string) {
  withTransaction(() => {
    const entry = entryContext(entryId);
    if (!entry) throw new AppError("Esse nome não está na lista.");
    if (entry.day_status !== "open") throw new AppError("Essa lista já fechou.");

    run("DELETE FROM debts WHERE entry_id = ?", entryId);
    run("DELETE FROM entries WHERE id = ?", entryId);

    const rest = many<{ id: string }>(
      "SELECT id FROM entries WHERE day_id = ? ORDER BY position ASC",
      entry.day_id,
    );

    rest.forEach((row, index) => {
      run("UPDATE entries SET position = ? WHERE id = ?", index + 1, row.id);
    });
  });
}

export function renamePlayer(entryId: string, rawName: string) {
  const name = cleanName(rawName);
  const key = playerKey(name);

  withTransaction(() => {
    const entry = entryContext(entryId);
    if (!entry) throw new AppError("Esse nome não está na lista.");

    run("UPDATE entries SET player_name = ?, player_key = ? WHERE id = ?", name, key, entryId);
    run(
      "UPDATE debts SET player_name = ?, player_key = ? WHERE entry_id = ?",
      name,
      key,
      entryId,
    );
  });
}

export function startNewDay() {
  return withTransaction(() => {
    const day = findOpenDay();
    if (!day) return insertOpenDay();

    const entries = many<{ id: string; player_name: string; player_key: string; paid: number }>(
      "SELECT id, player_name, player_key, paid FROM entries WHERE day_id = ? ORDER BY position ASC",
      day.id,
    );

    if (entries.length === 0) {
      throw new AppError("A lista ainda está vazia. Anota quem chegou antes de fechar o dia.");
    }

    const createdAt = nowIso();

    for (const entry of entries) {
      if (entry.paid === 1) continue;
      const existing = one("SELECT id FROM debts WHERE entry_id = ?", entry.id);
      if (existing) continue;

      run(
        `INSERT INTO debts (
           id, entry_id, player_name, player_key, day_id, day_label, settled, created_at, settled_at
         ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
        crypto.randomUUID(),
        entry.id,
        entry.player_name,
        entry.player_key,
        day.id,
        day.label,
        createdAt,
      );
    }

    run("UPDATE days SET status = 'closed', closed_at = ? WHERE id = ?", createdAt, day.id);
    return insertOpenDay();
  });
}

export function settleDebt(debtId: string) {
  const debt = one<{ entry_id: string; settled: number }>(
    "SELECT entry_id, settled FROM debts WHERE id = ?",
    debtId,
  );
  if (!debt || debt.settled === 1) return;
  setPlayerPaid(debt.entry_id, true);
}

export function settlePlayerDebts(key: string) {
  const debts = many<{ entry_id: string }>(
    "SELECT entry_id FROM debts WHERE player_key = ? AND settled = 0",
    key,
  );

  if (debts.length === 0) return;

  withTransaction(() => {
    for (const debt of debts) applyPaid(debt.entry_id, true);
  });
}
