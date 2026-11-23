import { z } from "zod";
import { dimensionsSchema } from "./schema";
import { starterStyles } from "./starter-artwork";

// A bounded snapshot of the captured layout, never a Drive path or file ID.
export const printLayoutSchema = z
  .object({
    dimensions: dimensionsSchema,
    photoBottom: z.number().int().min(0).max(8000),
    starterStyle: z.enum(starterStyles).optional(),
  })
  .refine(
    (v) => v.photoBottom <= v.dimensions.height,
    "Batas foto tidak valid.",
  );
export type PrintLayout = z.infer<typeof printLayoutSchema>;

// Fixed layout: previews and final output never change size with URL length.
export function printGeometry(
  width: number,
  style?: PrintLayout["starterStyle"],
) {
  const qrBox = Math.floor(width * 0.4);
  const pad = Math.max(
    12,
    Math.round(width * (style === "film" ? 0.125 : 0.065)),
  );
  return { qrBox, pad, footerHeight: qrBox + pad * 2 };
}
