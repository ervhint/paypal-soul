"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post, useApi } from "@/lib/use-api";
import { titleCase } from "@/lib/title-case";

const TEST_RECIPIENT = "test-recipient@personal.example.com"; // P6: Soul's second sandbox personal account
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ConfirmPage() {
  const router = useRouter();
  const { data } = useApi<{ who: string }>("/api/story");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<"test" | "other">("test");
  const [email, setEmail] = useState("");
  const who = data?.who ?? "your mum";
  const to = pick === "test" ? TEST_RECIPIENT : email.trim();
  const valid = EMAIL.test(to);

  const send = async (fail = false) => {
    setBusy(true);
    const r = await post("/api/action", { kind: "send", to, fail });
    const j = await r.json();
    router.push(r.ok ? `/action/status?id=${j.id}` : "/action/failed");
  };

  return (
    <div className="wrap narrow">
      <p className="eyebrow">Check This Before It Moves</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Send $25.00 to {titleCase(who)}?</h1>
      <p className="lead">I suggested this because of the groceries you told me about. Nothing moves until you approve it on PayPal.</p>

      <span className="field-label" id="to-label">Which Sandbox Account Stands In for {titleCase(who)}?</span>
      <div className="pick" role="radiogroup" aria-labelledby="to-label">
        <label>
          <input type="radio" name="to" checked={pick === "test"} onChange={() => setPick("test")} />
          <span>Soul&rsquo;s Test Account<small>{TEST_RECIPIENT}</small></span>
        </label>
        <label>
          <input type="radio" name="to" checked={pick === "other"} onChange={() => setPick("other")} />
          <span>Another Sandbox Email</span>
        </label>
      </div>
      {pick === "other" && (
        <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@personal.example.com" aria-label="Recipient's sandbox email" autoFocus />
      )}

      <ul className="deal">
        <li><span>From</span><b>The Sandbox Account You Approve With</b></li>
        <li><span>Note</span><b>Towards Next Week&rsquo;s Groceries</b></li>
        <li><span>PayPal Fee</span><b className="plus">Taken from what they receive. I&rsquo;ll show the exact fee once it&rsquo;s paid.</b></li>
        <li><span>Amount</span><b className="big">$25.00</b></li>
      </ul>
      <div className="row" style={{ marginTop: 28 }}>
        <button className="btn" disabled={busy || !valid} onClick={() => send()}>{busy ? "Making the Link…" : "Get the PayPal Link"}</button>
        <Link className="btn dark" href="/story">Not Now</Link>
      </div>
      <p className="note">Sandbox only. This moves test money between test accounts. A real launch needs PayPal&rsquo;s approval first.</p>
      <p className="note"><button className="link" disabled={busy} onClick={() => send(true)}>Prototype: Show What a Failure Looks Like</button></p>
    </div>
  );
}
