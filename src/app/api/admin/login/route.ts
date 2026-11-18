import { NextResponse } from "next/server";
import { z } from "zod";
import { api, fail } from "@/lib/errors";
import { boundedJson } from "@/lib/uploads";
import {
  checkOrigin,
  throttle,
  checkPassword,
  signSession,
  SESSION_COOKIE,
} from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    throttle(request, "login", 5);
    const { password } = z
      .object({ password: z.string().min(1).max(256) })
      .parse(await boundedJson(request));
    if (!(await checkPassword(password)))
      fail(401, "INVALID_CREDENTIALS", "Kata sandi tidak sesuai.");
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, await signSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge:
        Math.min(
          24,
          Math.max(1, Number(process.env.ADMIN_SESSION_HOURS) || 8),
        ) * 3600,
    });
    return response;
  });
}
