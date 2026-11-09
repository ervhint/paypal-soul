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
};
export type Memory = {
  id: string;
  kind: "habit" | "check" | "interest" | "support" | "told";
  text: string;
  sure: "Sure" | "Fairly Sure" | "Not Sure";
  source: string;
  paymentIds: string[];
  active: boolean;
  oneOff?: boolean; // a one-time thing the person kept apart from the pattern (U17)
};
export type Change = { id: string; claimId: string; before: string; after: string; notes: string[]; canUndo: boolean };
/** The I Noticed card (U18): code's sentence and question about one unusual payment, and the payments compared. */
export type Notice = { chapterId: string; claimId: string; paymentId: string; sentence: string; question: string; paymentIds: string[] };
