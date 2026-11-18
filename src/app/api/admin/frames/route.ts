import { api } from "@/lib/errors";
import { checkOrigin, requireAdmin, throttle } from "@/lib/auth";
import { frameInput } from "@/lib/admin-api";
import { repository } from "@/lib/storage";
import { publicFrame } from "@/lib/schema";
export const runtime = "nodejs";
export async function GET() {
  return api(async () => {
    await requireAdmin();
    return Response.json({
      frames: (await (await repository()).list(true)).map((f) => ({
        ...f,
        ...publicFrame(f),
      })),
    });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    await requireAdmin();
    checkOrigin(request);
    throttle(request, "admin-write");
    const { input, overlay } = await frameInput(request);
    const frame = await (await repository()).save(input, overlay);
    return Response.json(
      { frame: { ...frame, ...publicFrame(frame) } },
      { status: 201 },
    );
  });
}
