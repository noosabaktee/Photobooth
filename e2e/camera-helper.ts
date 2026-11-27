import { expect, type Page } from "@playwright/test";

// Test-only operator selection; production guests have no frame selector.
export async function installActiveFrame(
  page: Page,
  name: string,
  scanSeconds = 120,
) {
  await page.route("**/api/settings", async (route) => {
    const response = await page.request.get("/api/frames");
    const { frames } = await response.json();
    const frame = frames.find((f: { name: string }) => f.name === name);
    if (!frame) throw new Error(`Missing fixture frame: ${name}`);
    await route.fulfill({ json: { scanSeconds, frame } });
  });
}

// Browser-only synthetic stream: test photos never pass through a file picker.
export async function installCamera(page: Page) {
  await page.addInitScript(() => {
    const metrics = window as unknown as { testCameraCalls: number };
    metrics.testCameraCalls = 0;
    const timer = window.setTimeout.bind(window);
    window.setTimeout = ((
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) =>
      timer(
        handler,
        delay === 1000 || delay === 500 || delay === 350 ? 30 : delay,
        ...args,
      )) as typeof window.setTimeout;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (constraints: MediaStreamConstraints) => {
        (
          window as unknown as { testCameraConstraints: MediaStreamConstraints }
        ).testCameraConstraints = constraints;
        metrics.testCameraCalls++;
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

export async function readyCamera(page: Page) {
  await expect(page.locator(".camera-toolbar")).toBeVisible();
  const open = page.getByRole("button", { name: "Buka kamera", exact: true });
  if (await open.isVisible()) await open.click();
  await expect(
    page.getByRole("button", { name: "Mulai countdown", exact: true }),
  ).toBeEnabled();
}

export async function takePhotos(page: Page) {
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await readyCamera(page);
  await expect(
    page.getByRole("button", { name: "Mulai countdown", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", {
      name: "Mulai countdown",
      exact: true,
    })
    .click();
  // Short landscape prioritizes the large QR and intentionally hides the strip.
  await expect(page.locator(".result-card > h2")).toBeVisible({
    timeout: 60000,
  });
}
