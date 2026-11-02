"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/use-api";
import { PaymentRow } from "@/components/ui";
import type { Reply } from "@/lib/mock";

type Msg = { role: "you"; text: string } | ({ role: "soul" } & Reply);

const STARTERS = ["Why do groceries keep showing up?", "How much did I spend on myself?", "Tell me about my flights"];

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { role: "you", text: q }]);
    setText("");
    setBusy(true);
    const r: Reply = await (await post("/api/chat", { message: q })).json();
    setBusy(false);
    setMsgs((m) => [...m, { role: "soul", ...r }]);
  };

  return (
    <div className="wrap narrow">
      <p className="eyebrow">Ask about your payments</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Chat</h1>
      <p className="lead">I answer from your payments and what you&rsquo;ve told me. If I can&rsquo;t point to a payment, I say so.</p>

      <div className="chat" aria-live="polite">
        {msgs.map((m, i) =>
          m.role === "you" ? (
            <div key={i} className="msg you">{m.text}</div>
          ) : (
            <div key={i} className={`msg soul${m.none ? " none" : ""}`}>
              <p className="reply">{m.text}</p>
              {m.sources.length > 0 && (
                <>
                  <p className="sources-title">Based on {m.sources.length === 1 ? "this payment" : `these ${m.sources.length} payments`}</p>
                  <ul className="sources">{m.sources.map((p) => <PaymentRow key={p.id} p={p} />)}</ul>
                </>
              )}
              {m.action && <Link className="btn" style={{ marginTop: 16 }} href={m.action.href}>{m.action.label}</Link>}
            </div>
          ),
        )}
        {busy && (
          <div className="msg soul" aria-label="Soul is reading your payments">
            <span className="typing"><i /><i /><i /></span>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="composer">
        <div className="composer-in">
          {msgs.length === 0 && (
            <div className="chips">
              {STARTERS.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question" aria-label="Your question" />
            <button className="btn" disabled={busy || !text.trim()}>Ask</button>
          </form>
        </div>
      </div>
    </div>
  );
}
