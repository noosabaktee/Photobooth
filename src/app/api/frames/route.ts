import { api } from "@/lib/errors";
import { repository, storageMode } from "@/lib/storage";
import { publicFrame } from "@/lib/schema";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return api(async () =>
    Response.json({
      mode: storageMode(),
      frames: (await (await repository()).list()).map(publicFrame),
    }),
  );
}
