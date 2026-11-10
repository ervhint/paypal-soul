import { DAILY_QUESTIONS, answer, chatStore, dayStart } from "@/lib/chat";
import { askJson, askTools, creditLeft } from "@/lib/llm";
import { decide, type Proposal } from "@/lib/remember";
import { requestDb } from "@/lib/session";
import { paymentView } from "@/lib/story";
import type { StoryPayment } from "@/lib/totals";
import { currentVisitor } from "@/lib/supabase";

// The picker and the writer together can take a while, and the steps keep the person company.
export const maxDuration = 60;

const NO_DATA = { status: "refused", message: "Choose the data to read first." };

/** A Remember This? card as the page shows it (U20): the belief and its payments. */
const card = (r: Proposal | null | undefined, pays: StoryPayment[]) =>
  r ? { text: r.text, kind: r.kind, sources: pays.filter((p) => r.paymentIds.includes(p.id)).map(paymentView) } : null;

// The chat so far, oldest first, with each answer's payments for the evidence sheet (AC-7.6).
export async function GET() {
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json({ messages: [], left: DAILY_QUESTIONS });
  const store = chatStore(db, v.id, v.accountId);
  const [turns, pays, asked] = await Promise.all([store.history(200), store.payments(), store.askedSince(dayStart(new Date()))]);
  const view = new Map(pays.map((p) => [p.id, paymentView(p)]));
  const messages = turns.map((t) => ({ id: t.id, role: t.role, text: t.text, sources: t.paymentIds.flatMap((id) => view.get(id) ?? []), none: t.role === "soul" && !t.paymentIds.length, remember: card(t.remember, pays) }));
  return Response.json({ messages, left: Math.max(0, DAILY_QUESTIONS - asked) });
}

// One question, as lines of JSON: each step as it really happens, then the answer or a refusal (AC-16.9).
export async function POST(req: Request) {
  const { message } = await req.json().catch(() => ({}));
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json(NO_DATA, { status: 409 });
  const store = chatStore(db, v.id, v.accountId);
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(out) {
      // If the person leaves, the answer is still saved, so a closed stream mustn't stop it.
      const write = (s: string) => {
        try {
          out.enqueue(encoder.encode(s));
        } catch {}
      };
      const send = (line: object) => write(`${JSON.stringify(line)}\n`);
      write(`${" ".repeat(1024)}\n`); // Safari holds a stream back until 1024 bytes have arrived
      const r = await answer(store, String(message ?? ""), { ask: askJson, pick: askTools, credit: creditLeft }, new Date(), (step) => send({ step })).catch((e) => {
        console.error("chat failed", e);
        return { status: "error" as const, message: "I couldn't answer that just now, so I didn't count it. Ask again in a moment." };
      });
      send(r.status === "answered" ? { status: "answered", id: r.id, text: r.text, sources: r.sources.map(paymentView), none: r.none, remember: card(r.remember, await store.payments().catch(() => r.sources)) } : r);
      try {
        out.close();
      } catch {}
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}

// Remember or Not Now on a Remember This? card (U20). Costs no question.
export async function PATCH(req: Request) {
  const { id, remember } = await req.json().catch(() => ({}));
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json(NO_DATA, { status: 409 });
  const r = await decide(db, v.id, v.accountId, String(id ?? ""), remember === true, askJson);
  return Response.json(r, { status: r.status === "error" ? 409 : 200 });
}
