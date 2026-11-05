// What the BFF sends the pages: payments, rows left out, chapters with claims, beliefs and what changed.
export type Payment = { id: string; txn: string; item: string; payee: string; category: string; icon: string; amount: number; date: string; forWho: "you" | "support" };
export type LeftOut = { txn: string; code: string; label: string; amount: number; date: string; why: string };
export type Claim = { id: string; text: string; paymentIds: string[]; belief?: string; rewritten?: boolean };
export type Chapter = {
  id: string;
  title: string;
  when: string;
  fresh?: boolean;
  claims: Claim[];
  suggest?: { text: string; label: string; href: string };
};
export type Memory = {
  id: string;
  kind: "habit" | "check" | "interest" | "support" | "told";
  text: string;
  sure: "Sure" | "Fairly Sure" | "Not Sure";
  source: string;
  paymentIds: string[];
  active: boolean;
};
export type Change = { claimId: string; before: string; after: string; notes: string[] };
