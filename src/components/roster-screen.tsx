"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { Check } from "lucide-react";
import { removeFromRoster, savePlayer, setRosterPaid, type ActionState } from "@/lib/actions";
import { monthsLabel, playerKey } from "@/lib/names";
import type { RosterPlayer } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RosterScreen({
  players,
  monthName,
}: {
  players: RosterPlayer[];
  monthName: string;
}) {
  const [query, setQuery] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(savePlayer, null);
  const needle = playerKey(query);
  const visible = useMemo(
    () => players.filter((player) => !needle || player.playerKey.includes(needle)),
    [needle, players],
  );
  const exact = needle.length > 0 && players.some((player) => player.playerKey === needle);
  const paidCount = players.filter((player) => player.monthPaid).length;

  return (
    <div className="grid gap-4">
      <header>
        <p className="text-xs font-medium tracking-[0.16em] text-pitch-ink/70 uppercase">Quem joga</p>
        <h1 className="mt-1 font-heading text-4xl leading-none tracking-wide text-pitch-ink uppercase">Elenco</h1>
        <p className="mt-3 text-sm leading-6 text-pitch-ink/75">
          A lista completa fica aqui. No dia do futebol, a chegada só coloca essa gente em ordem. O cheque é{" "}
          {monthName.toLowerCase()}, o mês inteiro.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
          <dt className="text-[11px] tracking-wide text-pitch-ink/65 uppercase">No elenco</dt>
          <dd className="font-heading text-3xl text-pitch-ink">{players.length}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
          <dt className="text-[11px] tracking-wide text-pitch-ink/65 uppercase">{monthName} pago</dt>
          <dd className="font-heading text-3xl text-pitch-ink">
            {paidCount}/{players.length}
          </dd>
        </div>
      </dl>

      <form action={formAction} className="sheet grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-1">
          <span className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Novo jogador</span>
          <Input
            name="name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome de quem joga"
            autoComplete="off"
            autoCapitalize="words"
            required
            minLength={2}
            className="h-12 bg-background px-3 text-base"
          />
        </label>
        <Button type="submit" disabled={pending || exact} className="h-12 px-5 text-base">
          {pending ? "Salvando..." : "Entrar no elenco"}
        </Button>
        {exact ? <p className="text-sm text-muted-foreground sm:col-span-2">Esse nome já está no elenco.</p> : null}
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {state.error}
          </p>
        ) : null}
      </form>

      {players.length === 0 ? (
        <div className="sheet px-6 py-12 text-center">
          <p className="font-heading text-3xl tracking-wide uppercase">Ninguém cadastrado</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Coloca aqui todo mundo que joga. A lista do dia sai dessa relação.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="sheet px-6 py-10 text-center text-sm text-muted-foreground">Ninguém com esse nome.</div>
      ) : (
        <ul className="sheet overflow-hidden">
          {visible.map((player) => (
            <li key={player.id} className="flex items-center gap-3 border-t border-border/80 px-4 py-3 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{player.name}</p>
                {player.owedMonths > 0 ? (
                  <Badge variant="destructive" className="mt-1 h-auto py-0.5">
                    Deve {monthsLabel(player.owedMonths)}
                  </Badge>
                ) : null}
                <form action={removeFromRoster.bind(null, player.id)} className="mt-2">
                  <Button type="submit" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground">
                    Tirar do elenco
                  </Button>
                </form>
              </div>
              <form action={setRosterPaid.bind(null, player.id, !player.monthPaid)} className="shrink-0">
                <Button
                  type="submit"
                  variant="outline"
                  aria-pressed={player.monthPaid}
                  aria-label={`${player.name} pagou ${monthName.toLowerCase()}?`}
                  className={
                    player.monthPaid
                      ? "h-12 gap-2 rounded-2xl border-2 border-primary bg-primary px-3 text-base text-primary-foreground hover:bg-primary/90"
                      : "h-12 gap-2 rounded-2xl border-2 border-pitch bg-white px-3 text-base text-foreground hover:bg-bib/50"
                  }
                >
                  <span
                    aria-hidden
                    className={
                      player.monthPaid
                        ? "grid size-6 place-items-center rounded-md border-2 border-primary-foreground bg-primary-foreground text-primary"
                        : "grid size-6 place-items-center rounded-md border-2 border-pitch bg-white"
                    }
                  >
                    {player.monthPaid ? <Check className="size-4" strokeWidth={3} /> : null}
                  </span>
                  {monthName}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
