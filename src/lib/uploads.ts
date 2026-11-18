import sharp from "sharp";
import { fail } from "./errors";
import type { Slot } from "./schema";
export const PHOTO_LIMIT = () =>
  Math.min(
    12 * 1024 * 1024,
    Number(process.env.MAX_FINAL_PHOTO_BYTES) || 12 * 1024 * 1024,
  );
export const OVERLAY_LIMIT = () =>
  Math.min(
    8 * 1024 * 1024,
    Number(process.env.MAX_FRAME_OVERLAY_BYTES) || 8 * 1024 * 1024,
  );
export async function boundedForm(request: Request, max: number) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    fail(415, "UNSUPPORTED_TYPE", "Gunakan multipart/form-data.");
  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > max)
    fail(413, "FILE_TOO_LARGE", "Ukuran upload melewati batas.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "VALIDATION_ERROR", "Body kosong.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > max) {
      await reader.cancel();
      fail(413, "FILE_TOO_LARGE", "Ukuran upload melewati batas.");
    }
    chunks.push(part.value);
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Multipart tidak valid.");
  }
}
export async function boundedJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "UNSUPPORTED_TYPE", "Gunakan application/json.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "VALIDATION_ERROR", "Body kosong.");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const p = await reader.read();
    if (p.done) break;
    size += p.value.length;
    if (size > 65536) {
      await reader.cancel();
      fail(413, "FILE_TOO_LARGE", "JSON terlalu besar.");
    }
    parts.push(p.value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString()) as unknown;
  } catch {
    return fail(400, "VALIDATION_ERROR", "JSON tidak valid.");
  }
}
export async function validateImage(
  bytes: Buffer,
  mime: string,
  overlay = false,
) {
  if (
    !bytes.length ||
    bytes.length > (overlay ? OVERLAY_LIMIT() : PHOTO_LIMIT())
  )
    fail(413, "FILE_TOO_LARGE", "Gambar kosong atau melebihi batas upload.");
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!(
    (png && mime === "image/png") ||
    (!overlay && jpg && mime === "image/jpeg")
  ))
    fail(
      415,
      "UNSUPPORTED_TYPE",
      "Signature gambar tidak sesuai. Gunakan PNG transparan untuk overlay, PNG/JPEG untuk foto.",
    );
  try {
    const parser = sharp(bytes, {
      limitInputPixels: Math.min(
        30_000_000,
        Number(process.env.MAX_FRAME_PIXEL_COUNT) || 30_000_000,
      ),
      failOn: "warning",
    });
    const metadata = await parser.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width < 200 ||
      metadata.height < 200 ||
      metadata.width > 8000 ||
      metadata.height > 8000 ||
      (metadata.pages || 1) > 1
    )
      fail(
        400,
        "VALIDATION_ERROR",
        "Dimensi gambar 200–8000 px, maksimal 30 MP, satu halaman.",
      );
    if (overlay && !metadata.hasAlpha)
      fail(400, "INVALID_ALPHA", "Overlay harus memiliki transparansi PNG.");
    await parser.stats(); // force full decode, rejecting corrupt/truncated data
    return { width: metadata.width, height: metadata.height };
  } catch (e) {
    if (e instanceof Error && "status" in e) throw e;
    return fail(
      400,
      "INVALID_IMAGE",
      "Gambar rusak, terlalu besar, atau tidak bisa dibaca.",
    );
  }
}
export async function validateAlpha(bytes: Buffer, slots: Slot[]) {
  const { data, info } = await sharp(bytes, { limitInputPixels: 30_000_000 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (const slot of slots) {
    let clear = 0;
    const n = 11;
    for (let row = 0; row < n; row++)
      for (let col = 0; col < n; col++) {
        const x = Math.min(
          info.width - 1,
          Math.floor(
            (slot.x + slot.width * (0.08 + (0.84 * col) / (n - 1))) *
              info.width,
          ),
        );
        const y = Math.min(
          info.height - 1,
          Math.floor(
            (slot.y + slot.height * (0.08 + (0.84 * row) / (n - 1))) *
              info.height,
          ),
        );
        if (data[(y * info.width + x) * 4 + 3] < 32) clear++;
      }
    if (clear / (n * n) < 0.95)
      fail(
        400,
        "INVALID_ALPHA",
        `Area foto ${slot.order + 1} tertutup overlay. Perbaiki PNG atau posisi slot.`,
      );
  }
}
