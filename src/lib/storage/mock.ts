import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import manifest from "../../../examples/starter-frames/starter-frames.json" with { type: "json" };
import type { Backend, Folder, StoredFile } from "./backend";
import { frameSchema } from "../schema";
import { fail } from "../errors";
export class MockBackend implements Backend {
  files = new Map<string, StoredFile & { folder: string; bytes: Buffer }>();
  async list(folder: Folder) {
    return [...this.files.values()]
      .filter((f) => f.folder === folder && f.mimeType === "application/json")
      .map(({ id, name, mimeType }) => ({ id, name, mimeType }));
  }
  async read(id: string) {
    const file = this.files.get(id);
    if (!file) fail(404, "NOT_FOUND", "Aset tidak ditemukan.");
    return file.bytes;
  }
  async create(folder: Folder, name: string, mimeType: string, bytes: Buffer) {
    return this.createInFolder(folder, name, mimeType, bytes);
  }
  async createInFolder(
    folder: string,
    name: string,
    mimeType: string,
    bytes: Buffer,
  ) {
    const id = randomUUID();
    this.files.set(id, { id, name, mimeType, bytes, folder });
    return id;
  }
  async createFolder(folder: Folder, name: string) {
    return this.create(
      folder,
      name,
      "application/vnd.google-apps.folder",
      Buffer.alloc(0),
    );
  }
  async assertPublic(id: string): Promise<void> {
    void id;
    fail(503, "DEMO_ONLY", "Mode demo tidak membagikan hasil ke Drive.");
  }
  async update(id: string, bytes: Buffer) {
    const file = this.files.get(id);
    if (!file) fail(404, "NOT_FOUND", "File tidak ditemukan.");
    file.bytes = bytes;
  }
  async remove(id: string) {
    this.files.delete(id);
  }
  async share(
    id: string,
  ): Promise<{ viewUrl: string; downloadUrl: string | null }> {
    void id;
    return fail(503, "DEMO_ONLY", "Mode demo tidak membuat link Drive.");
  }
  static async seeded() {
    const backend = new MockBackend();
    for (const [index, seed] of manifest.frames.entries()) {
      const overlay = await readFile(
        path.join(process.cwd(), "examples/starter-frames", seed.overlayPath),
      );
      const preview = await readFile(
        path.join(process.cwd(), "examples/starter-frames", seed.thumbnailPath),
      );
      const id = `00000000-0000-4000-8000-00000000000${index + 1}`;
      const overlayId = await backend.create(
        "frames",
        `${id}-v1-overlay.png`,
        "image/png",
        overlay,
      );
      const thumbId = await backend.create(
        "frames",
        `${id}-v1-thumb.webp`,
        "image/webp",
        await sharp(preview).webp().toBuffer(),
      );
      const now = new Date().toISOString();
      const frame = frameSchema.parse({
        ...seed,
        id,
        schemaVersion: 1,
        slug: seed.name.toLowerCase().replaceAll(" ", "-"),
        tags: ["starter"],
        status: "published",
        revision: 1,
        overlay: { fileId: overlayId, mimeType: "image/png", version: 1 },
        thumbnail: { fileId: thumbId, mimeType: "image/webp" },
        createdAt: now,
        updatedAt: now,
      });
      await backend.create(
        "frames",
        `${id}.json`,
        "application/json",
        Buffer.from(JSON.stringify(frame)),
      );
    }
    return backend;
  }
}
