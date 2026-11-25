import { getLeaderboard } from "@/lib/db/queries";
import { LEADERBOARD_WINDOWS, type LeaderboardWindow } from "@/lib/game";
import { fail, ok } from "@/lib/api";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const window = url.searchParams.get("window") as LeaderboardWindow | null;
  const w: LeaderboardWindow = window && LEADERBOARD_WINDOWS.includes(window as LeaderboardWindow) ? (window as LeaderboardWindow) : "all";
  try {
    const rows = await getLeaderboard(w);
    return ok({ window: w, rows });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Leaderboard error", 500);
  }
}
