import "server-only";

import { formatDayLabel, formatTime, saoPauloDateKey } from "@/lib/dates";
import { dbAll, dbGet, dbRun, withTransaction, type SqlValue } from "@/lib/db";
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

function one<T>(sql: string, ...params: SqlValue[]) {
  return dbGet<T>(sql, ...params);
}

function many<T>(sql: string, ...params: SqlValue[]) {
  return dbAll<T>(sql, ...params);
}

function run(sql: string, ...params: SqlValue[]) {
  return dbRun(sql, ...params);
}

function nowIso() {
  return new Date().toISOString();
}

async function uniqueLabel(date = new Date()) {
  const base = formatDayLabel(date);
  if (!(await one("SELECT id FROM days WHERE label = ?", base))) return base;

  const withTime = `${base} · ${formatTime(date)}`;
  if (!(await one("SELECT id FROM days WHERE label = ?", withTime))) return withTime;

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

async function readEntries(dayId: string) {
  return (await many<EntryRow>(
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
  )).map(mapEntry);
}

async function toDayView(row: DayRow): Promise<DayView> {
  return {
    id: row.id,
    label: row.label,
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    entries: await readEntries(row.id),
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

async function insertOpenDay() {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const label = await uniqueLabel();
  await run(
    "INSERT INTO days (id, label, status, created_at, closed_at) VALUES (?, ?, 'open', ?, NULL)",
    id,
    label,
    createdAt,
  );

  const row = await one<DayRow>(
    "SELECT id, label, status, created_at, closed_at FROM days WHERE id = ?",
    id,
  );

  if (!row) throw new AppError("Não deu para abrir o dia.");
  return toDayView(row);
}

async function applyPaid(entryId: string, paid: boolean) {
  const entry = await entryContext(entryId);
  if (!entry) throw new AppError("Esse nome não está na lista.");

  await run("UPDATE entries SET paid = ? WHERE id = ?", paid ? 1 : 0, entryId);

  if (paid) {
    await run(
      "UPDATE debts SET settled = 1, settled_at = ? WHERE entry_id = ? AND settled = 0",
      nowIso(),
      entryId,
    );
    return;
  }

  if (entry.day_status === "open") {
    await run("DELETE FROM debts WHERE entry_id = ?", entryId);
    return;
  }

  const existing = await one<{ id: string }>("SELECT id FROM debts WHERE entry_id = ?", entryId);
  if (existing) {
    await run(
      "UPDATE debts SET settled = 0, settled_at = NULL, player_name = ?, player_key = ? WHERE entry_id = ?",
      entry.player_name,
      entry.player_key,
      entryId,
    );
    return;
  }

  await run(
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

export async function ensureOpenDay() {
  const existing = await findOpenDay();
  const today = saoPauloDateKey(new Date());

  if (!existing) {
    try {
      return await withTransaction(() => insertOpenDay());
    } catch (error) {
      const raced = await findOpenDay();
      if (raced) return toDayView(raced);
      throw error;
    }
  }

  const count = await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM entries WHERE day_id = ?",
    existing.id,
  );

  if (Number(count?.n ?? 0) === 0 && saoPauloDateKey(new Date(existing.created_at)) !== today) {
    return withTransaction(async () => {
      const label = await uniqueLabel();
      await run(
        "UPDATE days SET label = ?, created_at = ? WHERE id = ?",
        label,
        nowIso(),
        existing.id,
      );
      const row = await one<DayRow>(
        "SELECT id, label, status, created_at, closed_at FROM days WHERE id = ?",
        existing.id,
      );
      if (!row) throw new AppError("Não deu para atualizar o dia.");
      return toDayView(row);
    });
  }

  return toDayView(existing);
}

export async function entryDayId(entryId: string) {
  return (await one<{ day_id: string }>("SELECT day_id FROM entries WHERE id = ?", entryId))?.day_id;
}

export async function getDay(id: string) {
  const row = await one<DayRow>(
    "SELECT id, label, status, created_at, closed_at FROM days WHERE id = ?",
    id,
  );
  return row ? toDayView(row) : null;
}

export async function listHistory() {
  return (await many<{
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
  )).map((row) => ({
    id: row.id,
    label: row.label,
    closedAt: row.closed_at,
    total: Number(row.total),
    paid: Number(row.paid),
  }));
}

export async function countDebtorPeople() {
  const row = await one<{ n: number }>(
    "SELECT COUNT(DISTINCT player_key) AS n FROM debts WHERE settled = 0",
  );
  return Number(row?.n ?? 0);
}

export async function getDebtors() {
  const open = await many<DebtRow>(
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

  const settled = (await many<DebtRow>(
    `SELECT id, entry_id, player_name, player_key, day_id, day_label, created_at, settled_at
     FROM debts
     WHERE settled = 1
     ORDER BY settled_at DESC
     LIMIT 12`,
  )).map((debt) => ({
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

export async function addPlayer(dayId: string, rawName: string) {
  const name = cleanName(rawName);
  const key = playerKey(name);

  return withTransaction(async () => {
    const day = await one<DayRow>(
      "SELECT id, label, status, created_at, closed_at FROM days WHERE id = ? AND status = 'open'",
      dayId,
    );
    if (!day) throw new AppError("Não há uma lista aberta.");

    const latest = await one<{ player_key: string; created_at: string }>(
      "SELECT player_key, created_at FROM entries WHERE day_id = ? ORDER BY position DESC LIMIT 1",
      dayId,
    );
    if (latest?.player_key === key) {
      const age = Date.now() - new Date(latest.created_at).getTime();
      if (age >= 0 && age < 2500) {
        throw new AppError(`${name} acabou de entrar. Se for outra pessoa, espera um instante e anota de novo.`);
      }
    }

    const position = await one<{ n: number }>(
      "SELECT COALESCE(MAX(position), 0) + 1 AS n FROM entries WHERE day_id = ?",
      dayId,
    );

    await run(
      `INSERT INTO entries (id, day_id, player_name, player_key, position, paid, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      crypto.randomUUID(),
      dayId,
      name,
      key,
      Number(position?.n ?? 1),
      nowIso(),
    );

    const debts = await one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM debts WHERE player_key = ? AND settled = 0",
      key,
    );

    return { name, debtCount: Number(debts?.n ?? 0) };
  });
}

export async function setPlayerPaid(entryId: string, paid: boolean) {
  await withTransaction(() => applyPaid(entryId, paid));
}

export async function movePlayer(entryId: string, direction: "up" | "down") {
  await withTransaction(async () => {
    const entry = await entryContext(entryId);
    if (!entry) throw new AppError("Esse nome não está na lista.");
    if (entry.day_status !== "open") throw new AppError("Essa lista já fechou.");

    const neighborPosition = entry.position + (direction === "up" ? -1 : 1);
    const neighbor = await one<{ id: string }>(
      "SELECT id FROM entries WHERE day_id = ? AND position = ?",
      entry.day_id,
      neighborPosition,
    );
    if (!neighbor) return;

    await run("UPDATE entries SET position = ? WHERE id = ?", neighborPosition, entry.id);
    await run("UPDATE entries SET position = ? WHERE id = ?", entry.position, neighbor.id);
  });
}

export async function removePlayer(entryId: string) {
  await withTransaction(async () => {
    const entry = await entryContext(entryId);
    if (!entry) throw new AppError("Esse nome não está na lista.");
    if (entry.day_status !== "open") throw new AppError("Essa lista já fechou.");

    await run("DELETE FROM debts WHERE entry_id = ?", entryId);
    await run("DELETE FROM entries WHERE id = ?", entryId);

    const rest = await many<{ id: string }>(
      "SELECT id FROM entries WHERE day_id = ? ORDER BY position ASC",
      entry.day_id,
    );

    for (const [index, row] of rest.entries()) {
      await run("UPDATE entries SET position = ? WHERE id = ?", index + 1, row.id);
    }
  });
}

export async function renamePlayer(entryId: string, rawName: string) {
  const name = cleanName(rawName);
  const key = playerKey(name);

  await withTransaction(async () => {
    const entry = await entryContext(entryId);
    if (!entry) throw new AppError("Esse nome não está na lista.");

    await run("UPDATE entries SET player_name = ?, player_key = ? WHERE id = ?", name, key, entryId);
    await run(
      "UPDATE debts SET player_name = ?, player_key = ? WHERE entry_id = ?",
      name,
      key,
      entryId,
    );
  });
}

export async function startNewDay() {
  return withTransaction(async () => {
    const day = await findOpenDay();
    if (!day) return insertOpenDay();

    const entries = await many<{ id: string; player_name: string; player_key: string; paid: number }>(
      "SELECT id, player_name, player_key, paid FROM entries WHERE day_id = ? ORDER BY position ASC",
      day.id,
    );

    if (entries.length === 0) {
      throw new AppError("A lista ainda está vazia. Anota quem chegou antes de fechar o dia.");
    }

    const createdAt = nowIso();

    for (const entry of entries) {
      if (entry.paid === 1) continue;
      const existing = await one("SELECT id FROM debts WHERE entry_id = ?", entry.id);
      if (existing) continue;

      await run(
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

    await run("UPDATE days SET status = 'closed', closed_at = ? WHERE id = ?", createdAt, day.id);
    return insertOpenDay();
  });
}

export async function settleDebt(debtId: string) {
  const debt = await one<{ entry_id: string; settled: number }>(
    "SELECT entry_id, settled FROM debts WHERE id = ?",
    debtId,
  );
  if (!debt || debt.settled === 1) return;
  await setPlayerPaid(debt.entry_id, true);
}

export async function settlePlayerDebts(key: string) {
  const debts = await many<{ entry_id: string }>(
    "SELECT entry_id FROM debts WHERE player_key = ? AND settled = 0",
    key,
  );

  if (debts.length === 0) return;

  await withTransaction(async () => {
    for (const debt of debts) await applyPaid(debt.entry_id, true);
  });
}
