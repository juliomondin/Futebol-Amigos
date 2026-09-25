import "server-only";

import { formatDayLabel, formatMonthLabel, formatTime, saoPauloDateKey, saoPauloMonthKey } from "@/lib/dates";
import { dbAll, dbGet, dbRun, withTransaction, type SqlValue } from "@/lib/db";
import { cleanName, playerKey } from "@/lib/names";
import type {
  DayView,
  DebtItem,
  DebtorGroup,
  EntryView,
  HistoryDay,
  RosterPlayer,
  SettledDebt,
} from "@/lib/types";

export type { DayView, DebtItem, DebtorGroup, EntryView, HistoryDay, RosterPlayer, SettledDebt };
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
  const month = saoPauloMonthKey();
  return (
    await many<EntryRow>(
      `SELECT
         e.id,
         e.player_name,
         e.position,
         COALESCE((
           SELECT mp.paid
           FROM month_payments mp
           WHERE mp.player_key = e.player_key AND mp.year_month = ?
         ), 0) AS paid,
         (
           SELECT COUNT(*)
           FROM month_payments mp
           WHERE mp.player_key = e.player_key
             AND mp.paid = 0
             AND mp.year_month < ?
         ) AS previous_debts
       FROM entries e
       WHERE e.day_id = ?
       ORDER BY e.position ASC`,
      month,
      month,
      dayId,
    )
  ).map(mapEntry);
}

async function syncCurrentMonth() {
  const month = saoPauloMonthKey();
  const players = await many<{ player_key: string }>("SELECT player_key FROM players WHERE active = 1");
  for (const player of players) {
    const existing = await one(
      "SELECT id FROM month_payments WHERE player_key = ? AND year_month = ?",
      player.player_key,
      month,
    );
    if (existing) continue;
    await run(
      "INSERT INTO month_payments (id, player_key, year_month, paid, paid_at) VALUES (?, ?, ?, 0, NULL)",
      crypto.randomUUID(),
      player.player_key,
      month,
    );
  }
}

async function ensurePlayerMonth(playerKeyValue: string) {
  const month = saoPauloMonthKey();
  const existing = await one(
    "SELECT id FROM month_payments WHERE player_key = ? AND year_month = ?",
    playerKeyValue,
    month,
  );
  if (existing) return;
  await run(
    "INSERT INTO month_payments (id, player_key, year_month, paid, paid_at) VALUES (?, ?, ?, 0, NULL)",
    crypto.randomUUID(),
    playerKeyValue,
    month,
  );
}

async function upsertPlayer(rawName: string) {
  const name = cleanName(rawName);
  const key = playerKey(name);
  const existing = await one<{ id: string; name: string; active: number }>(
    "SELECT id, name, active FROM players WHERE player_key = ?",
    key,
  );

  if (existing) {
    if (existing.active === 0) {
      await run("UPDATE players SET active = 1 WHERE id = ?", existing.id);
    }
    await ensurePlayerMonth(key);
    return { id: existing.id, name: existing.name, key };
  }

  const id = crypto.randomUUID();
  await run(
    "INSERT INTO players (id, name, player_key, active, created_at) VALUES (?, ?, ?, 1, ?)",
    id,
    name,
    key,
    nowIso(),
  );
  await ensurePlayerMonth(key);
  return { id, name, key };
}

async function setMonthPaid(playerKeyValue: string, yearMonth: string, paid: boolean) {
  const existing = await one<{ id: string }>(
    "SELECT id FROM month_payments WHERE player_key = ? AND year_month = ?",
    playerKeyValue,
    yearMonth,
  );
  const paidAt = paid ? nowIso() : null;
  if (!existing) {
    await run(
      "INSERT INTO month_payments (id, player_key, year_month, paid, paid_at) VALUES (?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      playerKeyValue,
      yearMonth,
      paid ? 1 : 0,
      paidAt,
    );
    return;
  }
  await run("UPDATE month_payments SET paid = ?, paid_at = ? WHERE id = ?", paid ? 1 : 0, paidAt, existing.id);
}

async function appendToDay(dayId: string, name: string, key: string) {
  const already = await one(
    "SELECT id FROM entries WHERE day_id = ? AND player_key = ?",
    dayId,
    key,
  );
  if (already) throw new AppError(`${name} já está na lista de hoje.`);

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
    "SELECT COUNT(*) AS n FROM month_payments WHERE player_key = ? AND paid = 0 AND year_month < ?",
    key,
    saoPauloMonthKey(),
  );

  return { name, debtCount: Number(debts?.n ?? 0) };
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

export async function ensureOpenDay() {
  await syncCurrentMonth();
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
  return (
    await many<{
      id: string;
      label: string;
      closed_at: string;
      total: number;
    }>(
      `SELECT
         d.id,
         d.label,
         d.closed_at,
         (SELECT COUNT(*) FROM entries e WHERE e.day_id = d.id) AS total
       FROM days d
       WHERE d.status = 'closed'
       ORDER BY d.closed_at DESC`,
    )
  ).map((row) => ({
    id: row.id,
    label: row.label,
    closedAt: row.closed_at,
    total: Number(row.total),
  }));
}

export async function countDebtorPeople() {
  await syncCurrentMonth();
  const row = await one<{ n: number }>(
    "SELECT COUNT(DISTINCT player_key) AS n FROM month_payments WHERE paid = 0",
  );
  return Number(row?.n ?? 0);
}

export async function getDebtors() {
  await syncCurrentMonth();
  const open = await many<{
    id: string;
    player_name: string;
    player_key: string;
    year_month: string;
  }>(
    `SELECT mp.id, p.name AS player_name, mp.player_key, mp.year_month
     FROM month_payments mp
     JOIN players p ON p.player_key = mp.player_key
     WHERE mp.paid = 0
     ORDER BY mp.year_month ASC`,
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
      yearMonth: debt.year_month,
      label: formatMonthLabel(debt.year_month),
    });
    groups.set(debt.player_key, current);
  }

  const settled = (
    await many<{ id: string; player_name: string; year_month: string; paid_at: string }>(
      `SELECT mp.id, p.name AS player_name, mp.year_month, mp.paid_at
       FROM month_payments mp
       JOIN players p ON p.player_key = mp.player_key
       WHERE mp.paid = 1 AND mp.paid_at IS NOT NULL
       ORDER BY mp.paid_at DESC
       LIMIT 12`,
    )
  ).map((debt) => ({
    id: debt.id,
    playerName: debt.player_name,
    label: formatMonthLabel(debt.year_month),
    settledAt: debt.paid_at,
  }));

  return {
    groups: [...groups.values()].sort(
      (a, b) => b.debts.length - a.debts.length || a.playerName.localeCompare(b.playerName, "pt-BR"),
    ),
    settled,
  };
}

export async function listRoster(): Promise<RosterPlayer[]> {
  await syncCurrentMonth();
  const month = saoPauloMonthKey();
  const openDay = await findOpenDay();
  const rows = await many<{
    id: string;
    name: string;
    player_key: string;
    month_paid: number;
    owed_months: number;
    present: number;
  }>(
    `SELECT
       p.id,
       p.name,
       p.player_key,
       COALESCE((
         SELECT mp.paid FROM month_payments mp
         WHERE mp.player_key = p.player_key AND mp.year_month = ?
       ), 0) AS month_paid,
       (
         SELECT COUNT(*) FROM month_payments mp
         WHERE mp.player_key = p.player_key AND mp.paid = 0 AND mp.year_month < ?
       ) AS owed_months,
       CASE WHEN EXISTS (
         SELECT 1 FROM entries e WHERE e.day_id = ? AND e.player_key = p.player_key
       ) THEN 1 ELSE 0 END AS present
     FROM players p
     WHERE p.active = 1`,
    month,
    month,
    openDay?.id ?? "",
  );

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      playerKey: row.player_key,
      monthPaid: row.month_paid === 1,
      owedMonths: Number(row.owed_months ?? 0),
      present: row.present === 1,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function deactivatePlayer(playerId: string) {
  const player = await one<{ id: string }>("SELECT id FROM players WHERE id = ? AND active = 1", playerId);
  if (!player) throw new AppError("Esse jogador não está no elenco.");
  await run("UPDATE players SET active = 0 WHERE id = ?", playerId);
}

export async function registerPlayer(rawName: string) {
  const name = cleanName(rawName);
  const key = playerKey(name);
  return withTransaction(async () => {
    const existing = await one<{ active: number }>("SELECT active FROM players WHERE player_key = ?", key);
    if (existing?.active === 1) throw new AppError("Esse nome já está no elenco.");
    return upsertPlayer(name);
  });
}

export async function addPlayer(dayId: string, rawName: string) {
  return withTransaction(async () => {
    const day = await one<DayRow>(
      "SELECT id, label, status, created_at, closed_at FROM days WHERE id = ? AND status = 'open'",
      dayId,
    );
    if (!day) throw new AppError("Não há uma lista aberta.");

    const player = await upsertPlayer(rawName);
    return appendToDay(dayId, player.name, player.key);
  });
}

export async function checkInPlayer(playerId: string) {
  const day = await ensureOpenDay();
  return withTransaction(async () => {
    const player = await one<{ id: string; name: string; player_key: string; active: number }>(
      "SELECT id, name, player_key, active FROM players WHERE id = ?",
      playerId,
    );
    if (!player || player.active !== 1) throw new AppError("Esse jogador não está no elenco.");
    await ensurePlayerMonth(player.player_key);
    return appendToDay(day.id, player.name, player.player_key);
  });
}

export async function setPlayerPaid(entryId: string, paid: boolean) {
  const entry = await entryContext(entryId);
  if (!entry) throw new AppError("Esse nome não está na lista.");
  await withTransaction(() => setMonthPaid(entry.player_key, saoPauloMonthKey(), paid));
}

export async function setRosterMonthPaid(playerId: string, paid: boolean) {
  const player = await one<{ player_key: string; active: number }>(
    "SELECT player_key, active FROM players WHERE id = ?",
    playerId,
  );
  if (!player || player.active !== 1) throw new AppError("Esse jogador não está no elenco.");
  await withTransaction(() => setMonthPaid(player.player_key, saoPauloMonthKey(), paid));
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
    if (key !== entry.player_key) {
      const clash = await one("SELECT id FROM players WHERE player_key = ?", key);
      if (clash) throw new AppError("Já existe alguém no elenco com esse nome.");
    }

    await run("UPDATE players SET name = ?, player_key = ? WHERE player_key = ?", name, key, entry.player_key);
    await run(
      "UPDATE entries SET player_name = ?, player_key = ? WHERE player_key = ?",
      name,
      key,
      entry.player_key,
    );
    await run("UPDATE month_payments SET player_key = ? WHERE player_key = ?", key, entry.player_key);
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
    await run("UPDATE days SET status = 'closed', closed_at = ? WHERE id = ?", createdAt, day.id);
    return insertOpenDay();
  });
}

export async function settleDebt(debtId: string) {
  const debt = await one<{ player_key: string; year_month: string; paid: number }>(
    "SELECT player_key, year_month, paid FROM month_payments WHERE id = ?",
    debtId,
  );
  if (!debt || debt.paid === 1) return;
  await withTransaction(() => setMonthPaid(debt.player_key, debt.year_month, true));
}

export async function settlePlayerDebts(key: string) {
  const debts = await many<{ year_month: string }>(
    "SELECT year_month FROM month_payments WHERE player_key = ? AND paid = 0",
    key,
  );
  if (debts.length === 0) return;

  await withTransaction(async () => {
    for (const debt of debts) await setMonthPaid(key, debt.year_month, true);
  });
}
