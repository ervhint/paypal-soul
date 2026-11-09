import { deletePreference, tellAbout } from "@/lib/about";
import type { Result } from "@/lib/correct";
import { askJson } from "@/lib/llm";
import { editBelief, readMemory, setUsing } from "@/lib/memory";
import { requestDb } from "@/lib/session";
import { currentVisitor } from "@/lib/supabase";

const NO_DATA = { status: "error", message: "Choose the data to read first." };

/** The person and their data in use, or null before they chose any. */
async function visitor() {
  const db = await requestDb();
  const v = await currentVisitor(db);
  return v?.accountId ? { db, personId: v.id, accountId: v.accountId } : null;
}

/** A change's reply: the error, Soul's question, or the whole memory as it is now. */
async function reply(r: Result, db: Awaited<ReturnType<typeof requestDb>>, accountId: string) {
  if (r.status === "error") return Response.json(r, { status: 422 });
  return Response.json(r.status === "done" ? { ...r, ...(await readMemory(db, accountId)) } : r);
}

// Every belief, stopped ones too, and the payments for their chips.
export async function GET() {
  const v = await visitor();
  if (!v) return Response.json({ memory: [], payments: [] });
  return Response.json(await readMemory(v.db, v.accountId));
}

// Tell Soul About You (U19): `text`, saved as a preference in the person's own words.
export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({}));
  const v = await visitor();
  if (!v) return Response.json(NO_DATA, { status: 409 });
  return reply(await tellAbout(v.db, v.personId, v.accountId, text, askJson), v.db, v.accountId);
}

// Edit a belief (`text`, and `who` when answering Soul's question), or Stop Using This and Use Again (`active`).
export async function PATCH(req: Request) {
  const { id, text, who, active } = await req.json().catch(() => ({}));
  const v = await visitor();
  if (!v) return Response.json(NO_DATA, { status: 409 });
  const r =
    typeof active === "boolean"
      ? await setUsing(v.db, v.personId, v.accountId, String(id ?? ""), active, askJson)
      : await editBelief(v.db, v.personId, v.accountId, { id: String(id ?? ""), text: String(text ?? ""), answer: typeof who === "string" ? who : undefined }, askJson);
  return reply(r, v.db, v.accountId);
}

// Delete something the person told Soul about themselves (U19). Other beliefs are stopped, not deleted.
export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  const v = await visitor();
  if (!v) return Response.json(NO_DATA, { status: 409 });
  return reply(await deletePreference(v.db, v.personId, v.accountId, String(id ?? ""), askJson), v.db, v.accountId);
}
