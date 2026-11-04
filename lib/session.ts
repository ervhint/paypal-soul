// The visitor's Supabase session for a route handler, read from and written to the request cookies.
import { cookies } from "next/headers";
import { sessionClient } from "@/lib/supabase";

export const requestDb = async () => {
  const jar = await cookies();
  return sessionClient({ getAll: () => jar.getAll(), setAll: (all) => all.forEach((c) => jar.set(c.name, c.value, c.options)) });
};
