import { chat } from "@/lib/mock";

export async function POST(req: Request) {
  const { message } = await req.json();
  await new Promise((r) => setTimeout(r, 700));
  return Response.json(chat(String(message ?? "")));
}
