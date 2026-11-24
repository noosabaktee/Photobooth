import { api, AppError, fail } from "@/lib/errors";
import { backend } from "@/lib/storage";
import { SettingsRepository } from "@/lib/storage/settings";
import { FrameRepository } from "@/lib/storage/repository";
import { publicFrame } from "@/lib/schema";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return api(async () => {
    const store = await backend();
    const { scanSeconds, activeFrameId } = await new SettingsRepository(
      store,
    ).get();
    const frames = new FrameRepository(store);
    const frame = activeFrameId
      ? await frames.get(activeFrameId).catch((error: unknown) => {
          if (error instanceof AppError && error.status === 404)
            fail(
              503,
              "NO_ACTIVE_FRAME",
              "Template aktif tidak tersedia. Hubungi pengelola untuk memilih template published pengganti.",
            );
          throw error;
        })
      : (await frames.list())[0];
    if (!frame)
      fail(
        503,
        "NO_ACTIVE_FRAME",
        "Belum ada template aktif. Hubungi pengelola untuk publish dan memilih template booth.",
      );
    return Response.json({ scanSeconds, frame: publicFrame(frame) });
  });
}
