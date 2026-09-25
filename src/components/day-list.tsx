"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { correctName, deleteArrival, moveArrival, setPaid } from "@/lib/actions";
import { listsLabel } from "@/lib/names";
import type { DayView, EntryView } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InteractiveDayList({ day }: { day: DayView }) {
  return <DayList entries={day.entries} status={day.status} />;
}

export function DayList({
  entries,
  status,
}: {
  entries: EntryView[];
  status: "open" | "closed";
}) {
  const [target, setTarget] = useState<EntryView | null>(null);
  const [rename, setRename] = useState<EntryView | null>(null);
  const starters = entries.filter((entry) => entry.position <= 10);
  const queue = entries.filter((entry) => entry.position > 10);
  const missing = Math.max(0, 10 - entries.length);

  if (entries.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="font-heading text-3xl tracking-wide uppercase">Ninguém chegou</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Anota o nome na ordem de chegada. Os 10 primeiros fecham a primeira partida.
        </p>
      </div>
    );
  }

  return (
    <div>
      <section>
        <SectionHeader
          title="Primeira partida"
          detail={
            missing > 0
              ? `Faltam ${missing} para fechar os dois times de 5.`
              : "Os 10 primeiros estão dentro. Os times ficam com vocês."
          }
          meta={`${starters.length}/10`}
        />
        <ol>
          {starters.map((entry) => (
            <PlayerRow
              key={entry.id}
              entry={entry}
              status={status}
              last={entry.position === entries.length}
              onDelete={setTarget}
              onRename={setRename}
            />
          ))}
        </ol>
      </section>
      <section className="border-t border-dashed border-border">
        <SectionHeader
          title="Fila"
          detail={
            queue.length > 0
              ? "Entram quando abrir a próxima partida."
              : "A fila começa no 11º nome."
          }
          meta={queue.length > 0 ? String(queue.length) : "0"}
        />
        {queue.length > 0 ? (
          <ol>
            {queue.map((entry) => (
              <PlayerRow
                key={entry.id}
                entry={entry}
                status={status}
                last={entry.position === entries.length}
                onDelete={setTarget}
                onRename={setRename}
              />
            ))}
          </ol>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Ninguém esperando ainda.</p>
        )}
      </section>
      <div id="arrival-end" />
      <DeleteDialog entry={target} onClose={() => setTarget(null)} />
      <RenameDialog entry={rename} onClose={() => setRename(null)} />
    </div>
  );
}

function SectionHeader({ title, detail, meta }: { title: string; detail: string; meta: string }) {
  return (
    <div className="flex items-end justify-between gap-3 px-4 pt-4 pb-2">
      <div>
        <h2 className="font-heading text-lg tracking-wide uppercase">{title}</h2>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      <span className="rounded-full bg-bib px-2.5 py-1 font-heading text-sm text-pitch">{meta}</span>
    </div>
  );
}

function PlayerRow({
  entry,
  status,
  last,
  onDelete,
  onRename,
}: {
  entry: EntryView;
  status: "open" | "closed";
  last: boolean;
  onDelete: (entry: EntryView) => void;
  onRename: (entry: EntryView) => void;
}) {
  const playing = entry.position <= 10;

  return (
    <li className="flex items-start gap-3 border-t border-border/80 px-4 py-3">
      <span
        className={
          playing
            ? "grid size-11 shrink-0 place-items-center rounded-xl bg-bib font-heading text-xl text-pitch"
            : "grid size-11 shrink-0 place-items-center rounded-xl bg-muted font-heading text-xl text-muted-foreground"
        }
      >
        {String(entry.position).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold" title={entry.playerName}>
          {entry.playerName}
        </p>
        {entry.previousDebts > 0 ? (
          <Badge variant="destructive" className="mt-1 h-auto py-0.5">
            Deve {listsLabel(entry.previousDebts)}
          </Badge>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Corrigir nome de ${entry.playerName}`}
            onClick={() => onRename(entry)}
          >
            <Pencil />
          </Button>
          {status === "open" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Subir ${entry.playerName}`}
                disabled={entry.position === 1}
                onClick={() => moveArrival(entry.id, "up")}
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Descer ${entry.playerName}`}
                disabled={last}
                onClick={() => moveArrival(entry.id, "down")}
              >
                <ChevronDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Tirar ${entry.playerName} da lista`}
                onClick={() => onDelete(entry)}
              >
                <Trash2 />
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <form action={setPaid.bind(null, entry.id, !entry.paid)} className="shrink-0">
        <Button
          type="submit"
          variant="outline"
          aria-pressed={entry.paid}
          aria-label={`${entry.playerName} pagou?`}
          className={
            entry.paid
              ? "h-12 gap-2 rounded-2xl border-2 border-primary bg-primary px-3 text-base text-primary-foreground hover:bg-primary/90"
              : "h-12 gap-2 rounded-2xl border-2 border-pitch bg-white px-3 text-base text-foreground hover:bg-bib/50"
          }
        >
          <span
            aria-hidden
            className={
              entry.paid
                ? "grid size-6 place-items-center rounded-md border-2 border-primary-foreground bg-primary-foreground text-primary"
                : "grid size-6 place-items-center rounded-md border-2 border-pitch bg-white"
            }
          >
            {entry.paid ? <Check className="size-4" strokeWidth={3} /> : null}
          </span>
          Pagou?
        </Button>
      </form>
    </li>
  );
}

function DeleteDialog({ entry, onClose }: { entry: EntryView | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl uppercase">Tirar da lista?</DialogTitle>
          <DialogDescription>
            {entry
              ? `${entry.playerName} sai da ordem de chegada e os próximos sobem uma posição.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !entry}
            onClick={() => {
              if (!entry) return;
              startTransition(async () => {
                await deleteArrival(entry.id);
                onClose();
              });
            }}
          >
            {pending ? "Tirando..." : "Tirar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ entry, onClose }: { entry: EntryView | null; onClose: () => void }) {
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {entry ? <RenameForm key={entry.id} entry={entry} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ entry, onClose }: { entry: EntryView; onClose: () => void }) {
  const [name, setName] = useState(entry.playerName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await correctName(entry.id, name);
          if (result?.error) {
            setError(result.error);
            return;
          }
          onClose();
        });
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-heading text-xl uppercase">Corrigir nome</DialogTitle>
        <DialogDescription>A posição na chegada continua a mesma.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="rename-player">Nome</Label>
        <Input
          id="rename-player"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          autoComplete="off"
          autoCapitalize="words"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
