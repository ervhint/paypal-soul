import { ACTION_COLUMNS, actionView, suggestSends, type ActionRow } from "@/lib/action";
import { LEFT_OUT_LABELS } from "@/lib/import";
import { requestDb } from "@/lib/session";
import { readStory } from "@/lib/story";
import { currentVisitor } from "@/lib/supabase";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// The saved story, at once and without waiting for PayPal (NF-1), with a send money suggestion under the
// chapter of each support belief not sent for yet (U9).
export async function GET() {
  const client = await requestDb();
  const v = await currentVisitor(client);
  if (!v?.accountId)
    return Response.json({ chapters: [], payments: [], memory: [], leftOut: [], actions: [], change: null, summary: { payments: 0, spent: 0, habits: 0, checks: 0 }, syncedThrough: null });
  const [story, rows, account, real, support] = await Promise.all([
    readStory(client, v.accountId),
    client.from("left_out_row").select("paypal_txn_id, occurred_at, amount, event_code, reason").eq("account_id", v.accountId).order("occurred_at", { ascending: false }),
    client.from("paypal_account").select("synced_through").eq("id", v.accountId).single(),
    client.from("action").select(ACTION_COLUMNS).eq("account_id", v.accountId).order("created_at", { ascending: false }).limit(20),
    client.from("belief").select("id, who, payment_ids").eq("account_id", v.accountId).eq("kind", "support").eq("active", true).not("who", "is", null).order("updated_at", { ascending: false }),
  ]);
  if (rows.error) throw rows.error;
  if (real.error) throw real.error;
  if (support.error) throw support.error;
  const acts = real.data as ActionRow[];
  const sent = new Set(acts.filter((a) => a.kind === "send" && a.status === "completed" && a.belief_id).map((a) => a.belief_id!));
  const names = (ids: string[]) => story.payments.filter((p) => ids.includes(p.id) && !p.item.startsWith("Sent to ")).map((p) => p.item);
  const chapters = suggestSends(story.chapters, support.data.map((b) => ({ id: b.id, who: b.who!, paymentIds: b.payment_ids })), names, sent);
  const leftOut = rows.data.map((r) => ({ txn: r.paypal_txn_id, code: r.event_code, label: LEFT_OUT_LABELS[r.event_code] ?? r.event_code, amount: Number(r.amount), date: day(r.occurred_at), why: r.reason }));
  return Response.json({ ...story, chapters, leftOut, actions: acts.map(actionView), syncedThrough: account.data?.synced_through ?? null, source: v.source });
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
