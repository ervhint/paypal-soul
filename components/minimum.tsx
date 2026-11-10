"use client";
// What an own sandbox has against the minimum for a story (U10), shown on Story and Memory while it's below it.
import { post } from "@/lib/use-api";
import { MINIMUM, type Found } from "@/lib/totals";

export type Minimum = Found & { ok: boolean };

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const line = (need: string, n: number, min: number, one: string) => ({ need, ok: n >= min, got: n >= min ? count(n, one) : `${n} of ${count(min, one)}` });

export function MinimumSteps({ found }: { found: Found }) {
  const lines = [
    line("Payments Across at Least 7 Days", found.days, MINIMUM.days, "Day"),
    line("5 or More Payments", found.payments, MINIMUM.payments, "Payment"),
    line("At Least 1 Repeat", found.repeats, MINIMUM.repeats, "Repeat"),
  ];
  return (
    <ul className="steps">
      {lines.map((f) => (
        <li key={f.need}>
          <i className={`fa-solid fa-${f.ok ? "check" : "xmark"}`} aria-hidden="true" />
          <span><b>{f.need}</b><br />{f.got}</span>
        </li>
      ))}
    </ul>
  );
}

/** Use Our Prepared Data from inside the app: switches, then reloads so the header follows. */
export function UsePrepared({ className = "btn dark" }: { className?: string }) {
  const go = async () => {
    await post("/api/connect", { source: "prepared" });
    location.assign("/story");
  };
  return <button className={className} onClick={go}>Use Our Prepared Data</button>;
}
