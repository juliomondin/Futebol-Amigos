import type { Metadata } from "next";
import { getDebtors } from "@/lib/data";
import { DebtorsScreen } from "@/components/debtors-screen";

export const metadata: Metadata = {
  title: "Devedores",
};

export default function DebtorsPage() {
  const { groups, settled } = getDebtors();
  return <DebtorsScreen groups={groups} settled={settled} />;
}
