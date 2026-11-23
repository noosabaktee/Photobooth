import { api, fail } from "@/lib/errors";
import { requireAdmin, checkOrigin, throttle } from "@/lib/auth";
import { frameInput } from "@/lib/admin-api";
import { validateImage } from "@/lib/uploads";
import { renderFramePreview } from "@/lib/frame-preview";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    await requireAdmin();
    checkOrigin(request);
    throttle(request, "admin-preview", 30);
    const { input, overlay } = await frameInput(request);
    if (!overlay)
      fail(400, "OVERLAY_REQUIRED", "Overlay diperlukan untuk preview.");
    const dimensions = await validateImage(overlay, "image/png", true);
    if (
      dimensions.width !== input.dimensions.width ||
      dimensions.height !== input.dimensions.height
    )
      fail(400, "DIMENSION_MISMATCH", "Dimensi overlay tidak cocok.");
    return new Response(
      new Uint8Array(await renderFramePreview(input, overlay)),
      {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      },
    );
  });
}
