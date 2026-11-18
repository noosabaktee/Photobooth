import { api, fail } from "@/lib/errors";
import { checkOrigin, throttle } from "@/lib/auth";
import { boundedForm } from "@/lib/uploads";
import { BOOMERANG_IMAGE_BYTES } from "@/lib/boomerang";
import { encodeBoomerang } from "@/lib/video-server";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    throttle(request, "boomerang", 10);
    const form = await boundedForm(request, 6 * BOOMERANG_IMAGE_BYTES + 65536);
    if (form.get("processingConsent") !== "true")
      fail(
        400,
        "CONSENT_REQUIRED",
        "Izinkan pemrosesan video sementara terlebih dahulu.",
      );
    const frames = form.getAll("frames");
    if (
      frames.length < 1 ||
      frames.length > 6 ||
      frames.some((f) => !(f instanceof File) || f.type !== "image/jpeg")
    )
      fail(400, "VALIDATION_ERROR", "Kirim 1–6 foto video JPEG.");
    const bytes: Buffer[] = [];
    for (const frame of frames as File[])
      bytes.push(Buffer.from(await frame.arrayBuffer()));
    const video = await encodeBoomerang(bytes);
    return new Response(new Uint8Array(video), {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store",
        "Content-Disposition":
          'attachment; filename="hoya-hoya-days-kmi-boomerang.mp4"',
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
