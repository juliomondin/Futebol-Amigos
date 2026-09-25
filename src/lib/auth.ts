import "server-only";

import { compareSync, hashSync } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { dbGet, dbRun } from "@/lib/db";
import {
  SESSION_COOKIE,
  decrypt,
  encrypt,
  sessionCookieOptions,
  type SessionPayload,
} from "@/lib/session";

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
};

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return decrypt(token);
});

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
});

export async function setSession(user: { id: string; username: string }) {
  const token = await encrypt({ userId: user.id, username: user.username });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSession() {
  (await cookies()).set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

export function findUserByUsername(username: string) {
  return dbGet<UserRow>(
    "SELECT id, username, password_hash FROM users WHERE lower(username) = lower(?)",
    username,
  );
}

export function checkPassword(password: string, hash: string) {
  return compareSync(password, hash);
}

export async function updatePassword(userId: string, password: string) {
  await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", hashSync(password, 10), userId);
}

export async function getLoginHint() {
  const user = await dbGet<UserRow>("SELECT id, username, password_hash FROM users LIMIT 1");

  if (!user) return null;

  const username = process.env.ADMIN_USER ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "futebol123";

  if (user.username !== username || !compareSync(password, user.password_hash)) {
    return null;
  }

  return { username, password };
}
