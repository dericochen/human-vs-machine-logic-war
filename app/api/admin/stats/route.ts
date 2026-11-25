import { getAdminStats, requireAdmin } from "@/lib/db/admin";
import { fail, ok } from "@/lib/api";

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return fail("Unauthorized", 401);
  try {
    return ok(await getAdminStats());
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Stats error", 500);
  }
}
