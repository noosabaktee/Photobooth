import { api } from "@/lib/errors";
import { requireAdmin, checkOrigin, throttle } from "@/lib/auth";
import { frameInput, revisionSchema } from "@/lib/admin-api";
import { boundedJson } from "@/lib/uploads";
import { repository } from "@/lib/storage";
import { publicFrame } from "@/lib/schema";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(_request: Request, context: Context) {
  return api(async () => {
    await requireAdmin();
    const frame = await (
      await repository()
    ).get((await context.params).id, true);
    return Response.json({ frame: { ...frame, ...publicFrame(frame) } });
  });
}
export async function PATCH(request: Request, context: Context) {
  return api(async () => {
    await requireAdmin();
    checkOrigin(request);
    throttle(request, "admin-write");
    const { input, overlay, expectedRevision } = await frameInput(request);
    const frame = await (
      await repository()
    ).save(input, overlay, (await context.params).id, expectedRevision);
    return Response.json({ frame: { ...frame, ...publicFrame(frame) } });
  });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => {
    await requireAdmin();
    checkOrigin(request);
    const { expectedRevision } = revisionSchema.parse(
      await boundedJson(request),
    );
    await (
      await repository()
    ).status((await context.params).id, "archived", expectedRevision);
    return new Response(null, { status: 204 });
  });
}
