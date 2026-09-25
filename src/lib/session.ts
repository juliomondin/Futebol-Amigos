import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";

export type SessionPayload = {
  userId: string;
  username: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET ?? "futebol-amigos-local-secret-key-32b";
  return new TextEncoder().encode(secret);
}

export function sessionCookieOptions(maxAge = 60 * 60 * 24 * 14) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());
}

export async function decrypt(token: string | undefined | null) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });

    if (typeof payload.userId !== "string" || typeof payload.username !== "string") {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
    } satisfies SessionPayload;
  } catch {
    return null;
  }
}
