"use client";

import { useEffect, useRef } from "react";
import "./sample.css";

const CDN = "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/";
const WORDS = [
  { word: "Ask", icon: `${CDN}83de7c35-dd91-4e56-bfb8-0ffafc83d0e0.webp`, tint: "#E9C22E", cls: "lemon" },
  { word: "Notice", icon: `${CDN}4d952211-0474-48cc-af48-58f68b3b7525.webp`, tint: "#F2772F", cls: "peach" },
  { word: "Correct", icon: `${CDN}e2e91fca-5b3f-4e0e-a437-8a581592e407.webp`, tint: "#3FB874", cls: "sage" },
  { word: "Explore", icon: `${CDN}6b32bb47-4ad6-4938-a637-c997b373c68b.webp`, tint: "#C564C4", cls: "rose" },
];
const SLOT = 1750;
const ENTER = 500;
const LEAVE = 420;
const FADE = 770;
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const outCubic = (t: number) => 1 - (1 - t) ** 3;
const inCubic = (t: number) => t ** 3;

function Chevron() {
  return (
    <svg className="chev" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sample02() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current!;
    const layers = [...el.querySelectorAll<HTMLElement>(".layer")];
    const slots = [...el.querySelectorAll<HTMLElement>(".slot")];
    const icons = [...el.querySelectorAll<HTMLElement>(".icon")];
    const btn = el.querySelector<HTMLElement>(".first-btn")!;

    const render = (t: number) => {
      const total = SLOT * WORDS.length;
      const time = t % total;
      const index = Math.floor(time / SLOT);
      const local = time - index * SLOT;

      slots.forEach((slot, i) => {
        const icon = icons[i];
        if (i !== index) {
          slot.style.opacity = "0";
          return;
        }
        const isFirstLoad = t < SLOT;
        const enter = i === 0 && !isFirstLoad ? clamp(local / ENTER) : clamp(local / ENTER);
        const leave = clamp((local - (SLOT - LEAVE)) / LEAVE);
        const e = outCubic(enter);
        const l = inCubic(leave);
        const y = 0.32 * (1 - e) - 0.16 * l;
        slot.style.opacity = String(e * (1 - l));
        const word = slot.querySelector<HTMLElement>(".word")!;
        word.style.transform = `translateY(${y}em) scale(${0.96 + 0.04 * e})`;
        word.style.filter = `blur(${10 * (1 - e) + 8 * l}px)`;
        const ie = outCubic(clamp((local - 60) / ENTER));
        const bob = Math.sin((t / 1000) * 1.8);
        const tilt = Math.sin((t / 1000) * 1.3);
        icon.style.transform =
          `translateY(${y + 0.028 * bob}em) scale(${0.7 + 0.3 * ie}) rotate(${-14 * (1 - ie) + 3 * tilt}deg)`;
        icon.style.filter = `blur(${10 * (1 - e) + 8 * l}px)`;
      });

      // The panel crossfade straddles each word change.
      const dist = SLOT - local;
      const next = (index + 1) % WORDS.length;
      const prev = (index + WORDS.length - 1) % WORDS.length;
      let toNext = 0;
      let fromPrev = 0;
      if (dist < FADE / 2) toNext = 0.5 * clamp(1 - dist / (FADE / 2));
      if (local < FADE / 2) fromPrev = 0.5 * (1 - local / (FADE / 2));
      if (t < FADE / 2) fromPrev = 0;
      layers.forEach((layer, i) => {
        let o = 0;
        if (i === index) o = 1 - toNext - fromPrev;
        if (i === next) o += toNext;
        if (i === prev) o += fromPrev;
        layer.style.opacity = String(o);
        const sx = Math.sin(t / 3100 + i) * 2.2;
        const sy = Math.cos(t / 3700 + i) * 1.6;
        layer.style.transform = `translate(${sx}%, ${sy}%) scale(1.08)`;
      });

      btn.classList.toggle("flash", index === 3 && local > 350 && local < SLOT - LEAVE);
    };

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      render(SLOT + ENTER + 100);
      return;
    }

    // One clock: a long Web Animation whose currentTime drives everything.
    const clock = el.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1e9 });
    let raf = 0;
    const loop = () => {
      render(Number(clock.currentTime ?? 0));
      raf = requestAnimationFrame(loop);
    };
    loop();
    const onVisibility = () => (document.hidden ? clock.pause() : clock.play());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      clock.cancel();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="s02" ref={root}>
      <title>Soul</title>
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap" />

      <section className="panel">
        <div className="layers" aria-hidden="true">
          {WORDS.map((w) => (
            <div key={w.word} className={`layer ${w.cls}`} />
          ))}
          <div className="grain" style={{ backgroundImage: GRAIN }} />
        </div>

        <header className="nav">
          <a className="brand" href="#">
            <span className="brand-dot" />
            soul
          </a>
          <nav className="links" aria-label="Main">
            <a href="#">Story <Chevron /></a>
            <a href="#">Memory <Chevron /></a>
            <a href="#">About <Chevron /></a>
            <a className="join" href="#">Enter Soul</a>
          </nav>
        </header>

        <h1 className="headline">
          <span className="line slot-line" aria-label="Ask, notice, correct, explore">
            {WORDS.map((w) => (
              <span className="slot" key={w.word} aria-hidden="true">
                <span className="icon" style={{ "--tint": w.tint, "--img": `url(${w.icon})` } as React.CSSProperties}>
                  <img src={w.icon} alt="" />
                  <span className="tint" />
                </span>
                <span className="word">{w.word}</span>
              </span>
            ))}
          </span>
          <span className="line">in your terms</span>
        </h1>

        <div className="row">
          <a className="store first-btn" href="#">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            Read My Story
          </a>
          <a className="store" href="#">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19l-4 1Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            See It Change
          </a>
          <p className="caption">
            Soul turns your PayPal sandbox payments into a story that <br className="wide" />
            notices things first and changes its mind when you correct it.
          </p>
        </div>
      </section>

      <section className="strip">
        <svg className="notch" viewBox="0 0 1440 62" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 62 H1062 C1092 62 1098 54 1116 34 C1138 9 1146 1 1178 1 H1440 V62 Z" fill="#FBF6EF" />
        </svg>
        <span className="hint">↓ Scroll to the first chapter</span>
        <div className="strip-inner">
          <p className="made">What this <br />chapter rests on</p>
          <div className="stat"><b>6</b><span>Payments in this chapter</span></div>
          <div className="stat"><b>$74.40</b><span>Spent on groceries so far</span></div>
          <div className="stat"><b>4</b><span>Habits Soul has noticed</span></div>
          <svg className="sprout" viewBox="0 0 96 96" aria-hidden="true">
            <g fill="none" stroke="#0D0D0C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M48 84V42" />
              <path d="M48 54C36 54 24 46 22 28c16 0 26 10 26 26Z" />
              <path d="M48 42c0-14 10-24 26-26 0 18-12 26-26 26Z" />
              <path d="M28 84h40" />
            </g>
          </svg>
        </div>
      </section>
    </div>
  );
}
