"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { post } from "@/lib/use-api";

type State = "start" | "check" | "checking" | "pending" | "denied" | "little" | "empty";
const OUTCOMES: [State, string][] = [["pending", "Not Approved Yet"], ["denied", "Approved, Can't Read"], ["little", "Too Little Data"], ["empty", "Empty Account"]];
const FOUND = [
  { need: "Payments Across at Least 7 Days", got: "3 days", ok: false },
  { need: "5 or More Payments", got: "2 payments", ok: false },
  { need: "At Least 1 Repeat", got: "1 repeat", ok: true },
];
const title = { fontSize: "clamp(32px, 4.6vw, 54px)", marginTop: 12 };

function Connect() {
  const initial = useSearchParams().get("state") as State | null; // prototype only
  const router = useRouter();
  const [state, setState] = useState<State>(initial ?? "start");

  const prepared = async () => {
    await post("/api/connect", { source: "prepared" });
    router.push("/story");
  };
  const check = async (result?: State) => {
    setState("checking");
    await new Promise((r) => setTimeout(r, 900)); // P6: looks up the consent, then reads the account's payments
    if (result) return setState(result);
    await post("/api/connect", { source: "own" });
    router.push("/story");
  };
  const usePrepared = <button className="btn" onClick={prepared}>Use Our Prepared Data</button>;
  const again = <button className="btn dark" onClick={() => check()}>Check Connection</button>;

  if (state === "start")
    return (
      <div className="wrap narrow">
        <p className="eyebrow">Log In With PayPal · Sandbox</p>
        <h1 className="display" style={title}>Connect Your Sandbox Account</h1>
        <p className="lead">PayPal asks you to approve Soul, then Soul reads your sandbox payments. Use a sandbox login, not your real PayPal login.</p>
        <ul className="steps">
          <li><i className="fa-solid fa-shield-halved" aria-hidden="true" /><span><b>PayPal&rsquo;s page lists more than Soul uses.</b> It also names payment, refund and fee permissions, as one bundle. Soul only reads your payments.</span></li>
          <li><i className="fa-solid fa-key" aria-hidden="true" /><span><b>Soul keeps your PayPal account ID.</b> No keys or tokens. You can delete your data at any time.</span></li>
          <li><i className="fa-solid fa-receipt" aria-hidden="true" /><span><b>A story needs some history.</b> 5 or more payments across at least 7 days, with 1 repeat. With less, I&rsquo;ll tell you what&rsquo;s missing.</span></li>
        </ul>
        <div className="row" style={{ marginTop: 28 }}>
          <button className="btn paypal" onClick={() => setState("check")}>
            <i className="fa-brands fa-paypal" aria-hidden="true" /> Continue to PayPal <span className="sbx">Sandbox</span>
          </button>
          <Link className="btn dark" href="/">Back</Link>
        </div>
      </div>
    );

  if (state === "checking")
    return (
      <div className="wrap narrow">
        <div className="handoff" role="status"><span className="spin" /><span>Checking With PayPal…</span></div>
      </div>
    );

  if (state === "little")
    return (
      <div className="wrap narrow">
        <p className="eyebrow">Connected, but It&rsquo;s Early</p>
        <h1 className="display" style={title}>Not Enough Here for a Story Yet</h1>
        <p className="lead">I don&rsquo;t want to invent a pattern from a few payments. Here&rsquo;s what I found in your sandbox account.</p>
        <ul className="steps">
          {FOUND.map((f) => (
            <li key={f.need}>
              <i className={`fa-solid fa-${f.ok ? "check" : "xmark"}`} aria-hidden="true" />
              <span><b>{f.need}</b><br />{f.ok ? "Met" : "Missing"}: {f.got} so far</span>
            </li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: 28 }}>{usePrepared}{again}</div>
        <p className="note">Sandbox payments keep their real dates, so history can&rsquo;t be backdated.</p>
      </div>
    );

  if (state === "empty")
    return (
      <div className="wrap narrow">
        <p className="eyebrow">Connected</p>
        <h1 className="display" style={title}>This Account Has No Payments</h1>
        <p className="lead">The connection works, but PayPal shows no payments for this sandbox account, so I have nothing to write about.</p>
        <div className="row" style={{ marginTop: 28 }}>{usePrepared}{again}</div>
      </div>
    );

  if (state === "denied")
    return (
      <div className="wrap narrow">
        <p className="eyebrow">Approved, but No Access</p>
        <h1 className="display" style={title}>PayPal Won&rsquo;t Let Me Read This Account</h1>
        <p className="lead">You approved Soul, but PayPal still refuses to share this account&rsquo;s payments. Try another sandbox account, or use the prepared data.</p>
        <div className="row" style={{ marginTop: 28 }}>
          {usePrepared}
          <button className="btn dark" onClick={() => setState("start")}>Try Another Account</button>
        </div>
      </div>
    );

  return (
    <div className="wrap narrow">
      <p className="eyebrow">PayPal Opens in a New Tab</p>
      <h1 className="display" style={title}>{state === "pending" ? "I Can’t See Your Approval Yet" : "Finished on PayPal?"}</h1>
      <p className="lead">
        {state === "pending"
          ? "PayPal hasn’t told me you approved. Finish on PayPal’s page until it says you’re all set, then check again."
          : "PayPal may not bring you back by itself. When it says you’re all set, come back here and check."}
      </p>
      <div className="row" style={{ marginTop: 28 }}>
        <button className="btn" onClick={() => check()}>Check Connection</button>
        <button className="btn dark" onClick={() => setState("start")}>Open PayPal Again</button>
      </div>
      <p className="note"><button className="link" style={{ fontSize: 13.5 }} onClick={prepared}>Use Our Prepared Data Instead</button></p>
      <p className="note">
        Prototype, see what Check connection can find:{" "}
        {OUTCOMES.map(([s, label], i) => (
          <span key={s}>{i > 0 && " · "}<button className="link" style={{ fontSize: 13.5 }} onClick={() => check(s)}>{label}</button></span>
        ))}
      </p>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense>
      <Connect />
    </Suspense>
  );
}
