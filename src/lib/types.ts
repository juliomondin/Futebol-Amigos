export type EntryView = {
  id: string;
  playerName: string;
  position: number;
  paid: boolean;
  previousDebts: number;
};

export type DayView = {
  id: string;
  label: string;
  status: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  entries: EntryView[];
};

export type HistoryDay = {
  id: string;
  label: string;
  closedAt: string;
  total: number;
};

export type DebtItem = {
  id: string;
  yearMonth: string;
  label: string;
};

export type RosterPlayer = {
  id: string;
  name: string;
  playerKey: string;
  monthPaid: boolean;
  owedMonths: number;
  present: boolean;
};

export type DebtorGroup = {
  playerKey: string;
  playerName: string;
  debts: DebtItem[];
};

export type SettledDebt = {
  id: string;
  playerName: string;
  label: string;
  settledAt: string;
};

export type MonthLedgerPlayer = {
  playerKey: string;
  name: string;
  active: boolean;
  paid: boolean;
  recorded: boolean;
};

export type MonthLedger = {
  yearMonth: string;
  label: string;
  current: boolean;
  paidCount: number;
  openCount: number;
  total: number;
  players: MonthLedgerPlayer[];
};
