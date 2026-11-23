import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  frameSchema,
  draftSchema,
  layoutSchema,
  type Frame,
  type Draft,
} from "../schema";
import { fail } from "../errors";
import { validateImage, validateAlpha } from "../uploads";
import type { Backend } from "./backend";
import { renderFramePreview } from "../frame-preview";
export class FrameRepository {
  constructor(public backend: Backend) {}
  private async entries() {
    const files = await this.backend.list("frames");
    const entries: { fileId: string; frame: Frame }[] = [];
    // Batches of six bound Drive reads; malformed metadata never becomes public.
    for (let offset = 0; offset < files.length; offset += 6) {
      const batch = await Promise.all(
        files.slice(offset, offset + 6).map(async (file) => {
          const data = await this.backend.read(file.id);
          if (data.length > 65536) return null;
          try {
            const frame = frameSchema.parse(JSON.parse(data.toString()));
            if (file.name !== `${frame.id}.json`) return null;
            if (frame.status === "published") layoutSchema.parse(frame);
            return { fileId: file.id, frame };
          } catch {
            return null;
          }
        }),
      );
      for (const entry of batch) if (entry) entries.push(entry);
    }
    return entries;
  }
  async list(admin = false) {
    return (await this.entries())
      .map((e) => e.frame)
      .filter((f) => admin || f.status === "published");
  }
  private async entry(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id))
      fail(404, "NOT_FOUND", "Frame tidak ditemukan.");
    const found = (await this.entries()).find((e) => e.frame.id === id);
    if (!found) fail(404, "NOT_FOUND", "Frame tidak ditemukan.");
    return found;
  }
  async get(id: string, admin = false) {
    const { frame } = await this.entry(id);
    if (!admin && frame.status !== "published")
      fail(404, "NOT_FOUND", "Frame tidak ditemukan.");
    return frame;
  }
  async asset(id: string, kind: string, version: number, admin = false) {
    if (!["overlay", "thumbnail"].includes(kind))
      fail(404, "NOT_FOUND", "Jenis aset tidak ditemukan.");
    const frame = await this.get(id, admin);
    const assets =
      version === frame.overlay.version
        ? frame
        : frame.assetHistory.find((a) => a.overlay.version === version);
    const asset = assets?.[kind as "overlay" | "thumbnail"];
    if (!asset) fail(404, "NOT_FOUND", "Versi aset tidak ditemukan.");
    if (kind === "thumbnail" && version === frame.overlay.version) {
      const preview = await renderFramePreview(
        frame,
        await this.backend.read(assets!.overlay.fileId),
      );
      return {
        bytes: await sharp(preview)
          .resize({ width: 360, withoutEnlargement: true })
          .webp({ quality: 86 })
          .toBuffer(),
        mimeType: "image/webp",
      };
    }
    return {
      bytes: await this.backend.read(asset.fileId),
      mimeType: asset.mimeType,
    };
  }
  async save(
    input: Draft,
    overlay?: Buffer,
    id?: string,
    expectedRevision?: number,
  ) {
    const draft = draftSchema.parse(input);
    const existing = id ? await this.entry(id) : null;
    if (existing && existing.frame.revision !== expectedRevision)
      fail(
        409,
        "REVISION_CONFLICT",
        "Frame telah berubah. Muat ulang editor sebelum menyimpan.",
      );
    if (!overlay && !existing)
      fail(400, "OVERLAY_REQUIRED", "Upload PNG overlay terlebih dahulu.");
    const frameId = id || randomUUID();
    const newAssets: string[] = [];
    let commitAttempted = false;
    const old = existing?.frame;
    const version = (old?.overlay.version || 0) + (overlay ? 1 : 0);
    try {
      if (overlay) {
        const dimensions = await validateImage(overlay, "image/png", true);
        if (
          dimensions.width !== draft.dimensions.width ||
          dimensions.height !== draft.dimensions.height
        )
          fail(400, "DIMENSION_MISMATCH", "Dimensi metadata berbeda dari PNG.");
      } else if (
        old &&
        (old.dimensions.width !== draft.dimensions.width ||
          old.dimensions.height !== draft.dimensions.height)
      )
        fail(400, "DIMENSION_MISMATCH", "Ganti PNG untuk mengubah dimensi.");
      const overlayId = overlay
        ? await this.backend.create(
            "frames",
            `${frameId}-v${version}-overlay.png`,
            "image/png",
            overlay,
          )
        : old!.overlay.fileId;
      if (overlay) newAssets.push(overlayId);
      let thumbnail = old?.thumbnail || null;
      if (overlay) {
        const thumb = await sharp(await renderFramePreview(draft, overlay))
          .resize({ width: 360, withoutEnlargement: true })
          .flatten({ background: "#dcece7" })
          .webp({ quality: 82 })
          .toBuffer();
        const thumbId = await this.backend.create(
          "frames",
          `${frameId}-v${version}-thumb.webp`,
          "image/webp",
          thumb,
        );
        newAssets.push(thumbId);
        thumbnail = { fileId: thumbId, mimeType: "image/webp" };
      }
      const now = new Date().toISOString();
      const frame = frameSchema.parse({
        ...draft,
        schemaVersion: 1,
        id: frameId,
        slug:
          draft.name
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "frame",
        status: "draft",
        revision: (old?.revision || 0) + 1,
        overlay: { fileId: overlayId, mimeType: "image/png", version },
        thumbnail,
        assetHistory: old
          ? [
              ...old.assetHistory,
              ...(overlay
                ? [{ overlay: old.overlay, thumbnail: old.thumbnail }]
                : []),
            ]
          : [],
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      const bytes = Buffer.from(JSON.stringify(frame));
      commitAttempted = true;
      if (existing) await this.backend.update(existing.fileId, bytes);
      else
        await this.backend.create(
          "frames",
          `${frameId}.json`,
          "application/json",
          bytes,
        );
      return frame;
    } catch (e) {
      // A lost metadata response may already have committed: retain assets rather than break that frame.
      if (!commitAttempted)
        await Promise.allSettled(
          newAssets.map((asset) => this.backend.remove(asset)),
        );
      else
        console.warn(
          "Frame write outcome uncertain; retain new assets for operator review.",
        );
      throw e;
    }
  }
  async status(id: string, status: Frame["status"], expectedRevision: number) {
    const { frame, fileId } = await this.entry(id);
    if (frame.revision !== expectedRevision)
      fail(409, "REVISION_CONFLICT", "Frame telah berubah. Muat ulang dahulu.");
    if (status === "published") {
      layoutSchema.parse(frame);
      if (!frame.thumbnail)
        fail(400, "INCOMPLETE_FRAME", "Thumbnail diperlukan sebelum publish.");
      const bytes = await this.backend.read(frame.overlay.fileId);
      await validateImage(bytes, "image/png", true);
      await validateAlpha(bytes, frame.slots);
    }
    const updated = {
      ...frame,
      status,
      revision: frame.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.backend.update(fileId, Buffer.from(JSON.stringify(updated)));
    return updated;
  }
}
