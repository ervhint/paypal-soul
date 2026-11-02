"use client";

import { useEffect, useRef, useState } from "react";
import "./sample.css";

const NAV = ["Story", "Memory", "Chat", "About"];
const STATS = [
  { icon: "<", target: 6, suffix: "", decimals: 0, label: "Payments behind this" },
  { icon: "%", target: 74.4, suffix: "", decimals: 2, prefix: "$", label: "Spent so far" },
  { icon: "*", target: 4, suffix: "", decimals: 0, label: "Habits noticed" },
  { icon: "#", target: 1, suffix: "", decimals: 0, label: "Belief to check" },
];

export default function Sample01() {
  const [open, setOpen] = useState(false);  const statsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey =(e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth > 720 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const root = statsRef.current;
    if (!root) return;
    const values = [...root.querySelectorAll<HTMLElement>("[data-value]")];
    const format = (i: number, v: number) => {
      const s = STATS[i];
      return `${s.prefix ?? ""}${v.toFixed(s.decimals)}${s.suffix}`;
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      values.forEach((el, i) => (el.textContent = format(i, STATS[i].target)));
      return;
    }
    let raf = 0;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        values.forEach((el, i) => {
          const duration = 1500 + i * 80;
          timers.push(
            window.setTimeout(() => {
              const start = performance.now();
              const tick = (now: number) => {
                const p = Math.min((now - start) / duration, 1);
                el.textContent = format(i, STATS[i].target * (1 - (1 - p) ** 3));
                if (p < 1) raf = requestAnimationFrame(tick);
              };
              raf = requestAnimationFrame(tick);
            }, 480 + i * 90),
          );
        });
      },
      { threshold: 0.25 },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={`s01${open ? " menu-open" : ""}`}>
      <title>Soul</title>
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
      <link rel="stylesheet" precedence="default" href="https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A=="
        crossOrigin="anonymous"
      />

      <div className="bg">
        <video className="bg-video" autoPlay muted loop playsInline>
          <source src="/assets/bg.mp4" type="video/mp4" />
        </video>
        <div className="fade" />
      </div>

      <div className="page">
        <header className="header">
          <a className="logo" href="#" aria-label="Soul home">
            <img className="logo-mark" src="/assets/logo.webp" alt="" width={52} height={52} />
          </a>
          <nav className="nav" aria-label="Main">
            {NAV.map((n, i) => (
              <a key={n} href="#" className={i === 0 ? "active" : ""} aria-current={i === 0 ? "page" : undefined}>
                {n}
              </a>
            ))}
          </nav>
          <a className="sign-in" href="#">
            Reset
          </a>
          <button className="burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            <span />
            <span />
            <span />
          </button>
        </header>

        {open && (
          <>
            <div className="overlay" onClick={() => setOpen(false)} />
            <div className="sheet">
              {NAV.map((n, i) => (
                <a key={n} href="#" className={i === 0 ? "active" : ""} style={{ animationDelay: `${0.05 + i * 0.05}s` }} onClick={() => setOpen(false)}>
                  {n}
                </a>
              ))}
              <a className="sheet-sign" href="#" style={{ animationDelay: "0.25s" }} onClick={() => setOpen(false)}>
                Reset
              </a>
            </div>
          </>
        )}

        <main className="hero">
          <div className="trust anim" style={{ "--d": "0.05s" } as React.CSSProperties}>
            <span className="avatar a1"><span><i className="fa-solid fa-mug-hot" /></span></span>
            <span className="avatar a2"><span><i className="fa-solid fa-bus" /></span></span>
            <span className="avatar a3"><span><i className="fa-solid fa-basket-shopping" /></span></span>
            <span className="trust-pill">Soul noticed this today</span>
          </div>
          <h1 className="headline anim">
            <span>Groceries Keep</span>
            <span>Showing Up</span>
          </h1>
          <p className="subhead anim" style={{ "--d": "0.28s" } as React.CSSProperties}>
            You keep buying them through PayPal, and I think they&rsquo;re for you. Check the payments, or tell me I&rsquo;m wrong.
          </p>
          <a className="cta anim-pulse" href="#" style={{ "--d": "0.4s" } as React.CSSProperties}>
            Show the Payments
          </a>
        </main>

        <section className="stats" ref={statsRef}>
          {STATS.map((s, i) => (
            <div className="stat anim" key={s.label} style={{ "--d": `${0.5 + i * 0.08}s` } as React.CSSProperties}>
              <div className="stat-icon" aria-hidden="true">{s.icon}</div>
              <div className="stat-value" data-value>
                {s.prefix ?? ""}
                {(0).toFixed(s.decimals)}
                {s.suffix}
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
