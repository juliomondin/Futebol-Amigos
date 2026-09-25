import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { listHistory } from "@/lib/data";

export const metadata: Metadata = {
  title: "Histórico",
};

export default async function HistoryPage() {
  const days = await listHistory();

  return (
    <div className="grid gap-4">
      <header>
        <p className="text-xs font-medium tracking-[0.16em] text-pitch-ink/70 uppercase">Arquivo</p>
        <h1 className="mt-1 font-heading text-4xl leading-none tracking-wide text-pitch-ink uppercase">
          Histórico
        </h1>
        <p className="mt-3 text-sm leading-6 text-pitch-ink/75">
          Cada dia fechado fica aqui, com quem pagou e quem ficou devendo.
        </p>
      </header>

      {days.length === 0 ? (
        <div className="sheet px-6 py-12 text-center">
          <p className="font-heading text-3xl tracking-wide uppercase">Nenhum dia encerrado</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            A lista de hoje vai para cá quando você começar um novo dia.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {days.map((day) => {
            const unpaid = day.total - day.paid;
            return (
              <li key={day.id}>
                <Link href={`/dia/${day.id}`} className="sheet block p-4 transition hover:ring-2 hover:ring-bib">
                  <h2 className="font-heading text-2xl tracking-wide uppercase">{day.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {day.total} {day.total === 1 ? "jogador" : "jogadores"}
                    {" · "}
                    {unpaid === 0 ? "todo mundo pagou" : `${day.paid} pagaram · ${unpaid} sem pagar`}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Fechado em {formatDateTime(day.closedAt)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
