import { api, fail } from "@/lib/errors";
import { isAdmin } from "@/lib/auth";
import { repository } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  return api(async () => {
    const { id, kind } = await context.params;
    const version = Number(new URL(request.url).searchParams.get("v"));
    if (!Number.isInteger(version) || version < 1)
      fail(400, "VALIDATION_ERROR", "Versi aset wajib diisi.");
    const asset = await (
      await repository()
    ).asset(id, kind, version, await isAdmin());
    return new Response(new Uint8Array(asset.bytes), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
      },
    });
  });
}
