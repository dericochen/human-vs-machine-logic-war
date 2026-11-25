import { requireAdmin } from "@/lib/db/admin";
import { getServiceClient, isSupabaseConfigured } from "@/lib/db/client";
import { DIALOGUES, TOTAL_DIALOGUE_COUNT } from "@/lib/game";
import { fail, ok } from "@/lib/api";

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return fail("Unauthorized", 401);
  const logs = [];
  if (isSupabaseConfigured()) {
    const { data } = await getServiceClient()
      .from("machine_personality_logs")
      .select("trigger, line, emotion, confidence, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    logs.push(...(data ?? []));
  }
  return ok({ total: TOTAL_DIALOGUE_COUNT, dialogues: DIALOGUES, logs });
}
