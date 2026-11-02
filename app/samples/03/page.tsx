"use client";

import { useEffect } from "react";
import "./sample.css";

const SHIP =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_050506_a830ff21-4c71-4272-bc39-b61cacb54463.png&w=1400&q=85";

type RGB = [number, number, number];
type Char = { el: HTMLElement; hl: boolean };

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const CORE = hex("#8fd5f1");
const RIM = hex("#d2daff");
const WHITE = hex("#ffffff");
const INK = hex("#0b1d3a");
const REVEAL = hex("#3f7cff");
const HL = hex("#5b7cf0");
const GHOST2 = hex("#5c6f92");
const ACCENT2 = hex("#8fe6f4");

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const Q = [0, 0.03, 0.08, 0.18, 0.4, 0.66, 0.87, 1.15, 1.43, 1.8];
const TIP = [0.3, 0.45, 0.65, 0.8, 0.95, 1.05, 1.05, 1.1, 1.3, 2.4];
const HALF = [0.34, 0.38, 0.38, 0.38, 0.38, 0.46, 0.66, 0.9, 1.6, 3.0];
const SOFT = [0.22, 0.26, 0.22, 0.22, 0.19, 0.16, 0.13, 0.1, 0.1, 0.1];
const lookup = (table: number[], q: number) => {
  if (q <= Q[0]) return table[0];
  for (let i = 1; i < Q.length; i++) {
    if (q <= Q[i]) return table[i - 1] + ((table[i] - table[i - 1]) * (q - Q[i - 1])) / (Q[i] - Q[i - 1]);
  }
  return table[table.length - 1];
};

function split(root: HTMLElement): Char[] {
  // Effects run twice in dev, so always split from the original markup.
  root.dataset.src ??= root.innerHTML;
  root.innerHTML = root.dataset.src;
  const chars: Char[] = [];
  const walk = (node: Node, hl: boolean, into: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        (child.textContent ?? "").split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            into.appendChild(document.createTextNode(part));
            return;
          }
          const word = document.createElement("span");
          word.className = "w";
          for (const c of part) {
            const s = document.createElement("span");
            s.textContent = c;
            word.appendChild(s);
            chars.push({ el: s, hl });
          }
          into.appendChild(word);
        });
      } else if ((child as HTMLElement).tagName === "BR") {
        into.appendChild(child.cloneNode());
      } else {
        walk(child, hl || (child as HTMLElement).classList.contains("hl"), into);
      }
    });
  };
  const frag = document.createDocumentFragment();
  walk(root, false, frag);
  root.textContent = "";
  root.appendChild(frag);
  return chars;
}

function paint(chars: Char[], p: number, spread: number, final: RGB, accent: RGB, ghost: RGB) {
  const n = chars.length;
  chars.forEach(({ el, hl }, i) => {
    const t = clamp((p * (1 + spread) - i / n) / spread);
    let o = 1;
    let blur = 0;
    let c: RGB;
    if (t < 0.35) {
      const k = t / 0.35;
      o = k;
      blur = 8 - 6.5 * k;
      c = ghost;
    } else if (t < 0.7) {
      const k = (t - 0.35) / 0.35;
      blur = 1.5 * (1 - k);
      c = mix(ghost, accent, k);
    } else {
      c = mix(accent, hl ? HL : final, (t - 0.7) / 0.3);
    }
    el.style.color = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${o})`;
    el.style.filter = blur > 0.01 ? `blur(${blur}px)` : "none";
  });
}

function Dot({ size }: { size: number }) {
  return (
    <span className="dot">
      <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
        <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="#0b1d3a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function Sample03() {
  useEffect(() => {
    const body = document.querySelector<HTMLElement>(".s03")!;
    const canvas = document.getElementById("bg") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const img = ctx.createImageData(W, H);
    const nav = document.getElementById("nav")!;
    const h1 = split(document.getElementById("h1")!);
    const stmtEl = document.getElementById("stmt")!;
    const stmt = split(stmtEl);
    const h2 = split(document.getElementById("h2")!);
    const row = document.getElementById("row")!;
    const ship = document.getElementById("ship")!;
    const splitEl = document.getElementById("split")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    paint(h1, 0, 0.35, INK, REVEAL, WHITE);
    paint(stmt, 0, 0.16, INK, REVEAL, WHITE);
    paint(h2, 0, 0.35, WHITE, ACCENT2, GHOST2);

    let tgt = { tip: 0.3, half: 0.34, soft: 0.22 };
    const cur = { tip: -0.3, half: 0.3, soft: 0.1 };

    const onScroll = () => {
      const vh = innerHeight;
      const q = scrollY / vh;
      tgt = { tip: lookup(TIP, q), half: lookup(HALF, q), soft: lookup(SOFT, q) };
      const s = clamp((q - 0.69) / 0.74);
      stmtEl.style.transform = `translateY(${0.205 * (1 - s) ** 2 * vh}px)`;
      const p = clamp((q - 0.56) / 2.03);
      paint(stmt, p, 0.16, INK, REVEAL, WHITE);
      nav.classList.toggle("on", p > 0.4);
      const top = splitEl.getBoundingClientRect().top;
      const p2 = clamp((0.8 - top / vh) / 0.65);
      paint(h2, p2, 0.35, WHITE, ACCENT2, GHOST2);
      row.classList.toggle("in", p2 > 0.92);
      ship.style.transform = `scale(${1.08 - 0.08 * clamp(1 - top / vh)})`;
    };

    const draw = (t: number, tip: number, half: number, soft: number) => {
      const aspect = innerWidth / innerHeight;
      const curve: [number, number][] = [];
      for (let i = 0; i < 48; i++) {
        const yy = -0.3 + ((tip + 0.3) * i) / 47;
        curve.push([half * aspect * Math.pow(Math.max(0, 1 - yy / tip), 0.72), yy]);
      }
      let k = 0;
      for (let y = 0; y < H; y++) {
        const py = (y + 0.5) / H;
        for (let x = 0; x < W; x++) {
          const px = Math.abs((x + 0.5) / W - 0.5) * aspect;
          let best = Infinity;
          for (let i = 0; i < 47; i++) {
            const [ax, ay] = curve[i];
            const [bx, by] = curve[i + 1];
            const dx = bx - ax;
            const dy = by - ay;
            const u = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
            const ex = px - ax - dx * u;
            const ey = py - ay - dy * u;
            const d = ex * ex + ey * ey;
            if (d < best) best = d;
          }
          let sd = Math.sqrt(best);
          if (py < tip && px < half * aspect * Math.pow(Math.max(0, 1 - py / tip), 0.72)) sd = -sd;
          sd -= 0.25;
          const g = 1 - smooth((sd + soft) / (2 * soft));
          const c = g < 0.38 ? mix(WHITE, RIM, smooth(g / 0.38)) : mix(RIM, CORE, smooth((g - 0.38) / 0.62));
          img.data[k++] = c[0];
          img.data[k++] = c[1];
          img.data[k++] = c[2];
          img.data[k++] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    let raf = 0;
    const start = performance.now();
    const introStart = 250;
    const introLen = 1050;
    const frame = (now: number) => {
      const t = now - start;
      const it = reduced ? 1 : smooth((t - introStart) / introLen);
      if (it < 1) {
        cur.tip = -0.3 + (tgt.tip + 0.3) * it;
        cur.half = 0.3 + (tgt.half - 0.3) * it;
        cur.soft = 0.1 + (tgt.soft - 0.1) * it;
      } else {
        cur.tip += (tgt.tip - cur.tip) * 0.12;
        cur.half += (tgt.half - cur.half) * 0.12;
        cur.soft += (tgt.soft - cur.soft) * 0.12;
      }
      const drift = reduced ? 0 : 1;
      draw(
        t,
        cur.tip + drift * Math.sin(t * 0.00033 + 1.3) * 0.02,
        cur.half + drift * Math.sin(t * 0.0005) * 0.015,
        cur.soft,
      );
      if (t < 1250 + 200) paint(h1, reduced ? 1 : clamp(t / 1250), 0.35, INK, REVEAL, WHITE);
      if (!reduced || it < 1) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame((now) => {
      body.classList.add("ready");
      frame(now);
    });
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, []);

  const cells: { cls?: string; d: number; mark?: React.ReactNode; text: string }[] = [
    { d: 1.25, text: "COFFEE", mark: <svg viewBox="0 0 24 20"><path d="M2 7c3-2 6-2 9 0s6 2 9 0M2 13c3-2 6-2 9 0s6 2 9 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg> },
    { d: 1.32, cls: "serif", text: "Groceries" },
    { d: 1.39, text: "BUS FARE", mark: <svg viewBox="0 0 20 20"><rect x="2" y="8" width="4" height="10" /><rect x="8" y="3" width="4" height="15" /><rect x="14" y="6" width="4" height="12" /></svg> },
    { d: 1.46, cls: "wide", text: "DATA", mark: <svg viewBox="0 0 20 20"><path d="M10 3 18 17H2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg> },
    { d: 1.42, cls: "boxed", text: "REPORTING" },
    { d: 1.49, text: "PAYOUTS", mark: <svg viewBox="0 0 20 20"><path d="M5 3v14M15 3v14M5 10h10" fill="none" stroke="currentColor" strokeWidth="3" /></svg> },
    { d: 1.56, cls: "lower", text: "webhooks", mark: <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="10" r="2.4" fill="currentColor" /></svg> },
    { d: 1.63, cls: "wide2", text: "PLANS", mark: <svg viewBox="0 0 24 20"><path d="M1 18 9 5l5 8 3-4 6 9Z" fill="currentColor" /></svg> },
  ];

  return (
    <div className="s03">
      <title>Soul</title>
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap" />

      <div className="atmo">
        <canvas id="bg" width={96} height={60} />
      </div>

      <header className="nav" id="nav">
        <a className="brand" href="#">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="#5b7cf0" />
            <path d="M5 10.2c2.3-1.6 4.7-1.6 7 0s4.7 1.6 7 0M5 14.2c2.3-1.6 4.7-1.6 7 0s4.7 1.6 7 0" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Soul
        </a>
        <nav className="links" aria-label="Main">
          {["Story", "Memory", "Chat", "Actions", "About"].map((l) => (
            <a key={l} href="#">{l}</a>
          ))}
        </nav>
        <div className="right">
          <a className="login" href="#">Reset</a>
          <div className="navcta">
            <a className="btn" href="#">
              <span className="lbl">Enter Soul</span>
              <Dot size={12} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="hero">
          <h1 id="h1">
            Meet <span className="hl">Soul</span>, your money&rsquo;s memory
            <br /> for everyday payments
          </h1>
          <p className="trust fade-up" style={{ "--d": "1.15s" } as React.CSSProperties}>
            Every sentence points to a PayPal sandbox payment
          </p>
          <a className="btn lg cta fade-up" href="#" style={{ "--d": "1.3s" } as React.CSSProperties}>
            <span className="lbl">Enter Soul</span>
            <Dot size={16} />
          </a>
          <div className="logos">
            {cells.map((c) => (
              <div className={`cell fade-up ${c.cls ?? ""}`} key={c.text} style={{ "--d": `${c.d}s` } as React.CSSProperties}>
                {c.mark}
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="statement" id="statement">
          <div className="pin">
            <p id="stmt">
              Soul is a story about your money
              <br /> that reads your payments, notices what changed,
              <br /> remembers what you correct, answers with evidence
              <br /> and moves nothing without your yes
            </p>
          </div>
        </section>

        <section className="split" id="split">
          <div className="l">
            <h2 id="h2">
              A story that changes
              <br /> its mind when you do
            </h2>
            <div className="row" id="row">
              <h3>People on PayPal</h3>
              <p>
                <b>Notice more. Correct anything. Confirm every move.</b> Soul keeps its beliefs tied to real payments, so you can check them, change them and act on them.
              </p>
            </div>
          </div>
          <div className="r">
            <img id="ship" src={SHIP} alt="Aerial view of a container ship sailing up a misty fjord" />
          </div>
        </section>
      </main>
    </div>
  );
}
