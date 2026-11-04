import { settleWaiting } from "@/lib/action";
import { syncAccount } from "@/lib/import";
import { askJson } from "@/lib/llm";
import { paypalOrders } from "@/lib/paypal";
import { requestDb } from "@/lib/session";
import { buildStory } from "@/lib/story";
import { currentVisitor, secretClient } from "@/lib/supabase";

// Refresh From PayPal: reads only past the account's cursor, then brings this person's story up to date.
// Runs on opening the story and on Refresh. The person's approved orders are captured first (U8), so a
// purchase joins the story now. The story is rebuilt from saved payments even when PayPal fails.
export async function POST() {
  const db = await requestDb();
  const v = await currentVisitor(db);
  if (!v?.accountId) return Response.json({ ok: false, error: "Choose the data to read first." }, { status: 409 });
  await settleWaiting(secretClient(), paypalOrders, askJson, v.id).catch((e) => console.error("settle failed", e));
  const synced = await syncAccount(v.accountId).catch((e) => (console.error("sync failed", e), null));
  const story = await buildStory(db, v.id, v.accountId, askJson).catch((e) => (console.error("story failed", e), null));
  if (!synced) return Response.json({ ok: false, error: "PayPal isn't answering right now.", story }, { status: 502 });
  return Response.json({ ok: true, ...synced, story });
}
