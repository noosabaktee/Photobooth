import { api, fail } from "@/lib/errors";
import { checkOrigin, throttle } from "@/lib/auth";
import { boundedForm, PHOTO_LIMIT, validateImage } from "@/lib/uploads";
import { backend, saveSession, storageMode } from "@/lib/storage";
import { validateVideo } from "@/lib/video-server";
import { BOOMERANG_VIDEO_BYTES } from "@/lib/boomerang";
import { printLayoutSchema } from "@/lib/print-layout";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    throttle(request, "photos", 10);
    const form = await boundedForm(
      request,
      PHOTO_LIMIT() + BOOMERANG_VIDEO_BYTES + 65536,
    );
    const photo = form.get("photo");
    const video = form.get("video");
    const rawLayout = form.get("printLayout");
    let printLayout;
    if (rawLayout !== null) {
      if (
        typeof rawLayout !== "string" ||
        rawLayout.length > 1024 ||
        form.getAll("printLayout").length !== 1
      )
        fail(400, "VALIDATION_ERROR", "Layout cetak tidak valid.");
      let value: unknown;
      try {
        value = JSON.parse(rawLayout);
      } catch {
        fail(400, "VALIDATION_ERROR", "Layout cetak tidak valid.");
      }
      printLayout = printLayoutSchema.parse(value);
    }
    if (form.get("consent") !== "true")
      fail(
        400,
        "CONSENT_REQUIRED",
        "Persetujuan penyimpanan publik diperlukan.",
      );
    if (!(photo instanceof File) || form.getAll("photo").length !== 1)
      fail(400, "VALIDATION_ERROR", "Kirim tepat satu foto final.");
    if (!(video instanceof File) || form.getAll("video").length !== 1)
      fail(
        400,
        "VALIDATION_ERROR",
        "Kirim tepat satu video boomerang MP4 bersama kolase.",
      );
    const bytes = Buffer.from(await photo.arrayBuffer());
    const dimensions = await validateImage(bytes, photo.type);
    if (
      printLayout &&
      (printLayout.dimensions.width !== dimensions.width ||
        printLayout.dimensions.height !== dimensions.height)
    )
      fail(
        400,
        "VALIDATION_ERROR",
        "Dimensi layout cetak tidak cocok dengan kolase.",
      );
    const movie = Buffer.from(await video.arrayBuffer());
    await validateVideo(movie, video.type);
    return Response.json(
      await saveSession(
        await backend(),
        storageMode(),
        bytes,
        photo.type,
        movie,
        printLayout,
      ),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  });
}
