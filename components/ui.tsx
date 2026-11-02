"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Payment } from "@/lib/mock";

export const money = (n: number) => `$${n.toFixed(2)}`;

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <button className="sheet-x" onClick={onClose} aria-label="Close">
          <i className="fa-solid fa-xmark" />
        </button>
        {children}
      </div>
    </>
  );
}

export function Toast({ text }: { text: string }) {
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {text && <div className="toast">{text}</div>}
    </div>
  );
}

export function useToast() {
  const [text, setText] = useState("");
  const timer = useRef<number>(0);
  const show = (t: string) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setText(""), 3200);
  };
  return { text, show };
}

export const Skeleton = ({ lines = 3, tall }: { lines?: number; tall?: boolean }) => (
  <div className="skeleton" aria-hidden="true">
    {Array.from({ length: lines }, (_, i) => (
      <span key={i} className={tall && i === 0 ? "tall" : ""} style={{ width: `${100 - i * 14}%` }} />
    ))}
  </div>
);

export const Empty = ({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) => (
  <div className="empty">
    <i className={`fa-solid fa-${icon}`} aria-hidden="true" />
    <h2>{title}</h2>
    {children}
  </div>
);

export const PaymentRow = ({ p }: { p: Payment }) => (
  <li className="pay">
    <span className="pay-icon">
      <i className={`fa-solid fa-${p.icon}`} aria-hidden="true" />
    </span>
    <span className="pay-main">
      <b>{p.item}</b>
      <small>
        {p.date} · sandbox {p.id}
      </small>
    </span>
    <span className="pay-amt">{money(p.amount)}</span>
  </li>
);

export function CountUp({ to, decimals = 0, prefix = "" }: { to: number; decimals?: number; prefix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1300, 1);
      setV(to * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{prefix}{v.toFixed(decimals)}</>;
}
