import { test, expect } from "@playwright/test";
import { installCamera, takePhotos } from "./camera-helper";

test("self-service help supports keyboard and motion follows guest preferences", async ({
  page,
}) => {
  await installCamera(page);
  await page.goto("/");
  const help = page.getByRole("button", { name: "Cara pakai" });
  await help.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Tinggal ketuk, pose, simpan.",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("li")).toHaveCount(3);
  await expect(dialog.getByRole("heading")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(help).toBeFocused();
  await expect(dialog).not.toBeVisible();

  await page.setViewportSize({ width: 667, height: 375 });
  await help.click();
  await expect(dialog.getByRole("heading")).toBeFocused();
  expect(
    await dialog.evaluate((node) => node.scrollHeight <= node.clientHeight + 1),
  ).toBe(true);
  await page.screenshot({ path: ".qa/self-service-help-landscape.png" });
  await page.getByRole("button", { name: "Oke, mengerti" }).click();
  await expect(help).toBeFocused();

  await page.getByRole("button", { name: "Nonaktifkan animasi" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-kiosk-motion",
    "off",
  );
  await expect(
    page.getByRole("button", { name: "Aktifkan animasi" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Aktifkan animasi" }).click();
  await expect(
    page.getByRole("button", { name: "Nonaktifkan animasi" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", {
      name: "Animasi mengikuti pengaturan perangkat",
    }),
  ).toBeDisabled();
  await expect(page.locator(".site-header, .gallery-panel")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Buka kamera", exact: true }),
  ).toBeVisible();
});

test("canceling next guest preserves the result; confirming clears the session", async ({
  page,
}) => {
  await installCamera(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/booth");
  await takePhotos(page);
  await expect(
    page.getByRole("heading", { name: /Demo selesai/ }),
  ).toBeVisible();
  const photo = page.getByAltText("Hasil akhir photo strip");
  await expect(photo).toBeVisible();
  const before = await photo.getAttribute("src");
  await page.getByRole("button", { name: "Foto lagi", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sudah menyimpan hasilmu?" });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: ".qa/self-service-next-guest-mobile.png" });
  await page.getByRole("button", { name: "Kembali ke hasil" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", before!);
  await page.getByRole("button", { name: "Foto lagi", exact: true }).click();
  await page.getByRole("button", { name: "Ya, mulai sesi baru" }).click();
  await expect(
    page.getByRole("button", { name: "Mulai countdown", exact: true }),
  ).toBeVisible();
  await expect(photo).toHaveCount(0);
  await expect(page.locator(".qr, .video-preview")).toHaveCount(0);
});
