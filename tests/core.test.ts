import { beforeAll, describe, it, expect, vi, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import manifest from "../examples/starter-frames/starter-frames.json" with { type: "json" };
import {
  draftSchema,
  layoutSchema,
  frameSchema,
  publicFrame,
} from "@/lib/schema";
import { cover, mirroredX, replacePhoto, filterPixel } from "@/lib/compositor";
import { driveViewUrl } from "@/lib/urls";
import { checkOrigin, signSession, verifySession, throttle } from "@/lib/auth";
import {
  validateImage,
  validateAlpha,
  boundedForm,
  boundedJson,
} from "@/lib/uploads";
import { MockBackend } from "@/lib/storage/mock";
import { FrameRepository } from "@/lib/storage/repository";
import { savePhoto } from "@/lib/storage";
import { GoogleDriveBackend, retry } from "@/lib/storage/google-drive";
import type { drive_v3 } from "googleapis/build/src/apis/drive/v3.js";
import type { Backend } from "@/lib/storage/backend";
import type { OAuth2Client } from "google-auth-library";

const seed = manifest.frames[0];
const draft = () => draftSchema.parse({ ...seed, tags: [] });
let png: Buffer;
beforeAll(async () => {
  png = await readFile("examples/starter-frames/pink-gingham-3.png");
  process.env.ADMIN_SESSION_SECRET =
    "test-only-session-secret-material-12345678901234567890";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("schema and geometry", () => {
  it("every active starter has exactly three transparent photo areas and no unused hole", async () => {
    for (const frame of manifest.frames) {
      expect(frame.slots).toHaveLength(3);
      const { data, info } = await sharp(
        await readFile(`examples/starter-frames/${frame.overlayPath}`),
      )
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const boxes = frame.slots.map((s) => ({
        x: Math.floor(s.x * info.width),
        y: Math.floor(s.y * info.height),
        right: Math.ceil((s.x + s.width) * info.width),
        bottom: Math.ceil((s.y + s.height) * info.height),
      }));
      let outside = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] >= 32) continue;
        const pixel = (i - 3) / 4,
          x = pixel % info.width,
          y = Math.floor(pixel / info.width);
        if (
          !boxes.some(
            (b) => x >= b.x && x <= b.right && y >= b.y && y <= b.bottom,
          )
        )
          outside++;
      }
      expect(outside).toBeLessThan(info.width * info.height * 0.002);
    }
  });
  it.each(manifest.frames)("accepts supplied $name manifest layout", (s) =>
    expect(layoutSchema.safeParse({ ...s, tags: [] }).success).toBe(true),
  );
  it("rejects out of bounds, duplicate order/id, overlap, 7 slots and extreme dimensions", () => {
    const bad = [
      { ...draft(), slots: [{ ...seed.slots[0], x: 0.9 }] },
      { ...draft(), slots: [seed.slots[0], { ...seed.slots[1], order: 0 }] },
      {
        ...draft(),
        slots: [seed.slots[0], { ...seed.slots[1], id: seed.slots[0].id }],
      },
      {
        ...draft(),
        slots: [seed.slots[0], { ...seed.slots[0], id: "b", order: 1 }],
      },
      {
        ...draft(),
        slots: Array.from({ length: 7 }, (_, i) => ({
          ...seed.slots[0],
          id: `s${i}`,
          order: i,
        })),
      },
      { ...draft(), dimensions: { width: 8000, height: 8000 } },
    ];
    bad.forEach((v) => expect(layoutSchema.safeParse(v).success).toBe(false));
  });
  it("allows incomplete drafts, blocks publish", () => {
    expect(draftSchema.safeParse({ ...draft(), slots: [] }).success).toBe(true);
    expect(layoutSchema.safeParse({ ...draft(), slots: [] }).success).toBe(
      false,
    );
  });
  it("cover crops portrait correctly and respects crop position", () => {
    expect(cover(100, 200, 200, 100)).toEqual({
      sx: 0,
      sy: 75,
      sw: 100,
      sh: 50,
    });
    expect(cover(100, 200, 200, 100, { x: 0, y: 1 }).sy).toBe(150);
  });
  it("mirror maps left and right once", () => {
    expect(mirroredX(0, 100, true)).toBe(100);
    expect(mirroredX(25, 100, false)).toBe(25);
  });
  it("filters are deterministic and preserve neutral pixels", () => {
    expect(filterPixel(20, 40, 60, "natural")).toEqual([20, 40, 60]);
    const bw = filterPixel(20, 40, 60, "bw");
    expect(bw[0]).toBe(bw[1]);
    expect(bw[1]).toBe(bw[2]);
    expect(filterPixel(255, 255, 255, "warm")[0]).toBe(255);
    expect(filterPixel(255, 255, 255, "cool")[2]).toBe(255);
  });
  it("retaking index 1 keeps other photos intact", () => {
    const photos = [0, 1, 2].map((i) => ({ url: `photo-${i}`, mirror: true }));
    const next = replacePhoto(photos, 1, { url: "new", mirror: false });
    expect(next[0]).toBe(photos[0]);
    expect(next[2]).toBe(photos[2]);
    expect(next[1].url).toBe("new");
    expect(photos[1].url).toBe("photo-1");
  });
  it("only permits direct Drive viewers with matching file ID", () => {
    expect(
      driveViewUrl("https://drive.google.com/file/d/real_id/view", "real_id"),
    ).toBeTruthy();
    for (const url of [
      "javascript:alert(1)",
      "https://evil.test/file/d/x/view",
      "https://drive.google.com.evil.test/file/d/x/view",
      "https://a@drive.google.com/file/d/x/view",
      "http://drive.google.com/file/d/x/view",
      "https://drive.google.com/file/d/wrong/view",
    ])
      expect(driveViewUrl(url, "real_id")).toBeNull();
  });
});
describe("security", () => {
  it("verifies signature and rejects expired/tampered sessions", async () => {
    const token = await signSession();
    expect(await verifySession(token)).toBe(true);
    expect(await verifySession(token.slice(0, -3) + "xxx")).toBe(false);
    expect(await verifySession(await signSession(-1))).toBe(false);
    expect(await verifySession()).toBe(false);
  });
  it("rejects missing, forged and cross-site origins", () => {
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000", {
          headers: { Origin: "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
    for (const headers of [
      {},
      { Origin: "https://evil.test" },
      { Origin: "http://localhost:3000", "Sec-Fetch-Site": "cross-site" },
    ] as Record<string, string>[])
      expect(() =>
        checkOrigin(new Request("http://localhost:3000", { headers })),
      ).toThrow();
  });
  it("throttles repeated requests", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "unit-test" },
    });
    throttle(req, "test", 1);
    expect(() => throttle(req, "test", 1)).toThrow(/Terlalu banyak/);
  });
  it("validates actual PNG and every starter alpha slot", async () => {
    for (const frame of manifest.frames) {
      const bytes = await readFile(
        `examples/starter-frames/${frame.overlayPath}`,
      );
      await expect(validateImage(bytes, "image/png", true)).resolves.toEqual(
        frame.dimensions,
      );
      await expect(validateAlpha(bytes, frame.slots)).resolves.toBeUndefined();
    }
  });
  it("rejects signature mismatch, oversized data, corrupt PNG and opaque slots", async () => {
    await expect(validateImage(png, "image/jpeg", true)).rejects.toMatchObject({
      status: 415,
    });
    await expect(
      validateImage(Buffer.alloc(12 * 1024 * 1024 + 1), "image/png"),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      validateImage(png.subarray(0, 70), "image/png", true),
    ).rejects.toMatchObject({ status: 400 });
    const opaque = await sharp({
      create: { width: 1200, height: 3600, channels: 4, background: "#fff" },
    })
      .png()
      .toBuffer();
    await expect(validateAlpha(opaque, seed.slots)).rejects.toMatchObject({
      code: "INVALID_ALPHA",
    });
  });
  it("bounds actual streamed body without trusting content-length", async () => {
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(100));
        c.close();
      },
    });
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=a" },
      body,
      duplex: "half",
    } as RequestInit);
    await expect(boundedForm(req, 50)).rejects.toMatchObject({ status: 413 });
    await expect(
      boundedJson(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "x",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
describe("storage integration", () => {
  it("CRUD, private drafts, revision conflict and retained overlays", async () => {
    const backend = new MockBackend(),
      repo = new FrameRepository(backend);
    const created = await repo.save(draft(), png);
    expect(frameSchema.parse(created)).toEqual(created);
    expect(created.status).toBe("draft");
    expect(await repo.list()).toHaveLength(0);
    await expect(repo.get(created.id)).rejects.toMatchObject({ status: 404 });
    const published = await repo.status(created.id, "published", 1);
    expect(await repo.list()).toHaveLength(1);
    expect(publicFrame(published)).not.toHaveProperty("overlay");
    await expect(
      repo.save(draft(), undefined, created.id, 1),
    ).rejects.toMatchObject({ status: 409 });
    const updated = await repo.save(
      draft(),
      png,
      created.id,
      published.revision,
    );
    expect(updated.overlay.version).toBe(2);
    expect(updated.assetHistory).toHaveLength(1);
    const pub = await repo.status(created.id, "published", updated.revision);
    expect((await repo.asset(created.id, "overlay", 1)).bytes).toEqual(png);
    await expect(
      repo.asset(created.id, "arbitrary-id", 1),
    ).rejects.toMatchObject({ status: 404 });
    await expect(repo.asset(created.id, "overlay", 999)).rejects.toMatchObject({
      status: 404,
    });
    const hidden = await repo.status(created.id, "draft", pub.revision);
    expect(await repo.list()).toHaveLength(0);
    await expect(repo.asset(created.id, "overlay", 2)).rejects.toMatchObject({
      status: 404,
    });
    await repo.status(created.id, "archived", hidden.revision);
    expect((await repo.list(true))[0].status).toBe("archived");
  });
  it("rolls back partial uploads without metadata", async () => {
    const backend = new MockBackend(),
      repo = new FrameRepository(backend);
    const create = backend.create.bind(backend);
    let count = 0;
    vi.spyOn(backend, "create").mockImplementation(async (...args) => {
      if (++count === 2) throw new Error("quota");
      return create(...args);
    });
    await expect(repo.save(draft(), png)).rejects.toThrow("quota");
    expect(backend.files.size).toBe(0);
  });
  it("rejects incomplete publish and mismatching dimensions", async () => {
    const repo = new FrameRepository(new MockBackend());
    const frame = await repo.save({ ...draft(), slots: [] }, png);
    await expect(
      repo.status(frame.id, "published", frame.revision),
    ).rejects.toThrow();
    await expect(
      repo.save({ ...draft(), dimensions: { width: 1000, height: 3000 } }, png),
    ).rejects.toMatchObject({ code: "DIMENSION_MISMATCH" });
  });
  it("demo final upload returns no Drive link and retains no photo bytes", async () => {
    const backend = new MockBackend();
    const response = await savePhoto(backend, "mock", png, "image/png");
    expect(response).toMatchObject({ mode: "mock" });
    expect(response).not.toHaveProperty("viewUrl");
    expect(backend.files.size).toBe(0);
  });
  it("sharing failure returns no link and cleans orphan", async () => {
    const backend = new MockBackend();
    vi.spyOn(backend, "share").mockRejectedValue(new Error("Workspace policy"));
    await expect(
      savePhoto(backend, "google-drive", png, "image/png"),
    ).rejects.toMatchObject({ code: "SHARING_FAILED" });
    expect(backend.files.size).toBe(0);
  });
  it("quota failure does not fabricate a result", async () => {
    const backend = new MockBackend();
    vi.spyOn(backend, "create").mockRejectedValue(new Error("quota"));
    await expect(
      savePhoto(backend, "google-drive", png, "image/png"),
    ).rejects.toThrow("quota");
  });
  it("returns verified real Drive result with one uploaded final only", async () => {
    const backend = new MockBackend();
    vi.spyOn(backend, "share").mockImplementation(async (id) => ({
      viewUrl: `https://drive.google.com/file/d/${id}/view`,
      downloadUrl: null,
    }));
    const response = await savePhoto(backend, "google-drive", png, "image/png");
    expect(response.mode).toBe("google-drive");
    expect(backend.files.size).toBe(1);
    expect([...backend.files.values()][0].folder).toBe("photos");
  });
  it("Drive adapter refuses a link when ACL verification fails", async () => {
    const permissions = {
      create: vi.fn().mockResolvedValue({ data: { id: "permission" } }),
      list: vi.fn().mockResolvedValue({
        data: { permissions: [{ type: "user", role: "owner" }] },
      }),
    };
    const get = vi.fn();
    const backend = new GoogleDriveBackend({
      permissions,
      files: { get },
    } as unknown as drive_v3.Drive);
    await expect(backend.share("test-file")).rejects.toMatchObject({
      code: "SHARING_DENIED",
    });
    expect(get).not.toHaveBeenCalled();
    permissions.list.mockResolvedValue({
      data: { permissions: [{ type: "anyone", role: "reader" }] },
    });
    get.mockResolvedValue({ data: { webViewLink: "https://evil.test/photo" } });
    await expect(backend.share("test-file")).rejects.toMatchObject({
      code: "INVALID_DRIVE_LINK",
    });
    get.mockResolvedValue({
      data: { webViewLink: "https://drive.google.com/file/d/test-file/view" },
    });
    await expect(backend.share("test-file")).resolves.toMatchObject({
      viewUrl: "https://drive.google.com/file/d/test-file/view",
    });
  });
  it("Drive outages have bounded backoff", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: 429 })
      .mockRejectedValueOnce({ code: 503 })
      .mockResolvedValue("ok");
    const pending = retry(operation);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
  });
  it("large files use OAuth resumable upload with one preallocated ID", async () => {
    process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID = "test-private-folder";
    const files = {
      generateIds: vi
        .fn()
        .mockResolvedValue({ data: { ids: ["one-fixed-id"] } }),
      create: vi.fn(),
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        headers: new Headers({
          location:
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test",
        }),
      })
      .mockResolvedValueOnce({ data: { id: "one-fixed-id" } });
    const backend = new GoogleDriveBackend(
      { files } as unknown as drive_v3.Drive,
      { request } as unknown as OAuth2Client,
    );
    const bytes = Buffer.alloc(6 * 1024 * 1024);
    await expect(
      backend.create("photos", "final.png", "image/png", bytes),
    ).resolves.toBe("one-fixed-id");
    expect(files.create).not.toHaveBeenCalled();
    expect(request.mock.calls[0][0].data).toMatchObject({
      id: "one-fixed-id",
      parents: ["test-private-folder"],
    });
    expect(request.mock.calls[1][0]).toMatchObject({
      method: "PUT",
      data: bytes,
    });
  });
  it("Drive listing failure stays observable", async () => {
    const backend = new MockBackend();
    vi.spyOn(backend, "list").mockRejectedValue(new Error("Drive unavailable"));
    await expect(
      new FrameRepository(backend as Backend).list(),
    ).rejects.toThrow("Drive unavailable");
  });
});
