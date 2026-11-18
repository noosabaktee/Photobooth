import { SignJWT, jwtVerify } from "jose";
import argon2 from "argon2";
import { cookies } from "next/headers";
import { fail } from "./errors";
export const SESSION_COOKIE = "snapstrip_admin";
function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || Buffer.byteLength(value) < 32)
    fail(
      503,
      "AUTH_NOT_CONFIGURED",
      "Operator perlu mengatur hash password dan session secret minimal 32 byte.",
    );
  return new TextEncoder().encode(value);
}
export async function signSession(
  seconds = Math.min(
    24,
    Math.max(1, Number(process.env.ADMIN_SESSION_HOURS) || 8),
  ) * 3600,
) {
  return new SignJWT({ sub: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("snapstrip")
    .setAudience("admin")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
    .sign(secret());
}
export async function verifySession(token?: string) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "snapstrip",
      audience: "admin",
    });
    return payload.sub === "admin";
  } catch {
    return false;
  }
}
export async function isAdmin() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
export async function requireAdmin() {
  if (!(await isAdmin()))
    fail(401, "UNAUTHORIZED", "Silakan login sebagai admin.");
}
export async function checkPassword(password: string) {
  secret();
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash?.startsWith("$argon2id$"))
    fail(
      503,
      "AUTH_NOT_CONFIGURED",
      "Password admin belum dikonfigurasi. Jalankan npm run admin:hash.",
    );
  return argon2.verify(hash, password);
}
export function checkOrigin(request: Request) {
  const expected = new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ).origin;
  if (
    request.headers.get("origin") !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    fail(403, "FORBIDDEN_ORIGIN", "Origin permintaan tidak diizinkan.");
}
const limits = new Map<string, { count: number; until: number }>();
export function throttle(request: Request, bucket: string, max = 20) {
  // Trusted reverse proxy must replace (not append arbitrary client) X-Forwarded-For.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  if (limits.size > 10000 && !limits.has(key))
    fail(429, "RATE_LIMITED", "Server sedang sibuk. Coba satu menit lagi.");
  const entry = limits.get(key) || { count: 0, until: now + 60000 };
  if (++entry.count > max)
    fail(429, "RATE_LIMITED", "Terlalu banyak permintaan. Tunggu satu menit.");
  limits.set(key, entry);
}
