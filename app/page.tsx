"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { post, useApi } from "@/lib/use-api";
import { useEffect } from "react";
import { CountUp, Toast, useToast } from "@/components/ui";

type Summary = { summary: { payments: number; spent: number; habits: number; checks: number } };

export default function Welcome() {
  const router = useRouter();
  const { data } = useApi<Summary>("/api/story");
  const toast = useToast();
  const { show } = toast;
  useEffect(() => {
    if (new URLSearchParams(location.search).get("deleted") !== "1") return;
    history.replaceState(null, "", "/");
    show("Deleted. Your corrections, memory and chat are gone.");
  }, [show]);
  const prepared = async () => {
    const r = await post("/api/connect", { source: "prepared" });
    if (!r.ok) return show("Soul couldn't start just now. Try again in a moment.");
    router.push("/story");
  };
  const s = data?.summary;
  const stats = s && [
    { v: <CountUp to={s.payments} />, label: "Payments Behind This" },
    { v: <CountUp to={s.spent} decimals={2} prefix="$" />, label: "Spent So Far" },
    { v: <CountUp to={s.habits} />, label: "Habits Noticed" },
    { v: <CountUp to={s.checks} />, label: "Belief to Check" },
  ];
  return (
    <>
      <div className="hero">
        <div className="trust anim" style={{ "--d": "0.05s" } as React.CSSProperties}>
          <span className="trust-pill">PayPal Sandbox Only</span>
        </div>
        <h1 className="headline">
          <span>Your Money</span>
          <span>Has a Story</span>
        </h1>
        <p className="subhead anim" style={{ "--d": "0.28s" } as React.CSSProperties}>
          Soul reads your PayPal sandbox payments, tells you what it noticed, and changes its mind when you correct it.
        </p>
        <div className="choice anim" style={{ "--d": "0.4s" } as React.CSSProperties}>
          <div>
            <p>One click, no login to read. Paying needs your own sandbox login.</p>
            <button className="btn" onClick={prepared}>Try It With Our Prepared Data</button>
          </div>
          <div>
            <p>Your account needs 5 or more payments across at least 7 days, with 1 repeat.</p>
            <Link className="btn paypal" href="/connect">
              <i className="fa-brands fa-paypal" aria-hidden="true" /> Log In With PayPal <span className="sbx">Sandbox</span>
            </Link>
          </div>
        </div>
        <p className="cta-note anim" style={{ "--d": "0.5s" } as React.CSSProperties}>
          No real money. <Link className="link" href="/about">How Soul Differs From PayPal</Link>
        </p>
      </div>
      <section className="stats" aria-label="From the prepared story">
        {stats && <p className="stats-cap anim" style={{ "--d": "0.5s" } as React.CSSProperties}>From the Prepared Story</p>}
        {stats?.map((x, i) => (
          <div className="stat anim" key={x.label} style={{ "--d": `${0.5 + i * 0.08}s` } as React.CSSProperties}>
            <div className="stat-value">{x.v}</div>
            <div className="stat-label">{x.label}</div>
          </div>
        ))}
      </section>
      <Toast text={toast.text} />
    </>
  );
}
