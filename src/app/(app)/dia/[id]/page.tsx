import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDay } from "@/lib/data";
import { InteractiveDayList } from "@/components/day-list";

export const metadata: Metadata = {
  title: "Lista encerrada",
};

export default async function ClosedDayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const day = await getDay(id);
  if (!day) notFound();
  if (day.status === "open") redirect("/");

  return (
    <div className="grid gap-4">
      <header>
        <Link href="/historico" className="text-xs font-medium tracking-[0.16em] text-pitch-ink/70 uppercase">
          Histórico
        </Link>
        <h1 className="mt-1 font-heading text-4xl leading-none tracking-wide text-pitch-ink uppercase">
          {day.label}
        </h1>
        <p className="mt-3 text-sm leading-6 text-pitch-ink/75">
          Ordem de chegada deste dia. O pagamento mora no elenco, por mês.
        </p>
      </header>
      <div className="sheet overflow-hidden">
        <InteractiveDayList day={day} />
      </div>
    </div>
  );
}
