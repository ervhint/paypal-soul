import { ACTION_COLUMNS, actionView, createPurchase, settle, type ActionRow } from "@/lib/action";
import { askJson } from "@/lib/llm";
import { createAction, db as mock, settleAction } from "@/lib/mock";
import { paypalOrders } from "@/lib/paypal";
import { requestDb } from "@/lib/session";
import { currentVisitor, secretClient } from "@/lib/supabase";

// Purchases are real (U8). Send money is still the prototype's until U9, with IDs like "A-1".
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The visitor's own action (RLS), asked about at PayPal while it's waiting. */
async function own(id: string, cancel = false) {
  const db = await requestDb();
  const { data, error } = await db.from("action").select(ACTION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // PayPal not answering leaves the action as it was; the page can check again.
  const row = await settle(secretClient(), data as ActionRow, paypalOrders, askJson, cancel).catch((e) => (console.error("settle failed", e), data as ActionRow));
  return actionView(row);
}

// Status of one action. Coming back from PayPal lands here, so an approved order is captured now, and one
// the person turned back from on PayPal's cancel link (`cancelled=1`) is cancelled if it wasn't approved.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "";
  if (!UUID.test(id)) return Response.json(mock().actions.find((a) => a.id === id) ?? null);
  return Response.json(await own(id, q.get("cancelled") === "1"));
}

// Buy Something Small: makes the sandbox order. The amount and item are fixed here, never taken from the page.
export async function POST(req: Request) {
  const { kind, to, fail } = await req.json();
  if (kind === "send") {
    await new Promise((r) => setTimeout(r, 700));
    if (fail) return Response.json({ ok: false, reason: "PayPal's sandbox didn't answer in time." }, { status: 502 });
    return Response.json({ ok: true, id: createAction(kind, to).id });
  }
  const v = await currentVisitor(await requestDb());
  if (!v?.accountId) return Response.json({ ok: false, reason: "Choose the data to read first." }, { status: 409 });
  try {
    const a = await createPurchase(secretClient(), v.id, v.accountId, new URL(req.url).origin, paypalOrders);
    return Response.json({ ok: true, id: a.id });
  } catch (e) {
    console.error("order failed", e);
    return Response.json({ ok: false, reason: "PayPal's sandbox didn't answer in time." }, { status: 502 });
  }
}

// The prototype's send money buttons (Paid, Cancelled, Link Ran Out) until U9.
export async function PATCH(req: Request) {
  const { id, outcome } = await req.json();
  if (typeof id !== "string" || UUID.test(id)) return Response.json(null, { status: 400 });
  return Response.json(settleAction(id, outcome) ?? null);
}
