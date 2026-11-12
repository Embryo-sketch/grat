import Link from "next/link";
import { BalanceChart } from "@/components/balance-chart";
import { getBalance, getLedger, getRequests, requireIdentity, type AccountBalance, type LedgerEntry, type TransferRequest } from "@/lib/supabase";

const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const statusLabel: Record<string,string> = { submitted:"Submitted", under_review:"Under review", needs_info:"Needs information", approved:"Approved for manual payout", sent:"Payout recorded", rejected:"Declined" };

export default async function DashboardHome() {
  const identity = await requireIdentity();
  if (!identity) return null;
  const [balanceResult, ledgerResult, requestsResult] = await Promise.allSettled([
    getBalance(identity.token, identity.user.id), getLedger(identity.token, identity.user.id), getRequests(identity.token),
  ]);
  const balance: AccountBalance | null = balanceResult.status === "fulfilled" ? balanceResult.value : null;
  const ledger: LedgerEntry[] = ledgerResult.status === "fulfilled" ? ledgerResult.value : [];
  const requests: TransferRequest[] = requestsResult.status === "fulfilled" ? requestsResult.value : [];
  const openCount = requests.filter(item => !["sent", "rejected"].includes(item.status)).length;
  const balanceMessage = balance ? null : "Apply the account-ledger migration in Supabase to show your recorded balance.";

  return <>
    <section className="grat-overview" aria-labelledby="balance-title"><div><p className="hero-label" id="balance-title">Recorded balance <span className="sub">· USD · staff ledger</span></p><p className="total amt">{balance ? usd(Number(balance.balance_cents)) : "Unavailable"}</p><p className="delta">{balanceMessage || (balance?.entry_count ? `Based on ${balance.entry_count} staff-posted entries` : "No ledger entries have been posted yet")}</p></div><div className="grat-metrics"><div className="grat-metric"><span>Open requests</span><strong>{openCount}</strong><small>Awaiting a final status</small></div></div></section>
    <BalanceChart entries={ledger} balanceCents={Number(balance?.balance_cents || 0)}/>
    <div className="grat-actions" role="group" aria-label="Quick actions"><Link className="grat-action primary" href="/dashboard/requests#new-request"><span className="grat-action-icon">⇄</span>New transfer request</Link><Link className="grat-action" href="/dashboard/requests"><span className="grat-action-icon">▤</span>View requests</Link><Link className="grat-action" href="/dashboard/accounts"><span className="grat-action-icon">▣</span>Accounts</Link><Link className="grat-action" href="/dashboard/profile"><span className="grat-action-icon">♙</span>Profile</Link></div>

    <div className="grat-grid mt-5"><div className="grid gap-4"><section className="grat-panel"><div className="ph"><h2>Recent requests</h2><Link href="/dashboard/requests" className="link">See all</Link></div>{requests.length?requests.slice(0,4).map(request=><div className="grat-ledger-row" key={request.id}><div><strong>{request.recipient}</strong><div className="sub">{date(request.created_at)} · {request.bank}</div></div><div className="text-right"><strong>{usd(Number(request.amount_cents))}</strong><div><span className={`tag ${request.status==="approved"||request.status==="sent"?"ok":request.status==="rejected"?"warn":"pend"}`}>{statusLabel[request.status]||request.status}</span></div></div></div>):<p className="grat-empty">No transfer requests yet.</p>}</section>
      <section className="grat-panel"><div className="ph"><h2>Recent account activity</h2><Link href="/dashboard/accounts" className="link">View account</Link></div>{ledger.length?ledger.slice(0,4).map(entry=><div className="grat-ledger-row" key={entry.id}><div><strong>{entry.description}</strong><div className="sub">{date(entry.created_at)}</div></div><strong className={entry.entry_type==="credit"?"grat-positive":"grat-negative"}>{entry.entry_type==="credit"?"+":"−"}{usd(Number(entry.amount_cents))}</strong></div>):<p className="grat-empty">No ledger activity has been recorded yet.</p>}</section></div>
      <section className="grat-panel"><div className="ph"><h2>Account overview</h2><Link href="/dashboard/accounts" className="link">Details</Link></div><div className="row first"><span className="nm">Customer profile</span><span className="tag ok">Active</span></div><div className="row"><span className="nm">Currency</span><strong>USD</strong></div><div className="row"><span className="nm">Ledger entries</span><strong>{balance?.entry_count ?? "—"}</strong></div><p className="sub mt-4">Your balance is maintained by staff from confirmed ledger entries.</p></section></div>
  </>;
}
