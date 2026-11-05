import { headers } from "next/headers";
import { checkConnection, forgetSandbox, startConsent } from "@/lib/connect";
import { paypalConsent, readTransactions } from "@/lib/paypal";
import { requestDb as db } from "@/lib/session";
import { choosePrepared, chooseOwn, currentVisitor, secretClient } from "@/lib/supabase";

// The visitor's own IP, for the sign-in rate limit. Only on Vercel, where every call shares the server's IP.
const visitorIp = async () => (process.env.VERCEL ? ((await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? null) : null);

export async function GET() {
  const v = await currentVisitor(await db());
  return Response.json({ source: v?.source ?? null, connected: v?.connected ?? false, linking: v?.linking ?? false });
}

// `source` chooses the data in use. `step` is the own sandbox: "consent" gives PayPal's link, "check" is Check Connection.
export async function POST(req: Request) {
  const { source, step } = await req.json();
  const client = await db();
  if (step === "consent") {
    // Someone new starts on the prepared data, so Soul has something to show if consent never finishes.
    const id = (await currentVisitor(client))?.id ?? (await choosePrepared(client, await visitorIp()));
    const link = await startConsent(secretClient(), id, new URL(req.url).origin, paypalConsent).catch((e) => (console.error("consent link failed", e), undefined));
    if (link === undefined) return Response.json({ ok: false, error: "PayPal isn't answering right now. Try again in a moment." }, { status: 502 });
    if (!link) return Response.json({ ok: false, error: "A sandbox is connected already. Log Out of My Sandbox to use another one." }, { status: 409 });
    return Response.json({ ok: true, link });
  }
  if (step === "check") {
    const v = await currentVisitor(client);
    return Response.json(v ? await checkConnection(secretClient(), v.id, paypalConsent, readTransactions) : { state: "start" });
  }
  if (source === "prepared") await choosePrepared(client, await visitorIp());
  else if (!(await chooseOwn(client))) return Response.json({ ok: false, error: "No sandbox ready yet." }, { status: 409 });
  return Response.json({ ok: true });
}

// Log Out of My Sandbox: back on the prepared data, then the link is forgotten.
export async function DELETE() {
  const client = await db();
  const v = await currentVisitor(client);
  if (v) {
    await choosePrepared(client, null);
    await forgetSandbox(secretClient(), v.id);
  }
  return Response.json({ ok: true });
}
