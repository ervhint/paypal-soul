import { confirm, correct, undoCorrection } from "@/lib/correct";
import { askJson } from "@/lib/llm";
import { requestDb } from "@/lib/session";
import { currentVisitor } from "@/lib/supabase";

const NO_DATA = { status: "error", message: "Choose the data to read first." };

// That's Not Right: the correction, a clarifying question when it names nobody, then the rewritten chapter.
export async function POST(req: Request) {
  const { claimId, text, who } = await req.json().catch(() => ({}));
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json(NO_DATA, { status: 409 });
  const r = await correct(db, v.id, v.accountId, { claimId: String(claimId ?? ""), said: String(text ?? ""), answer: typeof who === "string" ? who : undefined }, askJson);
  return Response.json(r, { status: r.status === "error" ? 422 : 200 });
}

// Looks Right: the sentence's belief becomes Sure, with no rewrite.
export async function PATCH(req: Request) {
  const { claimId } = await req.json().catch(() => ({}));
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json(NO_DATA, { status: 409 });
  const r = await confirm(db, v.accountId, String(claimId ?? ""));
  return Response.json(r, { status: r.status === "error" ? 422 : 200 });
}

// Undo on Here's What Changed: the belief and chapter go back, and the correction stays as undone.
export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json(NO_DATA, { status: 409 });
  const r = await undoCorrection(db, v.id, v.accountId, String(id ?? ""));
  return Response.json(r, { status: r.status === "error" ? 422 : 200 });
}
