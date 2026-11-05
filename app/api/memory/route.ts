import { askJson } from "@/lib/llm";
import { editBelief, readMemory, setUsing } from "@/lib/memory";
import { requestDb } from "@/lib/session";
import { currentVisitor } from "@/lib/supabase";

// Every belief, stopped ones too, and the payments for their chips.
export async function GET() {
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json({ memory: [], payments: [] });
  return Response.json(await readMemory(db, v.accountId));
}

// Edit a belief (`text`, and `who` when answering Soul's question), or Stop Using This and Use Again (`active`).
export async function PATCH(req: Request) {
  const { id, text, who, active } = await req.json().catch(() => ({}));
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json({ status: "error", message: "Choose the data to read first." }, { status: 409 });
  const r =
    typeof active === "boolean"
      ? await setUsing(db, v.id, v.accountId, String(id ?? ""), active, askJson)
      : await editBelief(db, v.id, v.accountId, { id: String(id ?? ""), text: String(text ?? ""), answer: typeof who === "string" ? who : undefined }, askJson);
  if (r.status === "error") return Response.json(r, { status: 422 });
  return Response.json(r.status === "done" ? { ...r, ...(await readMemory(db, v.accountId)) } : r);
}
