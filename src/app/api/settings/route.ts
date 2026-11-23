import { api } from "@/lib/errors";
import { backend } from "@/lib/storage";
import { SettingsRepository } from "@/lib/storage/settings";
export const runtime = "nodejs";
export async function GET() {
  return api(async () => {
    const { scanSeconds } = await new SettingsRepository(await backend()).get();
    return Response.json({ scanSeconds });
  });
}
