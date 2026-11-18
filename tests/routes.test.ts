import { beforeAll, beforeEach, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import argon2 from "argon2";
import sharp from "sharp";
import { encodeBoomerang } from "@/lib/video-server";
import { POST as boomerang } from "@/app/api/boomerang/route";
let movie: Buffer;
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => (jar.has(key) ? { value: jar.get(key) } : undefined),
  }),
}));
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { GET as session } from "@/app/api/admin/session/route";
import { POST as create, GET as adminList } from "@/app/api/admin/frames/route";
import {
  PATCH,
  DELETE,
  GET as adminDetail,
} from "@/app/api/admin/frames/[id]/route";
import { GET as publicDetail } from "@/app/api/frames/[id]/route";
import { POST as photo } from "@/app/api/photos/route";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
beforeAll(async () => {
  process.env.STORAGE_MODE = "mock";
  process.env.ADMIN_SESSION_SECRET =
    "route-test-secret-only-12345678901234567890123456789";
  process.env.ADMIN_PASSWORD_HASH = await argon2.hash("six123");
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  const frames = await Promise.all(
    ["#d02030", "#20b050", "#3040df"].map((background) =>
      sharp({ create: { width: 1080, height: 1920, channels: 3, background } })
        .jpeg()
        .toBuffer(),
    ),
  );
  movie = await encodeBoomerang(frames);
}, 60000);
beforeEach(() => jar.clear());
const json = (path: string, body: unknown, origin = "http://localhost:3000") =>
  new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("protects every admin read/mutation and never returns drafts publicly", async () => {
  const context = {
    params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
  };
  expect((await adminList()).status).toBe(401);
  expect(
    (await adminDetail(new Request("http://localhost"), context)).status,
  ).toBe(401);
  expect((await PATCH(json("/", {}), context)).status).toBe(401);
  expect((await DELETE(json("/", {}), context)).status).toBe(401);
  expect((await create(json("/", {}))).status).toBe(401);
  jar.set(SESSION_COOKIE, await signSession());
  expect((await create(json("/", {}, "https://evil.test"))).status).toBe(403);
  const form = new FormData();
  form.set(
    "metadata",
    JSON.stringify({
      name: "Private draft",
      category: "pastel",
      tags: [],
      dimensions: { width: 1200, height: 2826 },
      slots: [],
    }),
  );
  form.set(
    "overlay",
    new Blob(
      [
        new Uint8Array(
          await readFile("examples/starter-frames/pink-gingham-3.png"),
        ),
      ],
      { type: "image/png" },
    ),
    "frame.png",
  );
  const saved = await create(
    new Request("http://localhost:3000/api/admin/frames", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: form,
    }),
  );
  expect(saved.status).toBe(201);
  const { frame } = await saved.json();
  expect(
    (
      await publicDetail(new Request("http://localhost"), {
        params: Promise.resolve({ id: frame.id }),
      })
    ).status,
  ).toBe(404);
});
it("login uses HttpOnly signed cookie; logout expires it; old stolen tokens remain valid until expiry by design", async () => {
  expect((await session()).status).toBe(200);
  expect(await (await session()).json()).toEqual({ authenticated: false });
  expect((await login(json("/", { password: "wrong" }))).status).toBe(401);
  const response = await login(json("/", { password: "six123" }));
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=strict/i);
  expect(await response.json()).toEqual({ ok: true });
  jar.set(SESSION_COOKIE, cookie.split(";")[0].split("=")[1]);
  expect(await (await session()).json()).toEqual({ authenticated: true });
  const out = await logout(json("/", {}));
  expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  jar.clear();
  expect((await adminList()).status).toBe(401);
});
it("photo endpoint requires origin, consent, real MIME and one final image", async () => {
  const form = () => {
    const f = new FormData();
    f.set(
      "photo",
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
      "x.png",
    );
    return f;
  };
  expect(
    (
      await photo(
        new Request("http://localhost:3000/api/photos", {
          method: "POST",
          body: form(),
        }),
      )
    ).status,
  ).toBe(403);
  const missing = await photo(
    new Request("http://localhost:3000/api/photos", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: form(),
    }),
  );
  expect(missing.status).toBe(400);
  const valid = form();
  valid.set("consent", "true");
  valid.set(
    "video",
    new Blob([new Uint8Array(movie)], { type: "video/mp4" }),
    "boomerang.mp4",
  );
  valid.set(
    "photo",
    new Blob(
      [
        new Uint8Array(
          await readFile("examples/starter-frames/pink-gingham-3.png"),
        ),
      ],
      { type: "image/png" },
    ),
    "final.png",
  );
  const response = await photo(
    new Request("http://localhost:3000/api/photos", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: valid,
    }),
  );
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ mode: "mock" });
  // Signature/type checks are real in mock mode too.
  valid.set(
    "video",
    new Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" }),
    "bad.mp4",
  );
  const invalid = await photo(
    new Request("http://localhost:3000/api/photos", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: valid,
    }),
  );
  expect(invalid.status).toBe(415);
}, 60000);

it("boomerang endpoint enforces origin, processing consent and bounded JPEG input", async () => {
  const request = (form: FormData, origin = "http://localhost:3000") =>
    new Request("http://localhost:3000/api/boomerang", {
      method: "POST",
      headers: { Origin: origin },
      body: form,
    });
  expect(
    (await boomerang(request(new FormData(), "https://evil.test"))).status,
  ).toBe(403);
  expect((await boomerang(request(new FormData()))).status).toBe(400);
  const empty = new FormData();
  empty.set("processingConsent", "true");
  expect((await boomerang(request(empty))).status).toBe(400);
  empty.set(
    "frames",
    new Blob(["pretend-jpeg"], { type: "image/jpeg" }),
    "bad.jpg",
  );
  expect((await boomerang(request(empty))).status).toBe(415);
});
