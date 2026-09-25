import { ensureOpenDay } from "@/lib/data";
import { TodayScreen } from "@/components/today-screen";

export default function HomePage() {
  const day = ensureOpenDay();
  return <TodayScreen day={day} />;
}
