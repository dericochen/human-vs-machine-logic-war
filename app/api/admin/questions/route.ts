import { generateAndInsert, listQuestions, requireAdmin } from "@/lib/db/admin";
import { fail, ok, readJson } from "@/lib/api";
import { DIFFICULTY_ORDER, type Difficulty } from "@/lib/game";

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return fail("Unauthorized", 401);
  const url = new URL(req.url);
  const difficulty = (url.searchParams.get("difficulty") as Difficulty | null) ?? "all";
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 25));
  if (difficulty !== "all" && !DIFFICULTY_ORDER.includes(difficulty)) return fail("Invalid difficulty");
  try {
    return ok(await listQuestions(difficulty as Difficulty | "all", offset, limit));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "List error", 500);
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return fail("Unauthorized", 401);
  const body = await readJson(req);
  const difficulty = (typeof body?.difficulty === "string" ? body.difficulty : "") as Difficulty;
  if (!DIFFICULTY_ORDER.includes(difficulty)) return fail("Invalid difficulty");
  try {
    const round = await generateAndInsert(difficulty);
    return ok({ id: round.id, cells: round.cells, oddIndex: round.oddIndex });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Generate error", 500);
  }
}
