import { sameAsUsual } from "@/lib/correct";
import { ACTION_COLUMNS, actionView, type ActionRow } from "@/lib/action";
import { LEFT_OUT_LABELS } from "@/lib/import";
import { requestDb } from "@/lib/session";
import { readStory } from "@/lib/story";
import { currentVisitor } from "@/lib/supabase";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// The saved story, at once and without waiting for PayPal (NF-1). It never suggests sending money: that
// starts in Chat (U21), since the story is for reading and correcting.
export async function GET() {
  const client = await requestDb();
  const v = await currentVisitor(client);
  if (!v?.accountId)
    return Response.json({ chapters: [], payments: [], memory: [], leftOut: [], actions: [], change: null, notice: null, minimum: null, summary: { payments: 0, spent: 0, habits: 0, checks: 0 }, syncedThrough: null });
  const [story, rows, account, real] = await Promise.all([
    readStory(client, v.accountId),
    client.from("left_out_row").select("paypal_txn_id, occurred_at, amount, event_code, reason").eq("account_id", v.accountId).order("occurred_at", { ascending: false }),
    client.from("paypal_account").select("synced_through").eq("id", v.accountId).single(),
    client.from("action").select(ACTION_COLUMNS).eq("account_id", v.accountId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (rows.error) throw rows.error;
  if (real.error) throw real.error;
  const acts = real.data as ActionRow[];
  const leftOut = rows.data.map((r) => ({ txn: r.paypal_txn_id, code: r.event_code, label: LEFT_OUT_LABELS[r.event_code] ?? r.event_code, amount: Number(r.amount), date: day(r.occurred_at), why: r.reason }));
  return Response.json({ ...story, leftOut, actions: acts.map(actionView), syncedThrough: account.data?.synced_through ?? null, source: v.source });
}

// Here's What Changed was seen: it stops showing.
export async function DELETE() {
  const client = await requestDb();
  const v = await currentVisitor(client);
  if (!v?.accountId) return Response.json({ ok: true });
  const { error } = await client.from("correction").update({ seen_at: new Date().toISOString() }).eq("account_id", v.accountId).is("seen_at", null);
  if (error) throw error;
  return Response.json({ ok: true });
}

// Same as Usual on the I Noticed card (U18): saved so Soul never asks about that payment again, nothing rewritten.
export async function PATCH(req: Request) {
  const { paymentId } = await req.json().catch(() => ({}));
  const client = await requestDb();
  const v = await currentVisitor(client);
  if (!v?.accountId) return Response.json({ status: "error", message: "Choose the data to read first." }, { status: 409 });
  const r = await sameAsUsual(client, v.id, v.accountId, String(paymentId ?? ""));
  return Response.json(r, { status: r.status === "error" ? 422 : 200 });
}
