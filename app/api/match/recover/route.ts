import { recoverMatch } from "@/lib/db/match-service";
import { fail, ok, readJson } from "@/lib/api";

export async function POST(req: Request) {
  const body = await readJson(req);
  const sessionId = typeof body?.sessionId === "string" ? (body.sessionId as string) : "";
  if (!sessionId) return fail("sessionId is required");

  try {
    const result = await recoverMatch(sessionId);
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to recover match", 404);
  }
}
