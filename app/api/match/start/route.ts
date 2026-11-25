import { startMatch } from "@/lib/db/match-service";
import { fail, ok, readJson } from "@/lib/api";
import type { MaxMode } from "@/lib/game";

const MAX_MODES: MaxMode[] = ["easy", "normal", "hard", "expert"];

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("Invalid body");

  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const playerName = (typeof body.playerName === "string" ? body.playerName : "").trim().slice(0, 24);
  const avatar = typeof body.avatar === "string" ? body.avatar.slice(0, 8) : "";
  const maxMode = (typeof body.maxMode === "string" ? body.maxMode : "normal") as MaxMode;

  if (!playerId || !playerName) return fail("playerId and playerName are required");
  if (!MAX_MODES.includes(maxMode)) return fail("Invalid maxMode");

  try {
    const result = await startMatch({ playerId, playerName, avatar, maxMode });
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to start match", 500);
  }
}
