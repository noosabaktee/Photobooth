import { FrameRepository } from "./repository";
import { MockBackend } from "./mock";
import { GoogleDriveBackend } from "./google-drive";
import { fail } from "../errors";
import { randomUUID } from "node:crypto";
import type { Backend } from "./backend";
import { driveFolderUrl } from "../urls";
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
export async function saveSession(
  store: Backend,
  mode: "mock" | "google-drive",
  bytes: Buffer,
  mime: string,
  video: Buffer,
) {
  const folderName = `Hoya-Hoya-${new Date().toISOString().slice(0, 10)}-${randomUUID()}`;
  const filename = `kolase.${mime === "image/png" ? "png" : "jpg"}`;
  const videoFilename = "boomerang.mp4";
  // Mock exercises validation/upload flow without retaining personal photo bytes server-side.
  if (mode === "mock")
    return {
      mode: "mock" as const,
      filename,
      videoFilename,
      message:
        "DEMO: kolase dan video tidak disimpan ke Drive. Download hasil secara lokal.",
    };
  let folderId: string | undefined;
  const created: string[] = [];
  try {
    folderId = await store.createFolder("photos", folderName);
    const photoId = await store.createInFolder(folderId, filename, mime, bytes);
    created.push(photoId);
    const videoId = await store.createInFolder(
      folderId,
      videoFilename,
      "video/mp4",
      video,
    );
    created.push(videoId);
    // Publish only after BOTH files exist. Folder inheritance grants access to its children.
    const shared = await store.share(folderId, "folder");
    if (!driveFolderUrl(shared.viewUrl, folderId))
      throw new Error("Invalid folder link");
    await store.assertPublic(photoId);
    await store.assertPublic(videoId);
    return {
      mode: "google-drive" as const,
      folderId,
      folderName,
      viewUrl: shared.viewUrl,
      files: [
        { fileId: photoId, filename, mimeType: mime },
        { fileId: videoId, filename: videoFilename, mimeType: "video/mp4" },
      ],
    };
  } catch {
    // Hide the folder first, then clean all known child files, even after partial upload.
    for (const id of [...(folderId ? [folderId] : []), ...created])
      await store
        .remove(id)
        .catch(() =>
          console.warn("Result cleanup requires operator attention."),
        );
    return fail(
      503,
      "SHARING_FAILED",
      "Upload kolase/video atau izin publik folder Drive gagal. Tidak ada QR. Download lokal atau coba lagi.",
    );
  }
}
