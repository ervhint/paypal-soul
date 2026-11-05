import { settleWaiting } from "@/lib/action";
import { dailyJob } from "@/lib/forget";
import { syncAccount } from "@/lib/import";
import { askJson } from "@/lib/llm";
import { paypalOrders } from "@/lib/paypal";
import { secretClient } from "@/lib/supabase";

// The daily job (vercel.json). Vercel Cron calls it with `Authorization: Bearer CRON_SECRET`; on localhost
// it's called by hand. Captures approved orders, imports every account, forgets people idle 30 days.
export async function GET(req: Request) {
  if (!cronAllowed(req)) return Response.json({ ok: false }, { status: 401 });
  const admin = secretClient();
  const job = await dailyJob(admin, { settle: () => settleWaiting(admin, paypalOrders, askJson), sync: syncAccount });
  return Response.json({ ok: true, ...job });
}

const cronAllowed = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
};
