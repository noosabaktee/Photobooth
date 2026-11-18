import { expect, type Page } from "@playwright/test";

// Browser-only synthetic stream: test photos never pass through a file picker.
export async function installCamera(page: Page) {
  await page.addInitScript(() => {
    const timer = window.setTimeout.bind(window);
    window.setTimeout = ((
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) =>
      timer(
        handler,
        delay === 1000 || delay === 350 ? 30 : delay,
        ...args,
      )) as typeof window.setTimeout;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "rgb(220,30,30)";
        ctx.fillRect(0, 0, 400, 600);
        ctx.fillStyle = "rgb(20,40,220)";
        ctx.fillRect(400, 0, 400, 600);
        return canvas.captureStream(10);
      },
    });
    Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
      value: async () => [],
    });
  });
}

export async function takePhotos(page: Page, retake = false) {
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Buka kamera" }).click();
  await page
    .getByRole("button", {
      name: retake ? "Ambil ulang foto" : "Mulai countdown",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Preview hasil photo strip")).toBeVisible();
}
