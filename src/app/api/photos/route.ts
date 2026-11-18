import { api, fail } from "@/lib/errors";
import { checkOrigin, throttle } from "@/lib/auth";
import { boundedForm, PHOTO_LIMIT, validateImage } from "@/lib/uploads";
import { backend, savePhoto, storageMode } from "@/lib/storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    throttle(request, "photos", 10);
    const form = await boundedForm(request, PHOTO_LIMIT() + 65536);
    const photo = form.get("photo");
    if (form.get("consent") !== "true")
      fail(
        400,
        "CONSENT_REQUIRED",
        "Persetujuan penyimpanan publik diperlukan.",
      );
    if (!(photo instanceof File) || form.getAll("photo").length !== 1)
      fail(400, "VALIDATION_ERROR", "Kirim tepat satu foto final.");
    const bytes = Buffer.from(await photo.arrayBuffer());
    await validateImage(bytes, photo.type);
    return Response.json(
      await savePhoto(await backend(), storageMode(), bytes, photo.type),
      { status: 201 },
    );
  });
}
