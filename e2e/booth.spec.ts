import { test, expect } from "@playwright/test";
import { installCamera, takePhotos } from "./camera-helper";
import { installResultFixture } from "./result-helper";
import sharp from "sharp";
import jsQR from "jsqr";
import { readFile } from "node:fs/promises";
import { printPreview } from "../src/lib/print-photo";
import { printLayoutSchema } from "../src/lib/print-layout";

const seeds: typeof import("../examples/starter-frames/starter-frames.json") =
  JSON.parse(
    await readFile(
      new URL(
        "../examples/starter-frames/starter-frames.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );

// Synthetic camera media only. No real Drive or personal photos.
for (const seed of seeds.frames) {
  test(`legacy ${seed.name} overlay uses current design while pending, failed, retried and demo complete`, async ({
    page,
  }) => {
    await installCamera(page);
    // Reproduce an already-published Drive overlay with the old green signature.
    const photoBottom = Math.ceil(
      Math.max(...seed.slots.map((s) => s.y + s.height)) *
        seed.dimensions.height,
    );
    const green = await sharp({
      create: {
        width: seed.dimensions.width,
        height: seed.dimensions.height - photoBottom - 20,
        channels: 4,
        background: "#087b46",
      },
    })
      .png()
      .toBuffer();
    const legacy = await sharp(
      await readFile(`examples/starter-frames/${seed.overlayPath}`),
    )
      .composite([{ input: green, left: 0, top: photoBottom + 20 }])
      .png()
      .toBuffer();
    await page.route("**/api/frames/**/asset/overlay?*", (route) =>
      route.fulfill({ contentType: "image/png", body: legacy }),
    );
    let unblock!: () => void;
    const hold = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    let received!: (value: FormData) => void;
    const request = new Promise<FormData>((resolve) => {
      received = resolve;
    });
    let uploads = 0;
    let initial: Buffer | undefined;
    await page.route("**/api/photos", async (route) => {
      const req = route.request();
      const form = await new Response(new Uint8Array(req.postDataBuffer()!), {
        headers: { "Content-Type": req.headers()["content-type"] },
      }).formData();
      const raw = Buffer.from(await (form.get("photo") as File).arrayBuffer());
      if (++uploads === 1) {
        initial = raw;
        received(form);
        await hold;
        await route.fulfill({
          status: 503,
          json: {
            error: { code: "SHARING_FAILED", message: "Sharing denied" },
          },
        });
      } else {
        expect(raw.equals(initial!)).toBe(true); // Retry never uploads the appended placeholder.
        await route.continue();
      }
    });
    await page.goto("/booth");
    await page.getByRole("button", { name: `Pilih ${seed.name}` }).click();
    await page.getByRole("button", { name: "Buka kamera" }).click();
    await page.getByRole("button", { name: "Mulai countdown" }).click();
    const form = await request;
    const pending = page.locator(".auto-upload-preview");
    await expect(pending).toBeVisible();
    const previewBytes = Buffer.from(
      await pending.evaluate((img: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    );
    const layout = printLayoutSchema.parse(
      JSON.parse(form.get("printLayout") as string),
    );
    const expected = await printPreview(initial!, layout);
    const meta = await sharp(expected).metadata();
    expect(await sharp(initial!).metadata()).toMatchObject(seed.dimensions);
    expect(await sharp(previewBytes).metadata()).toMatchObject({
      width: meta.width,
      height: meta.height,
    });
    // Same background/body/edge geometry as final print; no old green anywhere below photos.
    for (const y of [
      seed.dimensions.height - 25,
      seed.dimensions.height + 40,
      meta.height! - 25,
    ]) {
      const region = {
        left: Math.floor(meta.width! * 0.5),
        top: y,
        width: 1,
        height: 1,
      };
      const pixel = (bytes: Buffer) =>
        sharp(bytes).extract(region).removeAlpha().raw().toBuffer();
      expect(await pixel(previewBytes)).toEqual(await pixel(expected));
    }
    const { data, info } = await sharp(previewBytes)
      .extract({
        left: 0,
        top: photoBottom + 20,
        width: meta.width!,
        height: meta.height! - photoBottom - 20,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let greenPixels = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i] === 8 && data[i + 1] === 123 && data[i + 2] === 70)
        greenPixels++;
    expect(greenPixels).toBe(0);
    expect(
      jsQR(new Uint8ClampedArray(data), info.width, info.height),
    ).toBeNull();
    await page.screenshot({ path: `.qa/pending-${seed.id}.png` });
    const pendingUrl = await pending.getAttribute("src");
    unblock();
    await expect(
      page.getByRole("button", { name: "Coba simpan lagi" }),
    ).toBeVisible();
    await expect(pending).toHaveAttribute("src", pendingUrl!);
    await page.getByRole("button", { name: "Coba simpan lagi" }).click();
    await expect(
      page.getByRole("heading", { name: /Demo selesai/ }),
    ).toBeVisible();
    await expect(page.getByAltText("Hasil akhir photo strip")).toHaveAttribute(
      "src",
      pendingUrl!,
    );
    await expect(page.locator(".qr")).toHaveCount(0);
    expect(uploads).toBe(2);
  });
}

test("guest opens camera directly then three photos auto-upload once, with natural color and local downloads", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await installCamera(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Hoya-Hoya Days | Kalbe Morinaga Indonesia");
  await page.screenshot({ path: ".qa/landing-desktop.png" });
  await page.getByRole("link", { name: /Mulai foto bareng/ }).click();
  await page.getByAltText("Preview Pink Gingham").click();
  await expect(page.getByRole("button", { name: "Buka kamera" })).toBeEnabled();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  let uploads = 0;
  let encodes = 0;
  await page.route("**/api/boomerang", async (route) => {
    encodes++;
    const req = route.request();
    const form = await new Response(new Uint8Array(req.postDataBuffer()!), {
      headers: { "Content-Type": req.headers()["content-type"] },
    }).formData();
    expect(form.get("processingConsent")).toBe("true");
    expect(form.getAll("frames")).toHaveLength(3);
    const pixels = await sharp(
      Buffer.from(await (form.getAll("frames")[0] as File).arrayBuffer()),
    )
      .extract({ left: 200, top: 900, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(pixels[2]).toBeGreaterThan(210); // Natural, mirrored blue half.
    await route.continue();
  });
  await page.route("**/api/photos", async (route) => {
    uploads++;
    await route.continue();
  });
  await page.route("**/api/frames/**/asset/overlay?*", (route) =>
    route.abort(),
  ); // snapshot remains usable
  await takePhotos(page);
  await expect(
    page.getByRole("heading", { name: /Demo selesai/ }),
  ).toBeVisible();
  expect(uploads).toBe(1);
  expect(encodes).toBe(1);
  await expect(page.locator(".filter-options, .retake-grid, .qr")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Video MP4", exact: true }).click();
  const video = page.getByLabel("Preview video MP4");
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).videoWidth))
    .toBe(1080);
  expect(
    await video.evaluate((v) => (v as HTMLVideoElement).duration),
  ).toBeCloseTo(6, 1);
  const mp4 = page.waitForEvent("download");
  await page.getByRole("button", { name: "MP4", exact: true }).click();
  expect((await mp4).suggestedFilename()).toBe("hoya-hoya-days-kmi-video.mp4");
  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  expect((await png).suggestedFilename()).toBe("hoya-hoya-days-kmi.png");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Pilih Pink Gingham" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("fake camera counts three shots and stops tracks; permission denial allows retry", async ({
  browser,
}) => {
  const context = await browser.newContext({ permissions: ["camera"] });
  // Canvas capture provides a deterministic synthetic camera and no personal photos.
  await context.addInitScript(() => {
    let active: MediaStream | null = null;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#8cbba3";
        ctx.fillRect(0, 0, 800, 600);
        ctx.fillStyle = "#f6dfba";
        ctx.fillRect(200, 150, 350, 350);
        active = canvas.captureStream(10);
        (window as unknown as { testStream: MediaStream }).testStream = active;
        return active;
      },
    });
    Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
      value: async () => [],
    });
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    let holdStarted = 0;
    const delays: number[] = [];
    (window as unknown as { captureDelays: number[] }).captureDelays = delays;
    new MutationObserver(() => {
      if (
        !holdStarted &&
        document.querySelector('.service-countdown[data-holding="true"]')
      ) {
        holdStarted = performance.now();
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      ...args: [image: CanvasImageSource, ...coordinates: number[]]
    ) {
      if (args[0] instanceof HTMLVideoElement && holdStarted) {
        delays.push(performance.now() - holdStarted);
        holdStarted = 0;
      }
      return Reflect.apply(draw, this, args);
    };
  });
  await page.goto("/booth");
  await page.getByRole("button", { name: "Pilih Pink Gingham" }).click();
  await page.getByRole("button", { name: "Buka kamera" }).click();
  await page.getByRole("button", { name: "Mulai countdown" }).click();
  await expect(page.locator(".service-countdown")).toBeVisible();
  await expect(page.locator(".service-countdown .sr-only")).toContainText(
    "Foto 1 dari 3",
  );
  await expect(page.locator(".countdown-number")).toHaveText("3");
  await expect(
    page.locator(".service-countdown svg, .countdown-prompt"),
  ).toHaveCount(0);
  await page.screenshot({ path: ".qa/self-service-countdown.png" });
  await expect(page.getByRole("heading", { name: /Demo selesai/ })).toBeVisible(
    { timeout: 25000 },
  );
  await expect(page.locator(".filter-options")).toHaveCount(0);
  const delays = await page.evaluate(
    () => (window as unknown as { captureDelays: number[] }).captureDelays,
  );
  expect(delays).toHaveLength(3);
  expect(delays.every((delay) => delay >= 450)).toBe(true);
  expect(
    await page.evaluate(() =>
      (window as unknown as { testStream: MediaStream }).testStream
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Foto lagi", exact: true }).click();
  await page.getByRole("button", { name: "Ya, mulai sesi baru" }).click();
  await page.getByRole("button", { name: "Pilih Pink Gingham" }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("denied", "NotAllowedError");
      },
      configurable: true,
    });
  });
  await page.getByRole("button", { name: "Buka kamera" }).click();
  await expect(
    page.locator(".kiosk-message.is-error [role=alert]"),
  ).toContainText("Izin kamera ditolak");
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buka kamera" })).toBeEnabled();
  await context.close();
});

test("upload failure preserves media and does not start reset timer; retry reuses video", async ({
  page,
}) => {
  await installCamera(page);
  await page.goto("/booth");
  await page.getByRole("button", { name: "Pilih Pink Gingham" }).click();
  let uploads = 0;
  let encodes = 0;
  await page.route("**/api/boomerang", async (route) => {
    encodes++;
    await route.continue();
  });
  await page.route("**/api/photos", async (route) => {
    uploads++;
    if (uploads === 1)
      await route.fulfill({
        status: 503,
        json: { error: { code: "SHARING_FAILED", message: "Sharing denied" } },
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Buka kamera" }).click();
  await page.getByRole("button", { name: "Mulai countdown" }).click();
  await expect(
    page.getByRole("button", { name: "Coba simpan lagi" }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".qr")).toHaveCount(0);
  await page.clock.install();
  await page.clock.fastForward(16000);
  await expect(
    page.getByRole("button", { name: "Coba simpan lagi" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG lokal" }).click();
  expect((await download).suggestedFilename()).toBe("hoya-hoya-days-kmi.png");
  await page.getByRole("button", { name: "Coba simpan lagi" }).click();
  await expect(
    page.getByRole("heading", { name: /Demo selesai/ }),
  ).toBeVisible();
  expect(uploads).toBe(2);
  expect(encodes).toBe(1);
});

test("verified QR and printed PNG match; timer starts on QR display and resets after 15 seconds", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installCamera(page);
  await installResultFixture(page, 15);
  await page.goto("/booth");
  await page.getByRole("button", { name: "Pilih Pink Gingham" }).click();
  await takePhotos(page);
  await expect(
    page.getByAltText("QR folder Google Drive kolase dan video"),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toContainText("15");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  const photo = page.getByAltText("Hasil akhir photo strip");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const download = await pending;
  await download.saveAs(".qa/print-qr-synthetic.png");
  const { data, info } = await sharp(
    await readFile(".qa/print-qr-synthetic.png"),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(
    "https://drive.google.com/drive/folders/test-only-layout-id",
  );
  await page.screenshot({ path: ".qa/auto-qr-result.png" });
  await page.clock.fastForward(14000);
  await expect(photo).toBeVisible();
  await page.clock.fastForward(1500);
  await expect(
    page.getByRole("button", { name: "Pilih Pink Gingham" }),
  ).toBeVisible();
  await expect(photo).toHaveCount(0);
  await expect(page.locator(".qr")).toHaveCount(0);
  // Return to the real clock before interacting with the next guest's session.
  await page.clock.resume();
  await page.getByRole("button", { name: "Pilih Pink Gingham" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buka kamera" })).toBeEnabled();
});

test("Vintage print keeps black film artwork behind the QR, with no green panel", async ({
  page,
}) => {
  await installCamera(page);
  await installResultFixture(page);
  await page.goto("/booth");
  await page.getByRole("button", { name: "Pilih Vintage Film" }).click();
  await takePhotos(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const download = await pending;
  await download.saveAs(".qa/vintage-continuous-qr.png");
  const bytes = await readFile(".qa/vintage-continuous-qr.png");
  expect([
    ...(await sharp(bytes)
      .extract({ left: 500, top: 2600, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()),
  ]).toEqual([32, 33, 36]);
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(
    "https://drive.google.com/drive/folders/test-only-layout-id",
  );
  await page.screenshot({ path: ".qa/vintage-continuous-result.png" });
  await page.getByRole("button", { name: "Video MP4", exact: true }).click();
  const video = page.getByLabel("Preview video MP4");
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).videoWidth))
    .toBe(1080);
  const screenshot = await video.evaluate(async (node) => {
    const v = node as HTMLVideoElement;
    await new Promise<void>((resolve) => {
      v.addEventListener("seeked", () => resolve(), { once: true });
      v.currentTime = 0.5;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    return canvas.toDataURL("image/png");
  });
  const videoPixels = await sharp(
    Buffer.from(screenshot.split(",")[1], "base64"),
  )
    .extract({ left: 0, top: 1552, width: 1080, height: 368 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(
    jsQR(
      new Uint8ClampedArray(videoPixels.data),
      videoPixels.info.width,
      videoPixels.info.height,
    )?.data,
  ).toBe("https://drive.google.com/drive/folders/test-only-layout-id");
  const mp4 = page.waitForEvent("download");
  await page.getByRole("button", { name: "MP4", exact: true }).click();
  await (await mp4).saveAs(".qa/vintage-qr-final.mp4");
  await page.screenshot({ path: ".qa/vintage-video-result.png" });
});

for (const theme of [
  { name: "Pink Gingham", slug: "pink", color: [247, 210, 223] },
  { name: "Mint Party", slug: "mint", color: [221, 245, 232] },
])
  test(`${theme.name} video uses the selected design and a playable folder QR`, async ({
    page,
  }) => {
    await installCamera(page);
    await installResultFixture(page);
    await page.goto("/booth");
    await expect
      .poll(() =>
        page
          .getByAltText("Preview Vintage Film")
          .evaluate((img) => (img as HTMLImageElement).naturalHeight),
      )
      .toBeGreaterThan(1000);
    await page.screenshot({ path: `.qa/frame-picker-${theme.slug}.png` });
    await page.getByRole("button", { name: `Pilih ${theme.name}` }).click();
    await takePhotos(page);
    await page.getByRole("button", { name: "Video MP4", exact: true }).click();
    const video = page.getByLabel("Preview video MP4");
    await expect
      .poll(() => video.evaluate((v) => (v as HTMLVideoElement).videoWidth))
      .toBe(1080);
    const screenshot = await video.evaluate(async (node) => {
      const v = node as HTMLVideoElement;
      await new Promise<void>((resolve) => {
        v.addEventListener("seeked", () => resolve(), { once: true });
        v.currentTime = 0.5;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      canvas.getContext("2d")!.drawImage(v, 0, 0);
      return canvas.toDataURL("image/png");
    });
    const bytes = Buffer.from(screenshot.split(",")[1], "base64");
    await sharp(bytes).toFile(`.qa/${theme.slug}-video-card.png`);
    const color = [
      ...(await sharp(bytes)
        .extract({ left: 2, top: 2, width: 1, height: 1 })
        .removeAlpha()
        .raw()
        .toBuffer()),
    ];
    color.forEach((channel, i) =>
      expect(Math.abs(channel - theme.color[i])).toBeLessThan(12),
    );
    const qr = await sharp(bytes)
      .extract({ left: 0, top: 1552, width: 1080, height: 368 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(
      jsQR(new Uint8ClampedArray(qr.data), qr.info.width, qr.info.height)?.data,
    ).toBe("https://drive.google.com/drive/folders/test-only-layout-id");
  });

test("QR timer uses a custom admin duration returned by settings", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installCamera(page);
  await installResultFixture(page, 5);
  await page.goto("/booth");
  await page.getByRole("button", { name: "Pilih Pink Gingham" }).click();
  await takePhotos(page);
  await expect(
    page.getByAltText("QR folder Google Drive kolase dan video"),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toContainText("5");
  await page.clock.install();
  await page.clock.fastForward(6000);
  await expect(
    page.getByRole("button", { name: "Pilih Pink Gingham" }),
  ).toBeVisible();
  await expect(page.locator(".qr")).toHaveCount(0);
});
