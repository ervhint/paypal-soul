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
    await new Promise((r) => setTimeout(r, 1400)); // P6: redirect to PayPal sandbox checkout, return URL comes back here
    await post("/api/purchase");
    router.push("/story");
  };

  return (
    <div className="wrap narrow">
      <p className="eyebrow">Sandbox purchase</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Buy something small</h1>
      <p className="lead">Make a payment in PayPal&rsquo;s sandbox and watch Soul write a new chapter about it.</p>

      <ul className="deal">
        <li><span>Item</span><b>Weekend market</b></li>
        <li><span>Paid to</span><b>Sandbox merchant</b></li>
        <li><span>Total</span><b className="big">$18.00</b></li>
      </ul>

      {going ? (
        <div className="handoff" role="status">
          <span className="spin" />
          <span>Handing you over to PayPal&rsquo;s sandbox checkout…</span>
        </div>
      ) : (
        <div className="row" style={{ marginTop: 28 }}>
          <button className="btn" onClick={go}>Continue to PayPal</button>
          <Link className="btn dark" href="/story">Not now</Link>
        </div>
      )}
      <p className="note">You&rsquo;ll leave Soul to pay on PayPal&rsquo;s sandbox site with the test buyer account, then come back here. No real money moves.</p>
    </div>
  );
}
