import { api } from "@/lib/errors";
import { repository } from "@/lib/storage";
import { publicFrame } from "@/lib/schema";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () =>
    Response.json({
      frame: publicFrame(
        await (await repository()).get((await context.params).id),
      ),
    }),
  );
}
