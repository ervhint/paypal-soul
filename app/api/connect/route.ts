import { headers } from "next/headers";
import { requestDb as db } from "@/lib/session";
import { choosePrepared, chooseOwn, currentVisitor } from "@/lib/supabase";

// The visitor's own IP, for the sign-in rate limit. Only on Vercel, where every call shares the server's IP.
const visitorIp = async () => (process.env.VERCEL ? ((await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? null) : null);

export async function GET() {
  const v = await currentVisitor(await db());
  return Response.json({ source: v?.source ?? null, connected: v?.connected ?? false });
}

export async function POST(req: Request) {
  const { source } = await req.json();
  const client = await db();
  if (source === "prepared") await choosePrepared(client, await visitorIp());
  else if (!(await chooseOwn(client))) return Response.json({ ok: false, error: "No sandbox connected yet." }, { status: 409 });
  return Response.json({ ok: true });
}

// U10 replaces this with logging out of the own sandbox. For now it goes back to the prepared data.
export async function DELETE() {
  const client = await db();
  if (await currentVisitor(client)) await choosePrepared(client, null);
  return Response.json({ ok: true });
}
