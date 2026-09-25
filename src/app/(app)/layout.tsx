import { verifySession } from "@/lib/auth";
import { countDebtorPeople } from "@/lib/data";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  const debtCount = await countDebtorPeople();

  return (
    <AppShell username={session.username} debtCount={debtCount}>
      {children}
    </AppShell>
  );
}
