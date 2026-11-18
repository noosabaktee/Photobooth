import { test, expect } from "@playwright/test";
import { installCamera, takePhotos } from "./camera-helper";
import sharp from "sharp";
test("guest gallery, three photos, retake, export, consent, mock result and refresh", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await installCamera(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Hoya-Hoya Days | Kalbe Morinaga Indonesia");
  await expect(
    page.getByRole("link", { name: "Hoya-Hoya Days beranda" }),
  ).toContainText("Kalbe Morinaga Indonesia");
  await expect(page.getByRole("heading", { name: /Hoya-Hoya/ })).toBeVisible();
  await page.screenshot({ path: ".qa/landing-desktop.png", fullPage: true });
  await page.getByRole("link", { name: /Mulai foto bareng/ }).click();
  await page.getByAltText("Preview Pink Gingham").click();
  await page.route("**/api/frames/**/asset/overlay?*", (route) =>
    route.abort(),
  );
  await takePhotos(page);
  await expect(
    page.getByRole("heading", { name: "Momen tim yang berkesan." }),
  ).toBeVisible();
  const before = await page
    .locator(".retake-grid img")
    .evaluateAll((images) => images.map((i) => (i as HTMLImageElement).src));
  await page.getByRole("button", { name: "Ulang foto 3", exact: true }).click();
  await takePhotos(page, true);
  await expect(
    page.getByRole("heading", { name: "Momen tim yang berkesan." }),
  ).toBeVisible();
  const after = await page
    .locator(".retake-grid img")
    .evaluateAll((images) => images.map((i) => (i as HTMLImageElement).src));
  expect(after[0]).toBe(before[0]);
  expect(after[1]).toBe(before[1]);
  expect(after[2]).not.toBe(before[2]);
  expect(after).toHaveLength(3);
  await page.getByRole("button", { name: "Warm", exact: true }).click();
  await page.screenshot({ path: ".qa/review-desktop.png", fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG lokal" }).click();
  expect((await download).suggestedFilename()).toBe("hoya-hoya-days-kmi.png");
  await page
    .getByRole("button", { name: "Simpan & bagikan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Simpan ke Drive & buat QR" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Simpan ke Drive & buat QR" }).click();
  await expect(
    page.getByRole("heading", { name: /Demo selesai/ }),
  ).toBeVisible();
  await expect(page.getByAltText(/QR link/)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Temukan frame favoritmu." }),
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
  await page.goto("/booth");
  await page.getByRole("button", { name: "Pilih Pink Gingham" }).click();
  await page.getByRole("button", { name: "Buka kamera" }).click();
  await page.getByRole("button", { name: "Mulai countdown" }).click();
  await expect(
    page.getByRole("heading", { name: "Momen tim yang berkesan." }),
  ).toBeVisible({ timeout: 25000 });
  await expect(page.locator(".retake-grid button")).toHaveCount(3);
  expect(
    await page.evaluate(() =>
      (window as unknown as { testStream: MediaStream }).testStream
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Ulang foto 1", exact: true }).click();
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
test("mobile landing and booth have no horizontal clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /Mulai foto bareng/ }),
  ).toBeVisible();
  await page.screenshot({ path: ".qa/landing-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/booth");
  await page.getByRole("button", { name: "Frame berikutnya" }).click();
  await page.getByRole("button", { name: "Pilih Mint Party" }).click();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buka kamera" })).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("preview/export pixels match crop, mirror, filter and overlay; failed upload keeps download", async ({
  page,
}) => {
  await installCamera(page);
  await page.goto("/booth");
  await page.getByAltText("Preview Pink Gingham").click();
  await page.getByRole("button", { name: "Mirror on", exact: true }).click();
  await takePhotos(page);
  const pixel = () =>
    page.locator("canvas").evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      return [
        ...canvas
          .getContext("2d")!
          .getImageData(
            Math.round(canvas.width * 0.3),
            Math.round(canvas.height * 0.15),
            1,
            1,
          ).data,
      ].slice(0, 3);
    });
  await expect.poll(async () => (await pixel())[0]).toBeGreaterThan(210);
  expect((await pixel())[2]).toBeLessThan(40);
  await page.getByRole("button", { name: "Balik foto" }).click();
  await expect.poll(async () => (await pixel())[2]).toBeGreaterThan(210);
  expect((await pixel())[0]).toBeLessThan(40);
  await page.getByRole("button", { name: "B&W", exact: true }).click();
  await expect
    .poll(async () => {
      const p = await pixel();
      return Math.max(...p) - Math.min(...p);
    })
    .toBeLessThan(2);
  const preview = await pixel();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG lokal" }).click();
  const download = await event,
    stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const final = Buffer.concat(chunks);
  const meta = await sharp(final).metadata();
  expect(meta.width).toBe(1200);
  expect(meta.height).toBe(2826);
  const sample = await sharp(final)
    .extract({ left: 360, top: Math.round(2826 * 0.15), width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  [...sample].forEach((v, i) =>
    expect(Math.abs(v - preview[i])).toBeLessThan(2),
  );
  const border = await sharp(final)
    .extract({ left: 100, top: 100, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  expect([...border]).toEqual([247, 210, 223]);
  await page.route("**/api/photos", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "SHARING_FAILED",
          message: "Sharing gagal pada pengujian.",
        },
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Simpan & bagikan", exact: true })
    .click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Simpan ke Drive & buat QR" }).click();
  await expect(
    page.locator(".kiosk-message.is-error [role=alert]"),
  ).toContainText("Sharing gagal pada pengujian");
  await expect(
    page.getByRole("button", { name: "Download PNG lokal" }),
  ).toBeEnabled();
  await expect(page.getByAltText(/QR link/)).toHaveCount(0);
});
