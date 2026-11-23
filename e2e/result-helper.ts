import type { Page } from "@playwright/test";
import { printPhoto } from "../src/lib/print-photo";
import { printLayoutSchema } from "../src/lib/print-layout";
import { stampVideo } from "../src/lib/video-server";

// Test-only Drive response, never makes a Google network call.
export async function installResultFixture(page: Page, scanSeconds = 120) {
  await page.route("**/api/settings", (route) =>
    route.fulfill({ json: { scanSeconds } }),
  );
  await page.route("**/api/photos", async (route) => {
    const request = route.request();
    const form = await new Response(new Uint8Array(request.postDataBuffer()!), {
      headers: { "Content-Type": request.headers()["content-type"] },
    }).formData();
    const folderId = "test-only-layout-id";
    const viewUrl = `https://drive.google.com/drive/folders/${folderId}`;
    const bytes = Buffer.from(await (form.get("photo") as File).arrayBuffer());
    const layout = printLayoutSchema.parse(
      JSON.parse(form.get("printLayout") as string),
    );
    const final = await printPhoto(bytes, viewUrl, layout);
    const movie = await stampVideo(
      Buffer.from(await (form.get("video") as File).arrayBuffer()),
      viewUrl,
      layout.starterStyle,
    );
    await route.fulfill({
      status: 201,
      json: {
        mode: "google-drive",
        folderId,
        folderName: "test-only-session",
        viewUrl,
        photoDataUrl: `data:image/png;base64,${final.toString("base64")}`,
        videoDataUrl: `data:video/mp4;base64,${movie.toString("base64")}`,
        files: [
          { fileId: "test-png", filename: "kolase.png", mimeType: "image/png" },
          {
            fileId: "test-mp4",
            filename: "boomerang.mp4",
            mimeType: "video/mp4",
          },
        ],
      },
    });
  });
}
