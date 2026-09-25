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
  paid: number;
};

export type DebtItem = {
  id: string;
  entryId: string;
  dayId: string;
  dayLabel: string;
  createdAt: string;
};

export type DebtorGroup = {
  playerKey: string;
  playerName: string;
  debts: DebtItem[];
};

export type SettledDebt = {
  id: string;
  playerName: string;
  dayLabel: string;
  settledAt: string;
};
