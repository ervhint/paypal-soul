"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/lib/use-api";
import { Receipt } from "@/components/ui";

export default function BuyPage() {
  const router = useRouter();
  const [going, setGoing] = useState(false);

  const go = async () => {
    setGoing(true);
    const r = await post("/api/action", { kind: "buy" }); // P6: creates a PayPal sandbox order and returns its link
    const j = await r.json();
    router.push(r.ok ? `/action/status?id=${j.id}` : "/action/failed?kind=buy");
  };

  return (
    <div className="wrap narrow">
      <Receipt stages={["Check", "Waiting", "Added"]} now={0} amount={18} title="Buy Something Small">
        <p className="lead">Make a payment in PayPal&rsquo;s sandbox and watch me write a new chapter about it.</p>
        <ul className="deal">
          <li><span>Item</span><b>Weekend Market</b></li>
          <li><span>Paid To</span><b>Test Store</b></li>
        </ul>
        <div className="row" style={{ marginTop: 24 }}>
          <button className="btn" disabled={going} onClick={go}>{going ? "Making the Link…" : "Get the PayPal Link"}</button>
          <Link className="btn dark" href="/story">Not Now</Link>
        </div>
      </Receipt>
      <p className="note">You pay on PayPal&rsquo;s sandbox site with your own sandbox login, and the new chapter appears once it&rsquo;s paid. No real money moves.</p>
    </div>
  );
}
