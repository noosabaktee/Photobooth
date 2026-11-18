import { FrameRepository } from "./repository";
import { MockBackend } from "./mock";
import { GoogleDriveBackend } from "./google-drive";
import { fail } from "../errors";
import { randomUUID } from "node:crypto";
import type { Backend } from "./backend";
export function storageMode(): "mock" | "google-drive" {
  const mode = process.env.STORAGE_MODE || "mock";
  if (mode !== "mock" && mode !== "google-drive")
    fail(503, "INVALID_CONFIG", "STORAGE_MODE harus mock atau google-drive.");
  return mode;
}
const shared = globalThis as typeof globalThis & {
  snapstripMock?: Promise<MockBackend>;
};
export async function backend() {
  if (storageMode() === "google-drive") return new GoogleDriveBackend();
  return (shared.snapstripMock ??= MockBackend.seeded());
}
export async function repository() {
  return new FrameRepository(await backend());
}
export async function savePhoto(
  store: Backend,
  mode: "mock" | "google-drive",
  bytes: Buffer,
  mime: string,
) {
  const filename = `photobooth-${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${mime === "image/png" ? "png" : "jpg"}`;
  // Mock exercises validation/upload flow without retaining personal photo bytes server-side.
  if (mode === "mock")
    return {
      mode: "mock" as const,
      filename,
      message:
        "DEMO: foto tidak disimpan ke Drive. Download hasil secara lokal.",
    };
  const fileId = await store.create("photos", filename, mime, bytes);
  try {
    return {
      mode: "google-drive" as const,
      fileId,
      filename,
      ...(await store.share(fileId)),
    };
  } catch {
    await store
      .remove(fileId)
      .catch(() => console.warn("Photo cleanup requires operator attention."));
    return fail(
      503,
      "SHARING_FAILED",
      "Upload atau izin publik Drive gagal. Tidak ada QR. Download lokal atau coba lagi.",
    );
  }
}
