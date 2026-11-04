import { db, snapshot } from "@/lib/mock";
import { LEFT_OUT_LABELS } from "@/lib/import";
import { requestDb } from "@/lib/session";
import { currentVisitor } from "@/lib/supabase";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// Chapters, claims and payments are still the prototype's until U4. Rows left out and the sync state are real.
export async function GET() {
  const client = await requestDb();
  const v = await currentVisitor(client);
  let leftOut: ReturnType<typeof snapshot>["leftOut"] = [];
  let syncedThrough: string | null = null;
  if (v?.accountId) {
    const [rows, account] = await Promise.all([
      client.from("left_out_row").select("paypal_txn_id, occurred_at, amount, event_code, reason").eq("account_id", v.accountId).order("occurred_at", { ascending: false }),
      client.from("paypal_account").select("synced_through").eq("id", v.accountId).single(),
    ]);
    if (rows.error) throw rows.error;
    leftOut = rows.data.map((r) => ({ txn: r.paypal_txn_id, code: r.event_code, label: LEFT_OUT_LABELS[r.event_code] ?? r.event_code, amount: Number(r.amount), date: day(r.occurred_at), why: r.reason }));
    syncedThrough = account.data?.synced_through ?? null;
  }
  return Response.json({ ...snapshot(), leftOut, syncedThrough });
}

export function DELETE() {
  db().change = null;
  return Response.json({ ok: true });
}
