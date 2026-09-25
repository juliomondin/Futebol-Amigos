import { formatMonthName, saoPauloMonthKey } from "@/lib/dates";
import { ensureOpenDay, listRoster } from "@/lib/data";
import { TodayScreen } from "@/components/today-screen";

export default async function HomePage() {
  const day = await ensureOpenDay();
  const roster = await listRoster();
  return <TodayScreen day={day} roster={roster} monthName={formatMonthName(saoPauloMonthKey())} />;
}
