"use client";
import Link from "next/link";
import { useApi } from "@/lib/use-api";
import { CountUp } from "@/components/ui";

type Summary = { summary: { payments: number; spent: number; habits: number; checks: number } };

export default function Welcome() {
  const { data } = useApi<Summary>("/api/story");
  const s = data?.summary;
  const stats = s && [
    { v: <CountUp to={s.payments} />, label: "Payments behind this" },
    { v: <CountUp to={s.spent} decimals={2} prefix="$" />, label: "Spent on you so far" },
    { v: <CountUp to={s.habits} />, label: "Habits noticed" },
    { v: <CountUp to={s.checks} />, label: "Belief to check" },
  ];
  return (
    <>
      <main className="hero">
        <div className="trust anim" style={{ "--d": "0.05s" } as React.CSSProperties}>
          <span className="avatar a1"><span><i className="fa-solid fa-mug-hot" /></span></span>
          <span className="avatar a2"><span><i className="fa-solid fa-bus" /></span></span>
          <span className="avatar a3"><span><i className="fa-solid fa-basket-shopping" /></span></span>
          <span className="trust-pill">PayPal sandbox buyer</span>
        </div>
        <h1 className="headline">
          <span>Your Money</span>
          <span>Has a Story</span>
        </h1>
        <p className="subhead anim" style={{ "--d": "0.28s" } as React.CSSProperties}>
          Soul reads a week of PayPal payments, tells you what it noticed, and changes its mind when you correct it.
        </p>
        <Link className="btn anim-pulse" href="/story" style={{ "--d": "0.4s", marginTop: 24 } as React.CSSProperties}>
          Enter as the sandbox buyer
        </Link>
        <p className="cta-note anim" style={{ "--d": "0.5s" } as React.CSSProperties}>
          No login. Sandbox payments only, no real money. <Link className="link" href="/about">What is the sandbox?</Link>
        </p>
      </main>
      <section className="stats" aria-label="This week at a glance">
        {stats?.map((x, i) => (
          <div className="stat anim" key={x.label} style={{ "--d": `${0.5 + i * 0.08}s` } as React.CSSProperties}>
            <div className="stat-value">{x.v}</div>
            <div className="stat-label">{x.label}</div>
          </div>
        ))}
      </section>
    </>
  );
}
