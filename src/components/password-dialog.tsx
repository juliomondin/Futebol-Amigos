"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { changePassword, type ActionState } from "@/lib/actions";
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

export function PasswordDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-9 text-pitch-ink hover:bg-white/10 hover:text-pitch-ink"
        onClick={() => setOpen(true)}
      >
        <KeyRound />
        Senha
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {open ? <PasswordForm onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(changePassword, null);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [onDone, state]);

  return (
    <form action={action} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl uppercase">Trocar senha</DialogTitle>
        <DialogDescription>
          Só o administrador entra neste app. Guarda a senha nova com quem organiza o futebol.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="current-password">Senha atual</Label>
        <Input id="current-password" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="next-password">Nova senha</Label>
        <Input id="next-password" name="next" type="password" autoComplete="new-password" minLength={6} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Confirmar nova senha</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar senha"}
        </Button>
      </div>
    </form>
  );
}
