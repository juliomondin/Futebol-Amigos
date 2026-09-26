export const TIME_ZONE = "America/Sao_Paulo";

export function formatDayLabel(date = new Date()) {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function saoPauloDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function saoPauloMonthKey(date = new Date()) {
  return saoPauloDateKey(date).slice(0, 7);
}

export function formatMonthName(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function shiftMonth(yearMonth: string, delta: number) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 15));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

export function eachMonth(start: string, end: string) {
  const months: string[] = [];
  let cursor = start;
  while (cursor <= end && months.length < 240) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}

export function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}
