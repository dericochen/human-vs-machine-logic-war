import { startMatch } from "@/lib/db/match-service";
import { fail, ok, readJson } from "@/lib/api";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("Invalid body");

  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const playerName = (typeof body.playerName === "string" ? body.playerName : "").trim().slice(0, 24);
  const avatar = typeof body.avatar === "string" ? body.avatar.slice(0, 8) : "";

  if (!playerId || !playerName) return fail("playerId and playerName are required");

  try {
    // M.A.X. always plays at maximum ability; the player only provides identity.
    const result = await startMatch({ playerId, playerName, avatar });
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to start match", 500);
  }
}
