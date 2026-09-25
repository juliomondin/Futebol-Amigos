import { ensureOpenDay } from "@/lib/data";
import { TodayScreen } from "@/components/today-screen";

export default async function HomePage() {
  const day = await ensureOpenDay();
  return <TodayScreen day={day} />;
}
