"use client";

import { useMemo, useState, useTransition } from "react";
import { markDebtPaid, markPlayerPaid } from "@/lib/actions";
import { formatDateTime } from "@/lib/dates";
import { monthsLabel, playerKey } from "@/lib/names";
import type { DebtorGroup, SettledDebt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DebtorsScreen({
  groups,
  settled,
}: {
  groups: DebtorGroup[];
  settled: SettledDebt[];
}) {
  const [query, setQuery] = useState("");
  const needle = playerKey(query);

  const filtered = useMemo(
    () => groups.filter((group) => !needle || group.playerKey.includes(needle)),
    [groups, needle],
  );

  const settledFiltered = useMemo(
    () => settled.filter((debt) => !needle || playerKey(debt.playerName).includes(needle)),
    [needle, settled],
  );

  return (
    <div className="grid gap-4">
      <header>
        <p className="text-xs font-medium tracking-[0.16em] text-pitch-ink/70 uppercase">Caderno</p>
        <h1 className="mt-1 font-heading text-4xl leading-none tracking-wide text-pitch-ink uppercase">
          Devedores
        </h1>
        <p className="mt-3 text-sm leading-6 text-pitch-ink/75">
          A dívida é do mês, não do jogo. Quitar marca a mensalidade como paga.
        </p>
      </header>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar nome"
        aria-label="Buscar devedor"
        className="h-12 bg-card px-3 text-base"
      />

      {groups.length === 0 ? (
        <div className="sheet px-6 py-12 text-center">
          <p className="font-heading text-3xl tracking-wide uppercase">Ninguém deve</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Quem não pagou a mensalidade aparece aqui, com o mês em aberto.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sheet px-6 py-10 text-center text-sm text-muted-foreground">
          Ninguém com esse nome na lista de devedores.
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((group) => (
            <li key={group.playerKey} className="sheet p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{group.playerName}</h2>
                  <p className="text-sm text-destructive">Deve {monthsLabel(group.debts.length)}</p>
                </div>
                {group.debts.length > 1 ? <SettleAll playerKey={group.playerKey} /> : null}
              </div>
              <ul className="mt-3 grid gap-2">
                {group.debts.map((debt) => (
                  <li key={debt.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{debt.label}</p>
                    </div>
                    <SettleOne debtId={debt.id} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {settledFiltered.length > 0 ? (
        <section>
          <h2 className="font-heading text-lg tracking-wide text-pitch-ink uppercase">Quitadas recentemente</h2>
          <ul className="mt-2 grid gap-2">
            {settledFiltered.map((debt) => (
              <li key={debt.id} className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-pitch-ink/80">
                <span className="font-medium text-pitch-ink">{debt.playerName}</span>
                <span> · {debt.label}</span>
                <span className="block text-xs text-pitch-ink/60">{formatDateTime(debt.settledAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SettleOne({ debtId }: { debtId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await markDebtPaid(debtId);
        });
      }}
    >
      {pending ? "..." : "Quitar"}
    </Button>
  );
}

function SettleAll({ playerKey: key }: { playerKey: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await markPlayerPaid(key);
        });
      }}
    >
      {pending ? "Quitando..." : "Quitar todas"}
    </Button>
  );
}
