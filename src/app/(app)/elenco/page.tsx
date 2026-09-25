import type { Metadata } from "next";
import { formatMonthName, saoPauloMonthKey } from "@/lib/dates";
import { listRoster } from "@/lib/data";
import { RosterScreen } from "@/components/roster-screen";

export const metadata: Metadata = {
  title: "Elenco",
};

export default async function RosterPage() {
  const players = await listRoster();
  return <RosterScreen players={players} monthName={formatMonthName(saoPauloMonthKey())} />;
}
