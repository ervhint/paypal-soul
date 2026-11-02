import { reset } from "@/lib/mock";

export async function POST() {
  reset();
  return Response.json({ ok: true });
}
