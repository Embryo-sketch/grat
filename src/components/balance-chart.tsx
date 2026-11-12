import type { LedgerEntry } from "@/lib/supabase";

export function BalanceChart({ entries, balanceCents }: { entries: LedgerEntry[]; balanceCents: number }) {
  if (!entries.length) return <div className="ridge grid place-items-center"><p className="sub">Your balance history will appear after Grat staff records the first ledger entry.</p></div>;
  const ascending = [...entries].reverse();
  const recentNet = ascending.reduce((sum, entry) => sum + (entry.entry_type === "credit" ? 1 : -1) * Number(entry.amount_cents), 0);
  let running = balanceCents - recentNet;
  const values = [running];
  for (const entry of ascending) {
    running += (entry.entry_type === "credit" ? 1 : -1) * Number(entry.amount_cents);
    values.push(running);
  }
  const low = Math.min(...values), high = Math.max(...values);
  const span = Math.max(1, high - low);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1) * 800).toFixed(1)},${(260 - (value-low)/span*220).toFixed(1)}`);
  const line = points.join(" ");
  return <div className="ridge" aria-label={`Balance history chart showing ${entries.length} recent ledger entries`} role="img"><svg viewBox="0 0 800 280" preserveAspectRatio="none" aria-hidden="true"><polygon points={`0,280 ${line} 800,280`} className="area"/><polyline points={line} className="line"/></svg><div className="scrub"/><div className="knob" style={{left:"100%",top:`${(260-(balanceCents-low)/span*220)/280*100}%`}}/></div>;
}
