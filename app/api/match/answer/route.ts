import { submitAnswer } from "@/lib/db/match-service";
import { fail, ok, readJson } from "@/lib/api";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("Invalid body");

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const index = typeof body.index === "number" ? body.index : -1;
  const cellIndex = typeof body.cellIndex === "number" ? body.cellIndex : null;

  if (!sessionId || index < 0) return fail("sessionId and index are required");

  try {
    const result = await submitAnswer({ sessionId, index, cellIndex });
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to submit answer";
    return fail(msg, msg.includes("stale") || msg.includes("not active") ? 409 : 500);
  }
}
