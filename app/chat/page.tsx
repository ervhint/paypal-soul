"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { post, useApi } from "@/lib/use-api";
import { PaymentList, Sheet, money } from "@/components/ui";
import type { Payment } from "@/lib/types";
import { titleCase } from "@/lib/title-case";

type Card = { text: string; kind: string; sources: Payment[] };
type Msg = { id?: string; role: "user" | "soul"; text: string; sources: Payment[]; none: boolean; remember?: Card | null; decided?: string };

const CHIPS = 5; // cited payments shown under an answer; the evidence sheet lists them all
const STEP_MS = 500;
const FAILED = { status: "error", message: "I couldn't reach Soul just now. Ask again in a moment." };
const STARTERS = ["Why Do Groceries Keep Showing Up?", "How Much Did I Spend on Myself?", "Tell Me About My Flights"];

type Reply = { status: string; message?: string; id?: string; text?: string; sources?: Payment[]; none?: boolean; remember?: Card | null };

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
  const { data, setData, loaded } = useApi<{ messages: Msg[]; left: number }>("/api/chat");
  const msgs = data?.messages ?? [];
  const left = data?.left;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [open, setOpen] = useState<{ text: string; pays: Payment[]; of: number } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const steps = useRef<string[]>([]);
  const close = useCallback(() => setOpen(null), []);
  const [saving, setSaving] = useState<string | null>(null);

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

  const add = (m: Msg, used = 0) => setData((d) => ({ messages: [...(d?.messages ?? []), m], left: Math.max(0, (d?.left ?? 0) - used) }));
  const ask = async (q: string) => {
    if (!q.trim() || busy || left === 0) return;
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
    if (r.status === "answered") add({ id: r.id, role: "soul", text: r.text!, sources: r.sources!, none: r.none!, remember: r.remember ?? null }, 1);
    else add({ role: "soul", text: r.message!, sources: [], none: true });
  };

  const patch = (id: string, m: Partial<Msg>) => setData((d) => d && { ...d, messages: d.messages.map((x) => (x.id === id ? { ...x, ...m } : x)) });
  // Remember or Not Now (U20): nothing is saved before this tap, and it costs no question.
  const decide = async (m: Msg, remember: boolean) => {
    if (!m.id || saving) return;
    setSaving(m.id);
    const r = await fetch("/api/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, remember }) })
      .then((res) => res.json())
      .catch(() => ({ status: "error", message: "I couldn't reach Soul just now. Try again in a moment." }));
    setSaving(null);
    if (r.status === "done") patch(m.id, { remember: null, decided: remember ? "Remembered. Your story and Memory show it now." : "Okay, I won't remember that." });
    else patch(m.id, { decided: r.message, ...(r.message?.startsWith("That suggestion") ? { remember: null } : {}) });
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
              {m.remember && (
                <div className="check-note remember">
                  <span className="tag plain">Remember This?</span>
                  <h2>{m.remember.text}</h2>
                  {m.remember.sources.length > 0 && (
                    <div className="chips">
                      {m.remember.sources.slice(0, CHIPS).map((p) => (
                        <button key={p.id} className="pay-chip" onClick={() => setOpen({ text: m.remember!.text, pays: [p], of: m.remember!.sources.length })}>
                          <i className={`fa-solid fa-${p.icon}`} aria-hidden="true" />
                          {titleCase(p.item)} · {p.date} · {money(p.amount)}
                        </button>
                      ))}
                      {m.remember.sources.length > CHIPS && <button className="pay-chip" onClick={() => setOpen({ text: m.remember!.text, pays: m.remember!.sources, of: m.remember!.sources.length })}>+{m.remember.sources.length - CHIPS} More</button>}
                    </div>
                  )}
                  <div className="row">
                    <button className="btn dark small" disabled={!!saving} onClick={() => decide(m, true)}>{saving === m.id ? "Remembering…" : "Remember"}</button>
                    <button className="btn line small" disabled={!!saving} onClick={() => decide(m, false)}>Not Now</button>
                  </div>
                </div>
              )}
              {m.decided && <p className="chat-step" role="status">{m.decided}</p>}
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
            <button className="btn" disabled={busy || !text.trim() || left === 0}>Ask</button>
          </form>
          {left !== undefined && (
            <p className="questions-left">
              {left === 0 ? "No Questions Left Today · More After 00:00 UTC" : `${left} ${left === 1 ? "Question" : "Questions"} Left Today`}
            </p>
          )}
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
