import { z } from "zod";

export const categories = [
  "pastel",
  "vintage",
  "birthday",
  "event",
  "minimal",
  "other",
] as const;
const unit = z.number().finite().min(0).max(1);
export const slotSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  order: z.number().int().min(0).max(5),
  x: unit,
  y: unit,
  width: unit.gt(0),
  height: unit.gt(0),
  borderRadius: unit.max(0.5).optional(),
  cropPosition: z.object({ x: unit, y: unit }).optional(),
});
export const dimensionsSchema = z
  .object({
    width: z.number().int().min(200).max(8000),
    height: z.number().int().min(200).max(8000),
  })
  .refine(
    (d) =>
      d.width * d.height <= 30_000_000 &&
      Math.max(d.width / d.height, d.height / d.width) <= 8,
    "Dimensi maksimal 30 MP dan rasio 1:8.",
  );
export const draftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(categories),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
  dimensions: dimensionsSchema,
  slots: z.array(slotSchema).max(6),
});
export const layoutSchema = draftSchema.superRefine((frame, ctx) => {
  const error = (message: string) =>
    ctx.addIssue({ code: "custom", message, path: ["slots"] });
  if (!frame.slots.length) error("Tambahkan minimal satu slot.");
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const s of frame.slots) {
    if (s.x + s.width > 1.000001 || s.y + s.height > 1.000001)
      error("Slot berada di luar frame.");
    if (ids.has(s.id) || orders.has(s.order))
      error("ID dan urutan slot harus unik.");
    ids.add(s.id);
    orders.add(s.order);
  }
  if (frame.slots.some((s) => s.order >= frame.slots.length))
    error("Urutan harus berkelanjutan mulai 0.");
  frame.slots.forEach((a, i) =>
    frame.slots.slice(i + 1).forEach((b) => {
      const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (w * frame.dimensions.width > 1 && h * frame.dimensions.height > 1)
        error("Slot tidak boleh tumpang tindih.");
    }),
  );
});
const overlaySchema = z.object({
  fileId: z.string().min(1).max(200),
  mimeType: z.literal("image/png"),
  version: z.number().int().positive(),
});
const thumbSchema = z.object({
  fileId: z.string().min(1).max(200),
  mimeType: z.literal("image/webp"),
});
export const frameSchema = draftSchema.extend({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(100),
  status: z.enum(["draft", "published", "archived"]),
  revision: z.number().int().positive(),
  overlay: overlaySchema,
  thumbnail: thumbSchema.nullable(),
  assetHistory: z
    .array(
      z.object({ overlay: overlaySchema, thumbnail: thumbSchema.nullable() }),
    )
    .max(100)
    .default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Slot = z.infer<typeof slotSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type Frame = z.infer<typeof frameSchema>;
export type PublicFrame = Pick<
  Frame,
  "id" | "name" | "category" | "tags" | "dimensions" | "slots" | "revision"
> & { overlayUrl: string; thumbnailUrl: string | null };
export function publicFrame(f: Frame): PublicFrame {
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    tags: f.tags,
    dimensions: f.dimensions,
    slots: f.slots,
    revision: f.revision,
    overlayUrl: `/api/frames/${f.id}/asset/overlay?v=${f.overlay.version}`,
    thumbnailUrl: f.thumbnail
      ? `/api/frames/${f.id}/asset/thumbnail?v=${f.overlay.version}`
      : null,
  };
}
