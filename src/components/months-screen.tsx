"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { setLedgerPaid } from "@/lib/actions";
import { playerKey } from "@/lib/names";
import type { MonthLedger } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MonthsScreen({ months }: { months: MonthLedger[] }) {
  const [query, setQuery] = useState("");
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(months.map((month) => [month.yearMonth, month.current])),
  );
  const needle = playerKey(query);
  const visible = useMemo(
    () =>
      months
        .map((month) => {
          const players = month.players.filter((player) => !needle || player.playerKey.includes(needle));
          return {
            ...month,
            players,
            paidCount: players.filter((player) => player.paid).length,
            openCount: players.filter((player) => player.recorded && !player.paid).length,
            total: players.length,
          };
        })
        .filter((month) => month.players.length > 0),
    [months, needle],
  );
  const hasPlayers = months.some((month) => month.players.length > 0);

  return (
    <div className="grid gap-4">
      <header>
        <p className="text-xs font-medium tracking-[0.16em] text-pitch-ink/70 uppercase">Caderno</p>
        <h1 className="mt-1 font-heading text-4xl leading-none tracking-wide text-pitch-ink uppercase">Meses</h1>
        <p className="mt-3 text-sm leading-6 text-pitch-ink/75">
          Cada mês de uso mostra quem pagou. Se alguém deve vários, marca só o mês que entrou. Os outros continuam em
          aberto.
        </p>
      </header>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar nome"
        aria-label="Buscar nos meses"
        className="h-12 bg-card px-3 text-base"
      />

      {!hasPlayers ? (
        <div className="sheet px-6 py-12 text-center">
          <p className="font-heading text-3xl tracking-wide uppercase">Nenhum mês ainda</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Cadastra o elenco. Os meses de uso aparecem aqui, com o pagamento de cada pessoa.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="sheet px-6 py-10 text-center text-sm text-muted-foreground">Ninguém com esse nome.</div>
      ) : (
        <div className="grid gap-3">
          {visible.map((month) => {
            const open = needle ? true : openMonths[month.yearMonth] === true;
            return (
              <section key={month.yearMonth} className="sheet overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={open}
                  onClick={() => {
                    if (needle) return;
                    setOpenMonths((current) => ({
                      ...current,
                      [month.yearMonth]: current[month.yearMonth] !== true,
                    }));
                  }}
                >
                  <span>
                    <span className="block font-heading text-xl tracking-wide text-pitch-ink uppercase">
                      {month.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {month.paidCount} pagaram · {month.openCount} em aberto
                      {month.current ? " · mês atual" : ""}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-5 shrink-0 text-pitch-ink/70", open && "rotate-180")} />
                </button>
                {open ? (
                  <ul className="border-t border-border/80">
                    {month.players.map((player) => (
                      <li
                        key={player.playerKey}
                        className="flex items-center gap-3 border-t border-border/80 px-4 py-3 first:border-t-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold">{player.name}</p>
                          {player.active ? null : (
                            <p className="text-xs text-muted-foreground">Fora do elenco</p>
                          )}
                        </div>
                        <form
                          action={setLedgerPaid.bind(null, player.playerKey, month.yearMonth, !player.paid)}
                          className="shrink-0"
                        >
                          <Button
                            type="submit"
                            variant="outline"
                            aria-pressed={player.paid}
                            aria-label={`${player.name} pagou ${month.label.toLowerCase()}?`}
                            className={
                              player.paid
                                ? "h-12 gap-2 rounded-2xl border-2 border-primary bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
                                : "h-12 gap-2 rounded-2xl border-2 border-pitch bg-white px-3 text-sm text-foreground hover:bg-bib/50"
                            }
                          >
                            <span
                              aria-hidden
                              className={
                                player.paid
                                  ? "grid size-6 place-items-center rounded-md border-2 border-primary-foreground bg-primary-foreground text-primary"
                                  : "grid size-6 place-items-center rounded-md border-2 border-pitch bg-white"
                              }
                            >
                              {player.paid ? <Check className="size-4" strokeWidth={3} /> : null}
                            </span>
                            {player.paid ? "Pagou" : player.recorded ? "Aberto" : "Sem registro"}
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
