import { test, expect, type Page } from "@playwright/test";
import {
  installCamera,
  takePhotos,
  installActiveFrame,
  readyCamera,
} from "./camera-helper";
import { installResultFixture } from "./result-helper";
import seeds from "../examples/starter-frames/starter-frames.json" with { type: "json" };
async function fits(page: Page) {
  const report = await page.evaluate(() => {
    const problems: string[] = [];
    const height = window.innerHeight,
      width = window.innerWidth;
    if (
      document.documentElement.scrollHeight > height + 1 ||
      document.documentElement.scrollWidth > width + 1
    )
      problems.push(
        `document ${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}, viewport ${width}x${height}`,
      );
    for (const selector of [
      ".kiosk-shell",
      ".booth-workspace",
      ".review-controls",
      ".capture-sidebar",
      ".gallery-panel",
    ]) {
      const node = document.querySelector<HTMLElement>(selector);
      if (node && node.scrollHeight > node.clientHeight + 2)
        problems.push(
          `${selector} overflows ${node.scrollHeight}>${node.clientHeight}`,
        );
    }
    for (const node of document.querySelectorAll<HTMLElement>(
      ".kiosk-shell button,.kiosk-shell a,.kiosk-shell select,.kiosk-shell input,.booth-workspace canvas,.booth-workspace .qr",
    )) {
      const r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || node.closest("dialog:not([open])"))
        continue;
      if (
        r.top < -1 ||
        r.left < -1 ||
        r.bottom > height + 1 ||
        r.right > width + 1
      )
        problems.push(
          `${node.getAttribute("aria-label") || node.textContent?.trim()} outside viewport: ${Math.round(r.top)}..${Math.round(r.bottom)}`,
        );
      const area = node.closest(".booth-workspace");
      if (area) {
        const limit = area.getBoundingClientRect();
        if (r.top < limit.top - 1 || r.bottom > limit.bottom + 1)
          problems.push(
            `${node.getAttribute("aria-label") || node.textContent?.trim()} outside workspace: ${Math.round(r.top)}..${Math.round(r.bottom)}, workspace ${Math.round(limit.top)}..${Math.round(limit.bottom)}`,
          );
      }
    }
    window.scrollTo(0, 9999);
    const timer = document
      .querySelector(".scan-timer")
      ?.getBoundingClientRect();
    const instructions = document
      .querySelector(".result-card > p:not(.small,.scan-timer)")
      ?.getBoundingClientRect();
    if (
      timer &&
      instructions &&
      Math.min(timer.bottom, instructions.bottom) -
        Math.max(timer.top, instructions.top) >
        1 &&
      Math.min(timer.right, instructions.right) -
        Math.max(timer.left, instructions.left) >
        1
    )
      problems.push("scan timer overlaps QR instructions");
    if (window.scrollY > 0) problems.push("document can scroll");
    return problems;
  });
  expect(report).toEqual([]);
}
for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 667, height: 375 },
]) {
  test(`kiosk ${viewport.width}x${viewport.height}: all steps and controls fit without scrolling`, async ({
    page,
  }) => {
    await installCamera(page);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Buka kamera", exact: true }),
    ).toBeEnabled();
    await fits(page);
    await readyCamera(page);
    await expect(
      page.getByRole("button", { name: "Mulai countdown", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".site-header, .gallery-panel")).toHaveCount(0);
    const cameraBox = await page.locator(".camera-viewport").boundingBox();
    expect(cameraBox!.width / cameraBox!.height).toBeCloseTo(
      (seeds.frames[0].slots[0].width * seeds.frames[0].dimensions.width) /
        (seeds.frames[0].slots[0].height * seeds.frames[0].dimensions.height),
      1,
    );
    expect(cameraBox!.width).toBeGreaterThan(cameraBox!.height);
    await fits(page);
    await page.getByRole("button", { name: "Privasi foto" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Privasi foto" }),
    ).toBeFocused();
    await expect(page.locator(".capture-thumbs > div")).toHaveCount(3);
    for (const box of await page.locator(".capture-thumbs > div").all()) {
      const bounds = await box.boundingBox();
      expect(bounds!.width).toBeGreaterThan(bounds!.height);
      expect(bounds!.width / bounds!.height).toBeCloseTo(
        (seeds.frames[0].slots[0].width * seeds.frames[0].dimensions.width) /
          (seeds.frames[0].slots[0].height * seeds.frames[0].dimensions.height),
        1,
      );
    }
    await page.screenshot({
      path: `.qa/kiosk-camera-${viewport.width}x${viewport.height}.png`,
    });
    await takePhotos(page);
    await fits(page);
    await page.getByRole("button", { name: "Video MP4", exact: true }).click();
    const movie = page.getByLabel("Preview video MP4");
    await expect
      .poll(() =>
        movie.evaluate((node) => (node as HTMLVideoElement).videoWidth),
      )
      .toBe(1440);
    expect(
      await movie.evaluate((node) => (node as HTMLVideoElement).videoHeight),
    ).toBe(1080);
    await fits(page);
    await page.screenshot({
      path: `.qa/kiosk-landscape-video-${viewport.width}x${viewport.height}.png`,
    });
    await page.getByRole("button", { name: "Kolase PNG", exact: true }).click();
    await page.screenshot({
      path: `.qa/kiosk-result-${viewport.width}x${viewport.height}.png`,
    });
    await expect(
      page.getByRole("heading", { name: /Demo selesai/ }),
    ).toBeVisible();
    await fits(page);
    await page.getByRole("button", { name: "Foto lagi", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Sudah menyimpan hasilmu?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ya, mulai sesi baru" }).click();
    await expect(
      page.getByRole("button", { name: "Mulai countdown", exact: true }),
    ).toBeVisible();
    await fits(page);
  });
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 667, height: 375 },
]) {
  test(`QR layout fixture ${viewport.width}x${viewport.height} fits (no live Drive upload)`, async ({
    page,
  }) => {
    await installCamera(page);
    await page.setViewportSize(viewport);
    await installResultFixture(page);
    await page.goto("/booth");

    await takePhotos(page);
    await expect(
      page.getByAltText("QR folder Google Drive kolase dan video"),
    ).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: `.qa/kiosk-qr-${viewport.width}x${viewport.height}.png`,
    });
  });
}
test("admin-selected Mint frame and resize keep controls reachable", async ({
  page,
}) => {
  await installCamera(page);
  await installActiveFrame(page, "Mint Party");
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/booth");
  await readyCamera(page);
  await expect(
    page.getByRole("button", { name: "Mulai countdown", exact: true }),
  ).toBeEnabled();

  await fits(page);
  await takePhotos(page);
  await expect(page.locator(".filter-options, .retake-grid")).toHaveCount(0);
  await fits(page);
  await page.setViewportSize({ width: 667, height: 375 });
  await fits(page);
});
