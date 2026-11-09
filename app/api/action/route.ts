import { ACTION_COLUMNS, actionView, createPurchase, createSend, loadAccounts, saveAccount, SEND, sendAmount, settle, type ActionRow } from "@/lib/action";
import { person } from "@/lib/correct";
import { askJson } from "@/lib/llm";
import { PayPalError, paypalOrders } from "@/lib/paypal";
import { requestDb } from "@/lib/session";
import { currentVisitor, secretClient } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Soul's own test account that stands in for the person a send is for, unless they pick or type another. */
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

// `?id=`: status of one action. Coming back from PayPal lands here, so an approved order is captured now,
// and one the person turned back from on PayPal's cancel link (`cancelled=1`) is cancelled if it wasn't approved.
// `?accounts=1`: what Memory's send form offers (U21): Soul's Test Account, the accounts saved for people, the range.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("accounts") !== null) {
    const db = await requestDb();
    const v = await currentVisitor(db);
    return Response.json({ testEmail: testEmail(), saved: v?.accountId ? await loadAccounts(db, v.accountId) : [], min: SEND.min, max: SEND.max });
  }
  const id = q.get("id") ?? "";
  if (!UUID.test(id)) return Response.json(null);
  return Response.json(await own(id, q.get("cancelled") === "1"));
}

const failed = (reason: string, status = 502, field?: string) => Response.json({ ok: false, reason, ...(field ? { field } : {}) }, { status });

// Makes the sandbox order: Buy Something Small, fixed here, or send money from Memory (U21): who, how
// much ($1.00 to $100.00) and the account paid, all checked here. A typed account is saved for that person.
// Nothing moves until the person approves it on PayPal with their own sandbox login.
export async function POST(req: Request) {
  const { kind, who, to, amount } = (await req.json().catch(() => ({}))) as { kind?: string; who?: unknown; to?: unknown; amount?: unknown };
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return failed("Choose the data to read first.", 409);
  const origin = new URL(req.url).origin;
  try {
    if (kind === "send") {
      const name = person(who);
      if (!name) return failed("Say who it's for.", 400, "who");
      const sum = sendAmount(amount);
      if (!sum) return failed(`Choose an amount from $${SEND.min}.00 to $${SEND.max}.00.`, 400, "amount");
      const typed = to !== "test" && typeof to === "string" ? to.trim().slice(0, 254) : null;
      const email = to === "test" ? testEmail() : typed;
      if (!email || !EMAIL.test(email)) return failed("Enter an account email.", 400, "account");
      if (typed) await saveAccount(db, v.id, v.accountId, name, typed);
      const a = await createSend(secretClient(), v.id, v.accountId, name, email, origin, paypalOrders, sum);
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
