"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { post, useApi } from "@/lib/use-api";
import { PaymentList, Sheet, money } from "@/components/ui";
import type { Payment } from "@/lib/types";
import { titleCase } from "@/lib/title-case";

type Msg = { role: "user" | "soul"; text: string; sources: Payment[]; none: boolean };

const CHIPS = 5; // cited payments shown under an answer; the evidence sheet lists them all
const STEP_MS = 500;
const FAILED = { status: "error", message: "I couldn't reach Soul just now. Ask again in a moment." };
const STARTERS = ["Why Do Groceries Keep Showing Up?", "How Much Did I Spend on Myself?", "Tell Me About My Flights"];

type Reply = { status: string; message?: string; text?: string; sources?: Payment[]; none?: boolean };

/** Reads the answer's lines as they come: each step, then the reply. */
async function readReply(res: Response, onStep: (step: string) => void): Promise<Reply> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let reply: Reply = FAILED;
  let rest = "";
  const read = (line: string) => {
    if (!line.trim()) return;
    const j = JSON.parse(line);
    if (j.step) onStep(j.step);
    else reply = j;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = (rest + value).split("\n");
    rest = lines.pop()!;
    lines.forEach(read);
  }
  read(rest);
  return reply;
}

export default function ChatPage() {
  const { data, setData, loaded } = useApi<{ messages: Msg[] }>("/api/chat");
  const msgs = data?.messages ?? [];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [open, setOpen] = useState<{ text: string; pays: Payment[]; of: number } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const steps = useRef<string[]>([]);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: loaded ? "smooth" : "auto", block: "end" });
  }, [msgs.length, busy, step, loaded]);

  // Functions take milliseconds, so each step gets a moment on screen. The answer never waits for this.
  useEffect(() => {
    if (!busy) return;
    const show = () => {
      const next = steps.current.shift();
      if (next) setStep(next);
    };
    const timer = setInterval(show, STEP_MS);
    return () => clearInterval(timer);
  }, [busy]);

  const add = (m: Msg) => setData((d) => ({ messages: [...(d?.messages ?? []), m] }));
  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    add({ role: "user", text: q, sources: [], none: false });
    setText("");
    setBusy(true);
    setStep("");
    steps.current = [];
    const r = await post("/api/chat", { message: q })
      .then((res) => readReply(res, (s) => steps.current.push(s)))
      .catch(() => FAILED as Reply);
    setBusy(false);
    // A refusal or a failed answer shows here only; it isn't saved or counted.
    add(r.status === "answered" ? { role: "soul", text: r.text!, sources: r.sources!, none: r.none! } : { role: "soul", text: r.message!, sources: [], none: true });
  };

  return (
    <div className="wrap narrow">
      <p className="eyebrow">Ask About Your Payments</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Chat</h1>
      <p className="lead">I answer from your payments and what you&rsquo;ve told me. If I can&rsquo;t point to a payment, I say so. You can ask 5 questions a day.</p>

      <div className="chat" aria-live="polite">
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg you">{m.text}</div>
          ) : (
            <div key={i} className={`msg soul${m.none ? " none" : ""}`}>
              <p className="reply">{m.text}</p>
              {m.sources.length > 0 && (
                <>
                  <p className="sources-title">Based on {m.sources.length === 1 ? "This Payment" : `These ${m.sources.length} Payments`}</p>
                  <div className="chips">
                    {m.sources.slice(0, CHIPS).map((p) => (
                      <button key={p.id} className="pay-chip" onClick={() => setOpen({ text: m.text, pays: [p], of: m.sources.length })}>
                        <i className={`fa-solid fa-${p.icon}`} aria-hidden="true" />
                        {titleCase(p.item)} · {p.date} · {money(p.amount)}
                      </button>
                    ))}
                    {m.sources.length > CHIPS && <button className="pay-chip" onClick={() => setOpen({ text: m.text, pays: m.sources, of: m.sources.length })}>+{m.sources.length - CHIPS} More</button>}
                  </div>
                </>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="msg soul" aria-label="Soul is reading your payments">
            <span className="typing"><i /><i /><i /></span>
            {step && <p className="chat-step">{step}</p>}
          </div>
        )}
        <div ref={end} style={{ scrollMarginBottom: 120 }} />
      </div>

      <div className="composer">
        <div className="composer-in">
          {loaded && msgs.length === 0 && (
            <div className="chips">
              {STARTERS.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a Question" maxLength={300} aria-label="Your question" />
            <button className="btn" disabled={busy || !text.trim()}>Ask</button>
          </form>
        </div>
      </div>

      <Sheet open={!!open} onClose={close} title="Payments behind this answer">
        {open && (
          <>
            <p className="eyebrow">Why I Said This</p>
            <h2>{open.text}</h2>
            <p className="why">{open.of === 1 ? "One payment says so." : open.pays.length === 1 ? `1 of ${open.of} payments behind this answer.` : `${open.of} payments say so.`}</p>
            <PaymentList pays={open.pays} />
          </>
        )}
      </Sheet>
    </div>
  );
}
