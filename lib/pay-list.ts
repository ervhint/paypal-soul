import type { Payment } from "@/lib/types";

/** Rows a long payment list shows at a time. */
export const PAGE = 20;
const TOP = 5;

/** What was spent in each category, biggest first. Past the top 5 they fold into Other Categories. Money received isn't spending. */
export function categoryTotals(pays: Payment[]) {
  const cents = new Map<string, number>();
  for (const p of pays) if (p.amount > 0) cents.set(p.category, (cents.get(p.category) ?? 0) + Math.round(p.amount * 100));
  const all = [...cents].map(([category, c]) => ({ category, spent: c / 100 })).sort((a, b) => b.spent - a.spent);
  if (all.length <= TOP) return all;
  const rest = all.slice(TOP).reduce((sum, c) => sum + Math.round(c.spent * 100), 0);
  return [...all.slice(0, TOP), { category: "Other Categories", spent: rest / 100 }];
}
