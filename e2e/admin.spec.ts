import { test, expect } from "@playwright/test";
import path from "node:path";
import manifest from "../examples/starter-frames/starter-frames.json" with { type: "json" };
test("admin logs in, builds three slots, publishes, edits, unpublishes, archives, logs out", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/admin\/login/);
  await page.getByLabel("Kata sandi operator").fill("e2e-only-password-12345");
  await page.getByRole("button", { name: "Masuk ke studio" }).click();
  await expect(
    page.getByRole("heading", { name: "Frame studio" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add frame" }).click();
  await page.getByLabel("Nama frame").fill("E2E original three");
  await page
    .getByLabel("Upload PNG overlay")
    .setInputFiles(path.resolve("examples/starter-frames/pink-gingham-3.png"));
  for (const [i, slot] of manifest.frames[0].slots.entries()) {
    await page.getByRole("button", { name: "Tambah slot" }).click();
    for (const key of ["x", "y", "width", "height", "borderRadius"] as const)
      await page.getByLabel(key, { exact: true }).fill(String(slot[key]));
    await expect(
      page.getByRole("button", {
        name: `Slot ${i + 1}, gunakan panah untuk geser`,
      }),
    ).toBeVisible();
  }
  const first = page.getByRole("button", {
    name: "Slot 1, gunakan panah untuk geser",
  });
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("x", { exact: true })).toHaveValue("0.091");
  await page.keyboard.press("ArrowLeft");
  const box = await first.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2);
    await page.mouse.up();
    await page.getByLabel("x", { exact: true }).fill("0.09");
  }
  await page.getByRole("button", { name: "Preview komposisi" }).click();
  await expect(page.getByLabel("Preview komposisi placeholder")).toBeVisible();
  await page.screenshot({ path: ".qa/admin-builder.png", fullPage: true });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/frames\/[^/]+\/edit/);
  await page.getByRole("button", { name: "Save & publish" }).click();
  await expect(page.getByRole("status")).toContainText("Frame dipublish");
  const list = await (await page.request.get("/api/frames")).json();
  expect(
    list.frames.some((f: { name: string }) => f.name === "E2E original three"),
  ).toBe(true);
  await page.getByRole("link", { name: "Koleksi", exact: true }).click();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "E2E original three" }) });
  await card.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(card.locator(".status-pill")).toHaveText("draft");
  const unpublished = await (await page.request.get("/api/frames")).json();
  expect(
    unpublished.frames.some(
      (f: { name: string }) => f.name === "E2E original three",
    ),
  ).toBe(false);
  await card.getByRole("button", { name: "Hapus E2E original three" }).click();
  await page.getByRole("button", { name: "Ya, arsipkan" }).click();
  await expect(card.locator(".status-pill")).toHaveText("archived");
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL(/admin\/login/);
  expect((await page.request.get("/api/admin/frames")).status()).toBe(401);
});
