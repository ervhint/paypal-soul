import { db } from "@/lib/mock";

export function GET() {
  const { source, connected } = db();
  return Response.json({ source, connected });
}

export async function POST(req: Request) {
  const { source } = await req.json();
  const s = db();
  s.source = source;
  if (source === "own") s.connected = true;
  return Response.json({ ok: true });
}

export function DELETE() {
  const s = db();
  s.source = "prepared";
  s.connected = false;
  return Response.json({ ok: true });
}
