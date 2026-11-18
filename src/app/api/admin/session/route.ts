import { api } from "@/lib/errors";
import { isAdmin } from "@/lib/auth";
export async function GET() {
  return api(async () => Response.json({ authenticated: await isAdmin() }));
}
