import { getGlobalStats } from "@/lib/db/queries";
import { fail, ok } from "@/lib/api";

export const revalidate = 0;

export async function GET() {
  try {
    const stats = await getGlobalStats();
    return ok(stats);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Stats error", 500);
  }
}
