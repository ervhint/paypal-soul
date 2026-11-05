"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { post } from "@/lib/use-api";
import { MINIMUM, type Found } from "@/lib/totals";

type State = "loading" | "start" | "check" | "checking" | "pending" | "denied" | "little" | "empty" | "offline";
const title = { fontSize: "clamp(32px, 4.6vw, 54px)", marginTop: 12 };

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const line = (need: string, n: number, min: number, one: string) => ({ need, ok: n >= min, got: n >= min ? count(n, one) : `${n} of ${count(min, one)}` });

function Connect() {
  const param = useSearchParams().get("state") as State | null; // development only, to see a state on demand
  const demo = process.env.NODE_ENV === "development" ? param : null;
  const router = useRouter();
  const [state, setState] = useState<State>(demo ?? "loading");
  const [found, setFound] = useState<Found>({ days: 3, payments: 2, repeats: 1 });
  const [error, setError] = useState<string | null>(null);

  const prepared = async () => {
    await post("/api/connect", { source: "prepared" });
    router.push("/story");
  };
  const check = useCallback(async () => {
    setState("checking");
    const r = await post("/api/connect", { step: "check" }).then((r) => r.json()).catch(() => ({ state: "offline" }));
    if (r.state === "ready") return router.push("/story");
    if (r.found) setFound(r.found);
    setState(r.state);
  }, [router]);
  // The tab opens on the tap itself, or the browser would block it once the link has been fetched.
  const toPayPal = async () => {
    const tab = window.open("", "_blank");
    setError(null);
    const r = await post("/api/connect", { step: "consent" }).then((r) => r.json()).catch(() => ({ error: "I couldn't reach Soul just now. Try again in a moment." }));
    if (!r.link) {
      tab?.close();
      return setError(r.error);
    }
    if (tab) tab.location.href = r.link;
    else location.href = r.link;
    setState("check");
  };

  // Coming back from PayPal, or to this page later, the check runs by itself. Once per open: it may read PayPal.
  const opened = useRef(false);
  useEffect(() => {
    if (demo || opened.current) return;
    opened.current = true;
    fetch("/api/connect", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => (r.linking ? check() : setState("start")))
      .catch(() => setState("start"));
  }, [demo, check]);

  const usePrepared = <button className="btn" onClick={prepared}>Use Our Prepared Data</button>;
  const again = <button className="btn dark" onClick={check}>Check Connection</button>;

  if (state === "start")
    return (
      <div className="wrap narrow">
        <p className="eyebrow">Log In With PayPal · Sandbox</p>
        <h1 className="display" style={title}>Connect Your Sandbox Account</h1>
        <p className="lead">PayPal asks you to approve me, then I read your sandbox payments. Use a sandbox login, not your real PayPal login.</p>
        <ul className="steps">
          <li><i className="fa-solid fa-right-to-bracket" aria-hidden="true" /><span><b>PayPal&rsquo;s page talks about a business account.</b> You don&rsquo;t need one. Choose &ldquo;Already have an account? Log in&rdquo; and use your sandbox login.</span></li>
          <li><i className="fa-solid fa-shield-halved" aria-hidden="true" /><span><b>PayPal&rsquo;s page lists more than I use.</b> It also names payment, refund and fee permissions, as one bundle. I only read your payments.</span></li>
          <li><i className="fa-solid fa-key" aria-hidden="true" /><span><b>I keep your PayPal account ID.</b> No keys or tokens. You can delete your data at any time.</span></li>
          <li><i className="fa-solid fa-receipt" aria-hidden="true" /><span><b>A story needs some history.</b> 5 or more payments across at least 7 days, with 1 repeat. With less, I&rsquo;ll tell you what&rsquo;s missing.</span></li>
        </ul>
        <div className="row" style={{ marginTop: 28 }}>
          <button className="btn paypal" onClick={toPayPal}>
            <i className="fa-brands fa-paypal" aria-hidden="true" /> Continue to PayPal <span className="sbx">Sandbox</span>
          </button>
          <Link className="btn dark" href="/">Back</Link>
        </div>
        {error && <p className="note" role="alert">{error}</p>}
      </div>
    );

  if (state === "loading" || state === "checking")
    return (
      <div className="wrap narrow">
        <div className="handoff" role="status"><span className="spin" /><span>Checking With PayPal…</span></div>
      </div>
    );

  if (state === "little") {
    const lines = [
      line("Payments Across at Least 7 Days", found.days, MINIMUM.days, "Day"),
      line("5 or More Payments", found.payments, MINIMUM.payments, "Payment"),
      line("At Least 1 Repeat", found.repeats, MINIMUM.repeats, "Repeat"),
    ];
    return (
      <div className="wrap narrow">
        <p className="eyebrow">Connected, Still Using Prepared Data</p>
        <h1 className="display" style={title}>Not Enough Here for a Story Yet</h1>
        <p className="lead">I don&rsquo;t want to invent a pattern from a few payments. Here&rsquo;s what I found in your sandbox account.</p>
        <ul className="steps">
          {lines.map((f) => (
            <li key={f.need}>
              <i className={`fa-solid fa-${f.ok ? "check" : "xmark"}`} aria-hidden="true" />
              <span><b>{f.need}</b><br />{f.got}</span>
            </li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: 28 }}>{usePrepared}{again}</div>
        <p className="note">Sandbox payments keep their real dates, so history can&rsquo;t be backdated.</p>
      </div>
    );
  }

  if (state === "empty")
    return (
      <div className="wrap narrow">
        <p className="eyebrow">Connected, Still Using Prepared Data</p>
        <h1 className="display" style={title}>This Account Has No Payments</h1>
        <p className="lead">The connection works, but PayPal shows no spending in this sandbox account, so I have nothing to write about.</p>
        <div className="row" style={{ marginTop: 28 }}>{usePrepared}{again}</div>
      </div>
    );

  if (state === "denied")
    return (
      <div className="wrap narrow">
        <p className="eyebrow">Approved, but No Access</p>
        <h1 className="display" style={title}>PayPal Won&rsquo;t Let Me Read This Account</h1>
        <p className="lead">You approved me, but PayPal still refuses to share this account&rsquo;s payments. Try another sandbox account, or use the prepared data.</p>
        <div className="row" style={{ marginTop: 28 }}>
          {usePrepared}
          <button className="btn dark" onClick={() => setState("start")}>Try Another Account</button>
        </div>
      </div>
    );

  if (state === "offline")
    return (
      <div className="wrap narrow">
        <p className="eyebrow">Nothing Changed</p>
        <h1 className="display" style={title}>PayPal Isn&rsquo;t Answering</h1>
        <p className="lead">I couldn&rsquo;t finish checking your sandbox account. Nothing is lost, so try again in a moment.</p>
        <div className="row" style={{ marginTop: 28 }}>{usePrepared}{again}</div>
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
        <button className="btn" onClick={check}>Check Connection</button>
        <button className="btn dark" onClick={() => setState("start")}>Open PayPal Again</button>
      </div>
      <p className="note"><button className="link" style={{ fontSize: 13.5 }} onClick={prepared}>Use Our Prepared Data Instead</button></p>
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
