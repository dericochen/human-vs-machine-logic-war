import { deleteQuestion, requireAdmin, setQuestionActive } from "@/lib/db/admin";
import { fail, ok, readJson } from "@/lib/api";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return fail("Unauthorized", 401);
  const body = await readJson(req);
  if (typeof body?.active !== "boolean") return fail("active (boolean) is required");
  try {
    await setQuestionActive(params.id, body.active);
    return ok({ id: params.id, active: body.active });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Update error", 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return fail("Unauthorized", 401);
  try {
    await deleteQuestion(params.id);
    return ok({ id: params.id, deleted: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Delete error", 500);
  }
}
