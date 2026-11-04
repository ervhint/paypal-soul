import { syncAccount } from "@/lib/import";
import { requestDb } from "@/lib/session";
import { currentVisitor } from "@/lib/supabase";

// Refresh From PayPal: reads only past the account's cursor. Runs on opening the story and on Refresh.
export async function POST() {
  const v = await currentVisitor(await requestDb());
  if (!v?.accountId) return Response.json({ ok: false, error: "Choose the data to read first." }, { status: 409 });
  try {
    return Response.json({ ok: true, ...(await syncAccount(v.accountId)) });
  } catch (e) {
    console.error("sync failed", e);
    return Response.json({ ok: false, error: "PayPal isn't answering right now." }, { status: 502 });
  }
}
