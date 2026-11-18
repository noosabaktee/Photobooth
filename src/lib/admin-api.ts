import { z } from "zod";
import { boundedForm, OVERLAY_LIMIT } from "./uploads";
import { draftSchema } from "./schema";
import { fail } from "./errors";
export async function frameInput(request: Request) {
  const form = await boundedForm(request, OVERLAY_LIMIT() + 65536);
  const raw = form.get("metadata");
  if (typeof raw !== "string" || raw.length > 60000)
    fail(400, "VALIDATION_ERROR", "Metadata frame tidak valid.");
  let metadata: unknown;
  try {
    metadata = JSON.parse(raw);
  } catch {
    return fail(400, "VALIDATION_ERROR", "Metadata JSON tidak valid.");
  }
  const input = draftSchema.parse(metadata);
  const expectedRevision = z
    .object({ expectedRevision: z.number().int().positive().optional() })
    .parse(metadata).expectedRevision;
  const file = form.get("overlay");
  if (file && (!(file instanceof File) || file.type !== "image/png"))
    fail(415, "UNSUPPORTED_TYPE", "Overlay wajib PNG.");
  return {
    input,
    expectedRevision,
    overlay:
      file instanceof File ? Buffer.from(await file.arrayBuffer()) : undefined,
  };
}
export const revisionSchema = z.object({
  expectedRevision: z.number().int().positive(),
});
