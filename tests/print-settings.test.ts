import { it, expect, vi } from "vitest";
vi.mock("@/lib/video-server", () => ({
  stampVideo: vi.fn(async (bytes: Buffer) =>
    Buffer.concat([Buffer.from("stamped:"), bytes]),
  ),
}));
import sharp from "sharp";
import jsQR from "jsqr";
import { printPhoto } from "@/lib/print-photo";
import { MockBackend } from "@/lib/storage/mock";
import { SettingsRepository } from "@/lib/storage/settings";
import { FrameRepository } from "@/lib/storage/repository";
import { saveSession } from "@/lib/storage";
import { readFile } from "node:fs/promises";
import seeds from "../examples/starter-frames/starter-frames.json";
import QRCode from "qrcode";
import { selectedStarterStyle } from "@/lib/starter-artwork";
import { printLayoutSchema } from "@/lib/print-layout";
import { renderFramePreview } from "@/lib/frame-preview";
import { stampVideo } from "@/lib/video-server";
import { draftSchema } from "@/lib/schema";

it.each(seeds.frames)(
  "$name preview matches final dimensions and theme without a fake QR",
  async (seed) => {
    const overlay = await readFile(
      `examples/starter-frames/${seed.overlayPath}`,
    );
    const frame = draftSchema.parse({ ...seed, tags: [] });
    const preview = await renderFramePreview(frame, overlay);
    const input = await sharp(overlay)
      .flatten({ background: "#fff9f0" })
      .png()
      .toBuffer();
    const layout = {
      dimensions: seed.dimensions,
      photoBottom: Math.ceil(
        Math.max(...seed.slots.map((s) => s.y + s.height)) *
          seed.dimensions.height,
      ),
      starterStyle: selectedStarterStyle(frame),
    };
    const final = await printPhoto(
      input,
      "https://drive.google.com/drive/folders/test-only-preview",
      layout,
    );
    const expected = await sharp(final).metadata();
    expect(await sharp(preview).metadata()).toMatchObject({
      width: expected.width,
      height: expected.height,
    });
    const { data, info } = await sharp(preview)
      .extract({
        left: 0,
        top: seed.dimensions.height,
        width: seed.dimensions.width,
        height: expected.height! - seed.dimensions.height,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(
      jsQR(new Uint8ClampedArray(data), info.width, info.height),
    ).toBeNull();
    // Repository thumbnails are generated from exactly the same preview bytes.
    const backend = new MockBackend();
    const repo = new FrameRepository(backend);
    const saved = await repo.save(frame, overlay);
    const asset = await repo.asset(
      saved.id,
      "thumbnail",
      saved.overlay.version,
      true,
    );
    expect(asset.mimeType).toBe("image/webp");
    expect(asset.bytes).toEqual(
      await sharp(preview)
        .resize({ width: 360, withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer(),
    );
  },
  30000,
);

it("starter styling follows seed identity and accepts only the bounded style enum", () => {
  expect(
    selectedStarterStyle({
      name: "Renamed",
      tags: ["seed:starter-film-3"],
      dimensions: { width: 1000, height: 2486 },
    }),
  ).toBe("film");
  expect(
    selectedStarterStyle({
      name: "Custom",
      tags: [],
      dimensions: { width: 1000, height: 2486 },
    }),
  ).toBeUndefined();
  expect(
    printLayoutSchema.safeParse({
      dimensions: { width: 1000, height: 2486 },
      photoBottom: 2300,
      starterStyle: "anything-else",
    }).success,
  ).toBe(false);
});

it.each(seeds.frames)(
  "$name keeps its body theme behind QR, including old green Drive overlays",
  async (frame) => {
    const starterStyle = selectedStarterStyle({ ...frame, tags: [] })!;
    const input = await sharp(
      await readFile(`examples/starter-frames/${frame.overlayPath}`),
    )
      .flatten({ background: "#cbd5cf" })
      .png()
      .toBuffer();
    const { width, height } = frame.dimensions;
    const photoBottom = Math.min(
      height,
      Math.ceil(Math.max(...frame.slots.map((s) => s.y + s.height)) * height),
    );
    // Simulate already-imported overlays with the old green signature.
    const legacy = await sharp(input)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${width}" height="${height}"><rect x="0" y="${photoBottom + 20}" width="${width}" height="${height - photoBottom - 20}" fill="#087443"/></svg>`,
          ),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    const url = "https://drive.google.com/drive/folders/test-only-themed-frame";
    const sourceFooter = await sharp(input)
      .extract({
        left: 0,
        top: photoBottom + 20,
        width,
        height: height - photoBottom - 20,
      })
      .removeAlpha()
      .raw()
      .toBuffer();
    let sourceGreen = 0;
    for (let i = 0; i < sourceFooter.length; i += 3)
      if (
        sourceFooter[i] === 8 &&
        sourceFooter[i + 1] === 116 &&
        sourceFooter[i + 2] === 67
      )
        sourceGreen++;
    expect(sourceGreen).toBe(0);
    for (const bytes of [input, legacy]) {
      const output = await printPhoto(bytes, url, {
        dimensions: frame.dimensions,
        photoBottom,
        starterStyle,
      });
      const meta = await sharp(output).metadata();
      const pixels = async (image: Buffer, top: number, h: number) =>
        sharp(image)
          .extract({ left: 0, top, width, height: h })
          .ensureAlpha()
          .raw()
          .toBuffer();
      expect(await pixels(output, 0, photoBottom)).toEqual(
        await pixels(bytes, 0, photoBottom),
      );
      const { data, info } = await sharp(output)
        .extract({
          left: 0,
          top: photoBottom,
          width,
          height: meta.height! - photoBottom,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const decoded = jsQR(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
      );
      expect(decoded?.data).toBe(url);
      const pad = Math.max(
        12,
        Math.round(width * (starterStyle === "film" ? 0.125 : 0.065)),
      );
      const modules =
        QRCode.create(url, { errorCorrectionLevel: "M" }).modules.size + 8;
      const scale = Math.max(1, Math.floor((width * 0.4) / modules));
      const qrSize = modules * scale;
      const qrPixels = await sharp(output)
        .extract({
          left: pad,
          top: height + pad,
          width: qrSize,
          height: qrSize,
        })
        .removeAlpha()
        .raw()
        .toBuffer();
      const colors = new Set<string>();
      for (let i = 0; i < qrPixels.length; i += 3)
        colors.add(qrPixels.subarray(i, i + 3).toString("hex"));
      expect(colors).toEqual(
        new Set(
          starterStyle === "gingham"
            ? ["fce7ec", "f7d2df", "000000"]
            : starterStyle === "film"
              ? ["202124", "ffffff"]
              : ["ddf5e8", "000000"],
        ),
      );
      // Both old footer and new QR area follow the actual theme, never green.
      const footer = await sharp(output)
        .extract({
          left: 0,
          top: photoBottom + 20,
          width,
          height: meta.height! - photoBottom - 20,
        })
        .removeAlpha()
        .raw()
        .toBuffer();
      let green = 0;
      for (let i = 0; i < footer.length; i += 3)
        if (footer[i] === 8 && footer[i + 1] === 116 && footer[i + 2] === 67)
          green++;
      expect(green).toBe(0);
    }
  },
  30000,
);

it("edge-to-edge frames append a matching background and reject invalid layout snapshots", async () => {
  const input = await sharp({
    create: { width: 600, height: 800, channels: 3, background: "#eedddd" },
  })
    .png()
    .toBuffer();
  const url = "https://drive.google.com/drive/folders/test-only-edge-frame";
  const output = await printPhoto(input, url, {
    dimensions: { width: 600, height: 800 },
    photoBottom: 800,
  });
  expect(
    await sharp(output)
      .extract({ left: 0, top: 0, width: 600, height: 800 })
      .removeAlpha()
      .raw()
      .toBuffer(),
  ).toEqual(await sharp(input).removeAlpha().raw().toBuffer());
  expect([
    ...(await sharp(output)
      .extract({ left: 590, top: 850, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()),
  ]).toEqual([238, 221, 221]);
  await expect(
    printPhoto(input, url, {
      dimensions: { width: 600, height: 800 },
      photoBottom: 801,
    }),
  ).rejects.toThrow();
  await expect(
    printPhoto(input, url, {
      dimensions: { width: 600, height: 900 },
      photoBottom: 800,
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
});

it("print footer QR decodes to the exact folder; all original pixels are preserved", async () => {
  const input = await sharp({
    create: { width: 1200, height: 1600, channels: 4, background: "#123456" },
  })
    .png()
    .toBuffer();
  const url = "https://drive.google.com/drive/folders/test-only-print-folder";
  const output = await printPhoto(input, url);
  const meta = await sharp(output).metadata();
  expect(meta.width).toBe(1200);
  expect(meta.height).toBeGreaterThan(1600);
  const originalPixels = await sharp(input).ensureAlpha().raw().toBuffer();
  expect(
    await sharp(output)
      .extract({ left: 0, top: 0, width: 1200, height: 1600 })
      .ensureAlpha()
      .raw()
      .toBuffer(),
  ).toEqual(originalPixels);
  const { data, info } = await sharp(output)
    .extract({ left: 0, top: 1600, width: 1200, height: meta.height! - 1600 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(
    url,
  );
});

it("Drive PNG, response preview and printed QR are the same final bytes", async () => {
  const store = new MockBackend();
  store.share = async (id) => ({
    viewUrl: `https://drive.google.com/drive/folders/${id}?usp=sharing`,
    downloadUrl: null,
  });
  store.assertPublic = async () => {};
  const photo = await sharp({
    create: { width: 600, height: 1000, channels: 3, background: "#99bbaa" },
  })
    .png()
    .toBuffer();
  const result = await saveSession(
    store,
    "google-drive",
    photo,
    "image/png",
    Buffer.from("test-video"),
  );
  if (result.mode !== "google-drive")
    throw new Error("Expected verified result");
  const file = [...store.files.values()].find((f) => f.name === "kolase.png")!;
  expect(Buffer.from(result.photoDataUrl.split(",")[1], "base64")).toEqual(
    file.bytes,
  );
  const movie = [...store.files.values()].find(
    (f) => f.name === "boomerang.mp4",
  )!;
  expect(Buffer.from(result.videoDataUrl.split(",")[1], "base64")).toEqual(
    movie.bytes,
  );
  expect(movie.bytes.toString()).toBe("stamped:test-video");
  expect(stampVideo).toHaveBeenCalledWith(
    Buffer.from("test-video"),
    result.viewUrl,
    undefined,
  );
  const { data, info } = await sharp(file.bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(
    result.viewUrl,
  );
});

it("rejects unsafe QR destinations and output beyond image limits", async () => {
  const input = await sharp({
    create: { width: 200, height: 8000, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await expect(
    printPhoto(input, "https://evil.test/folder"),
  ).rejects.toMatchObject({ code: "INVALID_DRIVE_LINK" });
  await expect(
    printPhoto(input, "https://drive.google.com/drive/folders/test-only"),
  ).rejects.toMatchObject({ code: "PRINT_SIZE_LIMIT" });
});

it("settings persist as one private JSON, survive repository recreation and never appear as frames", async () => {
  const store = new MockBackend();
  const repo = new SettingsRepository(store);
  expect(await repo.get()).toMatchObject({ scanSeconds: 15, revision: 0 });
  await repo.save({ scanSeconds: 30, expectedRevision: 0 });
  expect(await new SettingsRepository(store).get()).toMatchObject({
    scanSeconds: 30,
    revision: 1,
  });
  expect([...store.files.values()]).toHaveLength(1);
  expect([...store.files.values()][0]).toMatchObject({
    folder: "frames",
    name: "kiosk-settings.json",
  });
  expect(await new FrameRepository(store).list(true)).toEqual([]);
  await expect(
    repo.save({ scanSeconds: 10, expectedRevision: 0 }),
  ).rejects.toMatchObject({ status: 409 });
  for (const scanSeconds of [0, 4, 301, 1.5, "20"])
    await expect(
      repo.save({ scanSeconds, expectedRevision: 1 }),
    ).rejects.toThrow();
  const results = await Promise.allSettled([
    repo.save({ scanSeconds: 20, expectedRevision: 1 }),
    repo.save({ scanSeconds: 25, expectedRevision: 1 }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
});

it("mock never retains session media or adds a fake printable Drive QR", async () => {
  const store = new MockBackend();
  const response = await saveSession(
    store,
    "mock",
    Buffer.from("test"),
    "image/png",
    Buffer.from("test-video"),
  );
  expect(response).not.toHaveProperty("photoDataUrl");
  expect(response).not.toHaveProperty("viewUrl");
  expect(store.files.size).toBe(0);
});

it("legacy settings gain a default active frame and explicit selection persists, rejects drafts and preserves selection on duration updates", async () => {
  const store = await MockBackend.seeded();
  await store.create(
    "frames",
    "kiosk-settings.json",
    "application/json",
    Buffer.from(
      JSON.stringify({ schemaVersion: 1, revision: 3, scanSeconds: 20 }),
    ),
  );
  const repo = new SettingsRepository(store);
  expect(await repo.get()).toMatchObject({
    activeFrameId: null,
    scanSeconds: 20,
    revision: 3,
  });
  const frames = new FrameRepository(store);
  const frame = (await frames.list())[1];
  await repo.save({
    expectedRevision: 3,
    scanSeconds: 25,
    activeFrameId: frame.id,
  });
  expect(await new SettingsRepository(store).get()).toMatchObject({
    activeFrameId: frame.id,
    revision: 4,
  });
  await repo.save({ expectedRevision: 4, scanSeconds: 15 });
  expect(await repo.get()).toMatchObject({
    activeFrameId: frame.id,
    revision: 5,
  });
  await frames.status(frame.id, "draft", frame.revision);
  await expect(
    repo.save({
      expectedRevision: 5,
      scanSeconds: 15,
      activeFrameId: frame.id,
    }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    repo.save({
      expectedRevision: 5,
      scanSeconds: 15,
      activeFrameId: "not-an-id",
    }),
  ).rejects.toThrow();
  expect((await repo.get()).revision).toBe(5);
  await repo.save({
    expectedRevision: 5,
    scanSeconds: 15,
    activeFrameId: null,
  });
  expect((await repo.get()).activeFrameId).toBeNull();
});
