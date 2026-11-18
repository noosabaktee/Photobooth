import { api, fail } from "@/lib/errors";
import { checkOrigin, requireAdmin, throttle } from "@/lib/auth";
import { revisionSchema } from "@/lib/admin-api";
import { boundedJson } from "@/lib/uploads";
import { repository } from "@/lib/storage";
import { publicFrame } from "@/lib/schema";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  return api(async () => {
    await requireAdmin();
    checkOrigin(request);
    throttle(request, "admin-write");
    const { id, action } = await context.params;
    if (!["publish", "unpublish"].includes(action))
      fail(404, "NOT_FOUND", "Aksi tidak ditemukan.");
    const { expectedRevision } = revisionSchema.parse(
      await boundedJson(request),
    );
    const frame = await (
      await repository()
    ).status(
      id,
      action === "publish" ? "published" : "draft",
      expectedRevision,
    );
    return Response.json({ frame: { ...frame, ...publicFrame(frame) } });
  });
}
