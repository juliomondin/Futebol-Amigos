import type { Metadata } from "next";
import { listMonthLedger } from "@/lib/data";
import { MonthsScreen } from "@/components/months-screen";

export const metadata: Metadata = {
  title: "Meses",
};

export default async function MonthsPage() {
  const months = await listMonthLedger();
  return <MonthsScreen months={months} />;
}
