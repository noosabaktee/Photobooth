import { api } from "@/lib/errors";
import { backend } from "@/lib/storage";
import { SettingsRepository } from "@/lib/storage/settings";
import { requireAdmin, checkOrigin, throttle } from "@/lib/auth";
import { boundedJson } from "@/lib/uploads";
export const runtime = "nodejs";
export async function GET() {
  return api(async () => {
    await requireAdmin();
    return Response.json({
      settings: await new SettingsRepository(await backend()).get(),
    });
  });
}
export async function PUT(request: Request) {
  return api(async () => {
    await requireAdmin();
    checkOrigin(request);
    throttle(request, "admin-settings", 20);
    const input = await boundedJson(request);
    return Response.json({
      settings: await new SettingsRepository(await backend()).save(input),
    });
  });
}
