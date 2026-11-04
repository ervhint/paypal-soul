import { answer, chatStore } from "@/lib/chat";
import { askJson } from "@/lib/llm";
import { requestDb } from "@/lib/session";
import { paymentView } from "@/lib/story";
import { currentVisitor } from "@/lib/supabase";

const NO_DATA = { status: "refused", message: "Choose the data to read first." };

// The chat so far, oldest first, with each answer's payments for the evidence sheet (AC-7.6).
export async function GET() {
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json({ messages: [] });
  const store = chatStore(db, v.id, v.accountId);
  const [turns, pays] = await Promise.all([store.history(200), store.payments()]);
  const view = new Map(pays.map((p) => [p.id, paymentView(p)]));
  const messages = turns.map((t) => ({ role: t.role, text: t.text, sources: t.paymentIds.flatMap((id) => view.get(id) ?? []), none: t.role === "soul" && !t.paymentIds.length }));
  return Response.json({ messages });
}

// One question: a grounded answer, or a refusal over 300 characters or 30 a day, before any LLM call.
export async function POST(req: Request) {
  const { message } = await req.json().catch(() => ({}));
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json(NO_DATA, { status: 409 });
  const r = await answer(chatStore(db, v.id, v.accountId), String(message ?? ""), askJson);
  if (r.status !== "answered") return Response.json(r, { status: r.status === "refused" ? 422 : 502 });
  return Response.json({ status: "answered", text: r.text, sources: r.sources.map(paymentView), none: r.none });
}
