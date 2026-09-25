"use client";

import { useEffect, useActionState, useOptimistic, useState, useTransition } from "react";
import { addArrival, beginNewDay, setPaid, type ActionState } from "@/lib/actions";
import type { DayView, EntryView } from "@/lib/types";
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

export function TodayScreen({ day }: { day: DayView }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addArrival, null);
  const [entries, setOptimistic] = useOptimistic(
    day.entries,
    (current: EntryView[], update: { id: string; paid: boolean }) =>
      current.map((entry) => (entry.id === update.id ? { ...entry, paid: update.paid } : entry)),
  );
  const [, startToggle] = useTransition();
  const unpaid = entries.filter((entry) => !entry.paid);
  const onField = Math.min(10, entries.length);
  const waiting = Math.max(0, entries.length - 10);

  function onToggle(id: string, paid: boolean) {
    startToggle(async () => {
      setOptimistic({ id, paid });
      await setPaid(id, paid);
    });
  }

  useEffect(() => {
    if (!state?.ok) return;
    const input = document.getElementById("player-name");
    if (input instanceof HTMLInputElement) {
      input.form?.reset();
      input.focus();
    }
    document.getElementById("arrival-end")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state]);

  return (
    <div className="grid gap-4">
      <header>
        <p className="text-xs font-medium tracking-[0.16em] text-pitch-ink/70 uppercase">Lista de hoje</p>
        <h1 className="mt-1 font-heading text-4xl leading-none tracking-wide text-pitch-ink uppercase">
          {day.label}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-pitch-ink/75">
          Quem chega entra no fim da lista. Os 10 primeiros jogam a primeira partida. Os times, vocês escolhem.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Na lista" value={entries.length} />
        <Stat label="Em campo" value={onField} />
        <Stat label="Na fila" value={waiting} />
        <Stat label="Sem pagar" value={unpaid.length} alert={unpaid.length > 0} />
      </dl>

      <form action={formAction} className="sheet grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="grid gap-1">
          <span className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Quem chegou
          </span>
          <Input
            id="player-name"
            name="name"
            placeholder="Nome do jogador"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            required
            className="h-12 bg-background px-3 text-base"
          />
        </label>
        <Button type="submit" disabled={pending} className="h-12 px-5 text-base sm:self-end">
          {pending ? "Anotando..." : "Chegou"}
        </Button>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {state.error}
          </p>
        ) : null}
        {state?.warning ? (
          <p role="status" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
            {state.warning}
          </p>
        ) : null}
      </form>

      <div className="sheet overflow-hidden">
        <DayList entries={entries} status="open" onToggle={onToggle} />
      </div>

      <NewDayButton label={day.label} unpaidNames={unpaid.map((entry) => entry.playerName)} empty={entries.length === 0} />
      <p className="text-center text-xs text-pitch-ink/60">
        Quem ficar sem pagar entra na lista de devedores quando este dia fechar.
        {unpaid.length === 1
          ? " Tem 1 pessoa sem pagar nesta lista."
          : unpaid.length > 1
            ? ` Tem ${unpaid.length} pessoas sem pagar nesta lista.`
            : ""}
      </p>
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

function NewDayButton({
  label,
  unpaidNames,
  empty,
}: {
  label: string;
  unpaidNames: string[];
  empty: boolean;
}) {
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
              {label} vai para o histórico e uma lista nova começa vazia.
            </DialogDescription>
          </DialogHeader>
          {unpaidNames.length > 0 ? (
            <div className="rounded-xl bg-destructive/10 px-3 py-3 text-sm">
              <p className="font-medium text-destructive">Ficam devedores</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-foreground">
                {unpaidNames.map((name, index) => (
                  <li key={`${name}-${index}`}>{name}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todo mundo desta lista pagou.</p>
          )}
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
