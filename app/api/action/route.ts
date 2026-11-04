import { ACTION_COLUMNS, actionView, createPurchase, createSend, loadSupport, SEND, sendReason, settle, type ActionRow } from "@/lib/action";
import { paymentName } from "@/lib/categories";
import { askJson } from "@/lib/llm";
import { PayPalError, paypalOrders } from "@/lib/paypal";
import { requestDb } from "@/lib/session";
import { currentVisitor, secretClient } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Soul's own test account that stands in for the person a send is for, unless they name another sandbox email. */
const testEmail = () => process.env.PAYPAL_SEND_RECIPIENT || null;

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

/** The payment names behind a support belief, as the person sees them, leaving out money already sent through Soul. */
async function namesOf(ids: string[]) {
  const db = await requestDb();
  const { data, error } = await db.from("payment").select("name, category, person_id").in("id", ids);
  if (error) throw error;
  return data.filter((p) => !(p.person_id && p.name?.startsWith("Sent to "))).map(paymentName);
}

// `?id=`: status of one action. Coming back from PayPal lands here, so an approved order is captured now,
// and one the person turned back from on PayPal's cancel link (`cancelled=1`) is cancelled if it wasn't approved.
// `?belief=`: what the confirm page offers to send for that support belief (AC-9.2), or null.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const belief = q.get("belief");
  if (belief !== null) {
    const db = await requestDb();
    const v = await currentVisitor(db);
    const b = v?.accountId && UUID.test(belief) ? await loadSupport(db, v.accountId, belief) : null;
    if (!b) return Response.json(null);
    return Response.json({ belief: b.id, who: b.who, amount: Number(SEND.amount), reason: sendReason(b.who, await namesOf(b.paymentIds)), testEmail: testEmail() });
  }
  const id = q.get("id") ?? "";
  if (!UUID.test(id)) return Response.json(null);
  return Response.json(await own(id, q.get("cancelled") === "1"));
}

const failed = (reason: string, status = 502) => Response.json({ ok: false, reason }, { status });

// Makes the sandbox order: Buy Something Small, or send money for a support belief. Amounts and items are
// fixed here, never taken from the page; the page only picks the belief and the sandbox account paid.
export async function POST(req: Request) {
  const { kind, belief, to } = (await req.json()) as { kind?: string; belief?: string; to?: string };
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return failed("Choose the data to read first.", 409);
  const origin = new URL(req.url).origin;
  try {
    if (kind === "send") {
      const b = typeof belief === "string" && UUID.test(belief) ? await loadSupport(db, v.accountId, belief) : null;
      if (!b) return failed("I can't find what this payment was for any more.", 404);
      const email = to === "test" ? testEmail() : typeof to === "string" ? to.trim().slice(0, 254) : null;
      if (!email || !EMAIL.test(email)) return failed("Enter a sandbox email.", 400);
      const a = await createSend(secretClient(), v.id, v.accountId, b, await namesOf(b.paymentIds), email, origin, paypalOrders);
      return Response.json({ ok: true, id: a.id });
    }
    const a = await createPurchase(secretClient(), v.id, v.accountId, origin, paypalOrders);
    return Response.json({ ok: true, id: a.id });
  } catch (e) {
    console.error("order failed", e);
    // PayPal refusing the order itself (422), e.g. a payee it doesn't accept, is not a timeout.
    if (e instanceof PayPalError && e.status === 422) return failed("PayPal didn't accept this payment, so it wasn't made.", 422);
    return failed("PayPal's sandbox didn't answer in time.");
  }
}
