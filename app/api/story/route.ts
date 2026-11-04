import { db as mock } from "@/lib/mock";
import { LEFT_OUT_LABELS } from "@/lib/import";
import { requestDb } from "@/lib/session";
import { readStory } from "@/lib/story";
import { currentVisitor } from "@/lib/supabase";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// The saved story, at once and without waiting for PayPal (NF-1). Actions and Here's What Changed are
// still the prototype's until U5 and U8.
export async function GET() {
  const client = await requestDb();
  const v = await currentVisitor(client);
  const { actions, change } = mock();
  if (!v?.accountId)
    return Response.json({ chapters: [], payments: [], memory: [], leftOut: [], actions, change, summary: { payments: 0, spent: 0, habits: 0, checks: 0 }, syncedThrough: null });
  const [story, rows, account] = await Promise.all([
    readStory(client, v.accountId),
    client.from("left_out_row").select("paypal_txn_id, occurred_at, amount, event_code, reason").eq("account_id", v.accountId).order("occurred_at", { ascending: false }),
    client.from("paypal_account").select("synced_through").eq("id", v.accountId).single(),
  ]);
  if (rows.error) throw rows.error;
  const leftOut = rows.data.map((r) => ({ txn: r.paypal_txn_id, code: r.event_code, label: LEFT_OUT_LABELS[r.event_code] ?? r.event_code, amount: Number(r.amount), date: day(r.occurred_at), why: r.reason }));
  return Response.json({ ...story, leftOut, actions, change, syncedThrough: account.data?.synced_through ?? null });
}

export function DELETE() {
  mock().change = null;
  return Response.json({ ok: true });
}
