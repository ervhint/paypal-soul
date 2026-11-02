import { correct } from "@/lib/mock";

export async function POST(req: Request) {
  const { claimId, text, who } = await req.json();
  await new Promise((r) => setTimeout(r, 600));
  return Response.json(correct(claimId, String(text ?? ""), who));
}
