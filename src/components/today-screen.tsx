"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { addArrival, beginNewDay, checkIn, type ActionState } from "@/lib/actions";
import { playerKey } from "@/lib/names";
import type { DayView, RosterPlayer } from "@/lib/types";
import { DayList } from "@/components/day-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function TodayScreen({
  day,
  roster,
  monthName,
}: {
  day: DayView;
  roster: RosterPlayer[];
  monthName: string;
}) {
  const entries = day.entries;
  const unpaid = entries.filter((entry) => !entry.paid);
  const onField = Math.min(10, entries.length);
  const waiting = Math.max(0, entries.length - 10);

  return (
    <div className="grid gap-4">
      <header>
        <p className="text-xs font-medium tracking-[0.16em] text-pitch-ink/70 uppercase">Lista de hoje</p>
        <h1 className="mt-1 font-heading text-4xl leading-none tracking-wide text-pitch-ink uppercase">
          {day.label}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-pitch-ink/75">
          Quem chega entra no fim da fila, a partir do elenco. Os 10 primeiros jogam a primeira partida. O cheque é a
          mensalidade de {monthName.toLowerCase()}, não este jogo.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Na lista" value={entries.length} />
        <Stat label="Em campo" value={onField} />
        <Stat label="Na fila" value={waiting} />
        <Stat label="Sem o mês" value={unpaid.length} alert={unpaid.length > 0} />
      </dl>

      <ArrivalPicker roster={roster} />

      <div className="sheet overflow-hidden">
        <DayList entries={entries} status="open" monthName={monthName} />
      </div>

      <NewDayButton label={day.label} empty={entries.length === 0} />
      <p className="text-center text-xs text-pitch-ink/60">
        Fechar o dia guarda a ordem de chegada. O pagamento de {monthName.toLowerCase()} continua no elenco.
      </p>
    </div>
  );
}

function ArrivalPicker({ roster }: { roster: RosterPlayer[] }) {
  const [query, setQuery] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addArrival, null);
  const needle = playerKey(query);
  const available = useMemo(
    () => roster.filter((player) => !player.present && (!needle || player.playerKey.includes(needle))),
    [needle, roster],
  );
  const exact = needle.length > 0 && roster.some((player) => player.playerKey === needle);

  return (
    <div className="sheet grid gap-3 p-3">
      <label className="grid gap-1">
        <span className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Quem chegou</span>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar no elenco"
          autoComplete="off"
          autoCapitalize="words"
          aria-label="Buscar no elenco"
          className="h-12 bg-background px-3 text-base"
        />
      </label>

      {available.length > 0 ? (
        <ul className="grid gap-2">
          {available.map((player) => (
            <li key={player.id}>
              <form action={checkIn.bind(null, player.id)}>
                <Button type="submit" variant="outline" className="h-12 w-full justify-between px-3 text-base">
                  <span className="truncate">{player.name}</span>
                  <span className="shrink-0 text-sm font-medium">Chegou</span>
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">
          {roster.length === 0
            ? "O elenco ainda está vazio. Cadastra o primeiro nome aqui embaixo."
            : "Todo mundo desse filtro já está na lista de hoje."}
        </p>
      )}

      {needle.length >= 2 && !exact ? (
        <form action={formAction} className="grid gap-2">
          <input type="hidden" name="name" value={query.trim()} />
          <Button type="submit" disabled={pending} className="h-12 text-base">
            {pending ? "Cadastrando..." : `Cadastrar ${query.trim()} e anotar`}
          </Button>
        </form>
      ) : null}

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state?.warning ? (
        <p role="status" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.warning}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
      <dt className="text-[11px] tracking-wide text-pitch-ink/65 uppercase">{label}</dt>
      <dd className={alert ? "font-heading text-3xl text-bib" : "font-heading text-3xl text-pitch-ink"}>{value}</dd>
    </div>
  );
}

function NewDayButton({ label, empty }: { label: string; empty: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-12 border-white/20 bg-white/10 text-base text-pitch-ink hover:bg-white/20 hover:text-pitch-ink"
        disabled={empty}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Começar novo dia
      </Button>
      {empty ? (
        <p className="-mt-2 text-center text-xs text-pitch-ink/60">
          A lista de hoje ainda está vazia.
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase">Fechar este dia?</DialogTitle>
            <DialogDescription>
              {label} vai para o histórico e uma lista nova começa vazia. A mensalidade do mês não muda.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await beginNewDay();
                  if (result?.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                });
              }}
            >
              {pending ? "Fechando..." : "Começar outro dia"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
