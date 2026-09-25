"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  checkPassword,
  clearSession,
  findUserByUsername,
  setSession,
  updatePassword,
  verifySession,
} from "@/lib/auth";
import {
  AppError,
  addPlayer,
  ensureOpenDay,
  entryDayId,
  movePlayer,
  removePlayer,
  renamePlayer,
  setPlayerPaid,
  settleDebt,
  settlePlayerDebts,
  startNewDay,
} from "@/lib/data";

export type ActionState = {
  error?: string;
  warning?: string;
  ok?: boolean;
} | null;

const nameSchema = z
  .string()
  .trim()
  .min(2, "O nome precisa de pelo menos 2 letras.")
  .max(40, "Esse nome está longo demais.")
  .regex(/\p{L}/u, "Escreve o nome de quem chegou.");

function rethrowNext(error: unknown): void {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_")
  ) {
    throw error;
  }
}

function failure(error: unknown): ActionState {
  rethrowNext(error);
  if (error instanceof AppError) return { error: error.message };
  console.error(error);
  return { error: "Não deu para salvar agora." };
}

function refresh(dayId?: string) {
  revalidatePath("/");
  revalidatePath("/devedores");
  revalidatePath("/historico");
  if (dayId) revalidatePath(`/dia/${dayId}`);
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Informa usuário e senha." };
  }

  const user = await findUserByUsername(username);
  if (!user || !checkPassword(password, user.password_hash)) {
    return { error: "Usuário ou senha não conferem." };
  }

  await setSession({ id: user.id, username: user.username });
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await verifySession();
    const current = String(formData.get("current") ?? "");
    const next = String(formData.get("next") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    const user = await findUserByUsername(session.username);

    if (!user || !checkPassword(current, user.password_hash)) {
      return { error: "A senha atual não confere." };
    }

    if (next.length < 6) {
      return { error: "A nova senha precisa de pelo menos 6 caracteres." };
    }

    if (next !== confirm) {
      return { error: "A confirmação está diferente da nova senha." };
    }

    if (next === current) {
      return { error: "Escolhe uma senha diferente da atual." };
    }

    await updatePassword(user.id, next);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function addArrival(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await verifySession();
    const parsed = nameSchema.safeParse(formData.get("name"));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };
    }

    const day = await ensureOpenDay();
    const result = await addPlayer(day.id, parsed.data);
    refresh(day.id);

    if (result.debtCount > 0) {
      const lists = result.debtCount === 1 ? "outra lista" : `${result.debtCount} listas`;
      return {
        ok: true,
        warning: `${result.name} deve ${lists}. Vale cobrar antes de entrar.`,
      };
    }

    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setPaid(entryId: string, paid: boolean, formData?: FormData) {
  void formData;
  try {
    await verifySession();
    await setPlayerPaid(entryId, paid);
    refresh(await entryDayId(entryId));
  } catch (error) {
    rethrowNext(error);
    console.error(error);
  }
}

export async function moveArrival(entryId: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await verifySession();
    await movePlayer(entryId, direction);
    refresh(await entryDayId(entryId));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteArrival(entryId: string): Promise<ActionState> {
  try {
    await verifySession();
    const dayId = await entryDayId(entryId);
    await removePlayer(entryId);
    refresh(dayId);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function correctName(entryId: string, name: string): Promise<ActionState> {
  try {
    await verifySession();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };
    }

    await renamePlayer(entryId, parsed.data);
    refresh(await entryDayId(entryId));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function beginNewDay(): Promise<ActionState> {
  try {
    await verifySession();
    const day = await ensureOpenDay();
    await startNewDay();
    refresh(day.id);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function markDebtPaid(debtId: string): Promise<ActionState> {
  try {
    await verifySession();
    await settleDebt(debtId);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function markPlayerPaid(key: string): Promise<ActionState> {
  try {
    await verifySession();
    await settlePlayerDebts(key);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

