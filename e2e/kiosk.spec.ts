import { test, expect, type Page } from "@playwright/test";
import { installCamera, takePhotos } from "./camera-helper";
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
      page.getByRole("link", { name: /Mulai foto bareng/ }),
    ).toBeVisible();
    await fits(page);
    await page.getByRole("link", { name: "Cara main", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Tiga langkah/ }),
    ).toBeVisible();
    await fits(page);
    await page
      .getByRole("link", { name: "Koleksi frame", exact: true })
      .click();
    await expect(page.getByAltText("Preview Pink Gingham")).toBeVisible();
    await fits(page);
    await page.getByRole("button", { name: "Privasi foto" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Privasi foto" }),
    ).toBeFocused();
    await page.goto("/booth");
    await expect(
      page.getByRole("button", { name: "Pilih Pink Gingham" }),
    ).toBeVisible();
    await fits(page);
    await page.getByRole("button", { name: "Pilih Pink Gingham" }).click();
    await expect(
      page.getByRole("button", { name: "Buka kamera" }),
    ).toBeVisible();
    await fits(page);
    await expect(page.locator(".capture-thumbs > div")).toHaveCount(3);
    await page.screenshot({
      path: `.qa/kiosk-camera-${viewport.width}x${viewport.height}.png`,
    });
    await takePhotos(page);
    await expect(page.getByLabel("Preview hasil photo strip")).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: `.qa/kiosk-review-${viewport.width}x${viewport.height}.png`,
    });
    await page
      .getByRole("button", { name: "Simpan & bagikan", exact: true })
      .click();
    await fits(page);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Simpan ke Drive & buat QR" })
      .click();
    await expect(
      page.getByRole("heading", { name: /Demo selesai/ }),
    ).toBeVisible();
    await fits(page);
    await page.getByRole("button", { name: "Take another" }).click();
    await expect(
      page.getByRole("button", { name: "Pilih Pink Gingham" }),
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
    // Test-only response exercises the QR panel; no Google network call or live upload.
    await page.route("**/api/photos", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "google-drive",
          fileId: "test-only-layout-id",
          filename: "test.png",
          viewUrl: "https://drive.google.com/file/d/test-only-layout-id/view",
        }),
      }),
    );
    await page.goto("/booth");
    await page.getByRole("button", { name: "Pilih Pink Gingham" }).click();
    await takePhotos(page);
    await page
      .getByRole("button", { name: "Simpan & bagikan", exact: true })
      .click();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Simpan ke Drive & buat QR" })
      .click();
    await expect(
      page.getByAltText("QR link Google Drive hasil foto"),
    ).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: `.qa/kiosk-qr-${viewport.width}x${viewport.height}.png`,
    });
  });
}
test("three-photo Mint frame, pagination and resize keep controls reachable", async ({
  page,
}) => {
  await installCamera(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/booth");
  await page.getByRole("button", { name: "Frame berikutnya" }).click();
  await page.getByRole("button", { name: "Pilih Mint Party" }).click();
  await fits(page);
  await takePhotos(page);
  await expect(
    page.getByRole("button", { name: "Ulang foto 3", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".retake-grid button")).toHaveCount(3);
  await fits(page);
  await page.setViewportSize({ width: 667, height: 375 });
  await fits(page);
  await page
    .getByRole("button", { name: "Simpan & bagikan", exact: true })
    .click();
  await fits(page);
});
