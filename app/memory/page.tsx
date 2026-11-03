"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post, useApi } from "@/lib/use-api";
import { Skeleton, Toast, useToast } from "@/components/ui";
import { titleCase } from "@/lib/title-case";
import type { Memory, Payment } from "@/lib/mock";

const patch = (body: object) =>
  fetch("/api/memory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function MemoryPage() {
  const { data, setData } = useApi<Memory[]>("/api/memory");
  const { data: story } = useApi<{ payments: Payment[] }>("/api/story");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const toggle = async (m: Memory) => {
    setData(await (await patch({ id: m.id, active: !m.active })).json());
    toast.show(m.active ? "I'll stop using that" : "I'm using it again");
  };
  const save = async (m: Memory) => {
    setData(await (await patch({ id: m.id, text: draft })).json());
    setEditing(null);
    toast.show("Saved. I'll use your wording");
  };

  return (
    <div className="wrap narrow">
      <p className="eyebrow">What I Remember About You</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Memory</h1>
      <p className="lead">Everything I believe, in plain words. Edit a belief, or tell me to stop using it. Each one comes from payments or from something you told me.</p>

      {!data ? (
        <Skeleton lines={4} />
      ) : (
        <ul className="mem">
          {data.map((m) => (
            <li key={m.id} className={m.active ? "" : "off"}>
              <div>
                <div className="mem-text">{m.text}</div>
                <div className="mem-meta">
                  <span>{m.sure}</span>
                  <span>{m.source}</span>
                  {m.source.startsWith("You Told Me") && <span className="tag">Updated</span>}
                  {!m.active && <span className="tag plain">Not Used</span>}
                </div>
                <div className="mem-pays">
                  {story?.payments.filter((p) => m.paymentIds.includes(p.id)).map((p) => (
                    <Link key={p.id} className="pay-chip" href="/story" title={`PayPal ID ${p.txn}`}>
                      <i className={`fa-solid fa-${p.icon}`} aria-hidden="true" /> {titleCase(p.item)} · {p.date}
                    </Link>
                  ))}
                </div>
              </div>
              {editing !== m.id && <div className="mem-actions">
                <button className="btn dark small" onClick={() => { setEditing(m.id); setDraft(m.text); }}>Edit</button>
                <button className="btn line small" onClick={() => toggle(m)}>{m.active ? "Stop Using This" : "Use Again"}</button>
              </div>}
              {editing === m.id && (
                <form onSubmit={(e) => { e.preventDefault(); save(m); }}>
                  <textarea className="field" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit belief" autoFocus />
                  <div className="row">
                    <button className="btn small" disabled={!draft.trim()}>Save</button>
                    <button type="button" className="btn dark small" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <section className="danger">
        <h2>Delete My Data</h2>
        <p>Removes your corrections, memory, chat and saved chapters from Soul. Your PayPal sandbox account isn&rsquo;t touched.</p>
        {deleting ? (
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn line small" onClick={async () => { await post("/api/reset"); router.push("/?deleted=1"); }}>Yes, Delete It All</button>
            <button className="btn small" onClick={() => setDeleting(false)}>Keep My Data</button>
          </div>
        ) : (
          <button className="btn line small" style={{ marginTop: 14 }} onClick={() => setDeleting(true)}>Delete My Data</button>
        )}
      </section>
      <Toast text={toast.text} />
    </div>
  );
}
