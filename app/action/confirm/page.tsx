"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post, useApi } from "@/lib/use-api";

export default function ConfirmPage() {
  const router = useRouter();
  const { data } = useApi<{ who: string }>("/api/story");
  const [busy, setBusy] = useState(false);
  const who = data?.who ?? "your mum";

  const send = async (fail = false) => {
    setBusy(true);
    const r = await post("/api/action", { fail });
    const j = await r.json();
    router.push(r.ok ? `/action/done?id=${j.id}` : "/action/failed");
  };

  return (
    <div className="wrap narrow">
      <p className="eyebrow">Check this before it moves</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Send $25.00 to {who}?</h1>
      <p className="lead">I suggested this because of the groceries you told me about. Nothing moves until you press send.</p>

      <ul className="deal">
        <li><span>To</span><b>{who[0].toUpperCase() + who.slice(1)} · sandbox personal account</b></li>
        <li><span>From</span><b>Sandbox buyer</b></li>
        <li><span>Note</span><b>Towards next week&rsquo;s groceries</b></li>
        <li><span>Amount</span><b className="big">$25.00</b></li>
      </ul>
      <div className="row" style={{ marginTop: 28 }}>
        <button className="btn" disabled={busy} onClick={() => send()}>{busy ? "Sending…" : "Send $25.00"}</button>
        <Link className="btn dark" href="/story">Cancel</Link>
      </div>
      <p className="note">Sandbox only. This moves test money between test accounts. A real launch needs PayPal&rsquo;s approval first.</p>
      <p className="note"><button className="link" disabled={busy} onClick={() => send(true)}>Prototype: show what a failure looks like</button></p>
    </div>
  );
}
