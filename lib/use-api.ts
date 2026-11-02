"use client";
import { useCallback, useEffect, useState } from "react";

export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" });
    setData(await r.json());
  }, [url]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, setData, reload: load };
}

export const post = (url: string, body: unknown = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
