"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/lib/use-api";

export default function BuyPage() {
  const router = useRouter();
  const [going, setGoing] = useState(false);

  const go = async () => {
    setGoing(true);
    const r = await post("/api/action", { kind: "buy" }); // P6: creates a PayPal sandbox order and returns its link
    const j = await r.json();
    router.push(r.ok ? `/action/status?id=${j.id}` : "/action/failed");
  };

  return (
    <div className="wrap narrow">
      <p className="eyebrow">Sandbox Purchase</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Buy Something Small</h1>
      <p className="lead">Make a payment in PayPal&rsquo;s sandbox and watch Soul write a new chapter about it.</p>

      <ul className="deal">
        <li><span>Item</span><b>Weekend Market</b></li>
        <li><span>Paid To</span><b>Test Store</b></li>
        <li><span>Total</span><b className="big">$18.00</b></li>
      </ul>

      <div className="row" style={{ marginTop: 28 }}>
        <button className="btn" disabled={going} onClick={go}>{going ? "Making the Link…" : "Get the PayPal Link"}</button>
        <Link className="btn dark" href="/story">Not Now</Link>
      </div>
      <p className="note">You pay on PayPal&rsquo;s sandbox site with your own sandbox login, and the new chapter appears once it&rsquo;s paid. No real money moves.</p>
    </div>
  );
}
