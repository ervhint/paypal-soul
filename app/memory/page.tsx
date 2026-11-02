"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/use-api";
import { Skeleton, Toast, useToast } from "@/components/ui";
import type { Memory } from "@/lib/mock";

const patch = (body: object) =>
  fetch("/api/memory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function MemoryPage() {
  const { data, setData } = useApi<Memory[]>("/api/memory");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
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
      <p className="eyebrow">What I remember about you</p>
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
                  <span className={m.kind === "check" ? "check" : ""}>{m.kind === "check" ? "To check" : m.sure}</span>
                  <span>{m.source}</span>
                  {m.source.startsWith("You told me") && <span className="tag">Updated</span>}
                  {!m.active && <span className="tag plain">Not used</span>}
                  <Link className="link" href="/story" style={{ fontSize: 13.5 }}>See in story</Link>
                </div>
              </div>
              <div className="mem-actions">
                <button className="btn dark small" onClick={() => { setEditing(m.id); setDraft(m.text); }}>Edit</button>
                <button className="btn line small" onClick={() => toggle(m)}>{m.active ? "Stop using this" : "Use again"}</button>
              </div>
              {editing === m.id && (
                <form onSubmit={(e) => { e.preventDefault(); save(m); }}>
                  <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit belief" autoFocus />
                  <button className="btn small" disabled={!draft.trim()}>Save</button>
                  <button type="button" className="btn dark small" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <Toast text={toast.text} />
    </div>
  );
}
