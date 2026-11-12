import { LedgerForm } from "@/components/ledger-form";
import { getBalance, getCustomerBalances, getLedger, requireIdentity } from "@/lib/supabase";
import { redirect } from "next/navigation";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default async function AccountsPage() {
  const identity = await requireIdentity();
  if (!identity) redirect("/login");
  const staff = ["staff", "admin"].includes(identity.profile.role);

  if (staff) {
    let customers: Awaited<ReturnType<typeof getCustomerBalances>> = [];
    let loadError = "";
    try { customers = await getCustomerBalances(identity.token); }
    catch (error) { loadError = error instanceof Error ? error.message : "Account balances are unavailable."; }
    return <section className="page-content">
      <div className="section-heading"><div><p className="eyebrow">CUSTOMER ACCOUNTS</p><h2>Accounts</h2><p>Review recorded customer balances and add entries after external funds are confirmed.</p></div></div>
      <div className="panel"><h3>Customer balances</h3>{loadError ? <p className="notice error">{loadError} Apply the account ledger migration in Supabase to enable balances.</p> : customers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Recorded balance</th><th>Entries</th><th>Last activity</th><th>Record entry</th></tr></thead><tbody>{customers.map(customer=><tr key={customer.customer_id}><td><strong>{customer.full_name || "Customer"}</strong><small>{customer.email}</small></td><td>{money(customer.balance_cents)}</td><td>{customer.entry_count}</td><td>{customer.last_entry_at ? date(customer.last_entry_at) : "No entries"}</td><td><LedgerForm customerId={customer.customer_id}/></td></tr>)}</tbody></table></div> : <p>No customer balances are available yet.</p>}</div>
      <p className="helper-copy">Balances reflect ledger entries recorded in Grat. They do not represent funds held by this portal.</p>
    </section>;
  }

  let balance = { balance_cents: 0, entry_count: 0, last_entry_at: null as string | null };
  let entries: Awaited<ReturnType<typeof getLedger>> = [];
  let loadError = "";
  try { [balance, entries] = await Promise.all([getBalance(identity.token, identity.user.id), getLedger(identity.token, identity.user.id)]); }
  catch (error) { loadError = error instanceof Error ? error.message : "Account details are unavailable."; }
  return <section className="page-content">
    <div className="section-heading"><div><p className="eyebrow">YOUR PROFILE</p><h2>Accounts</h2><p>Your balance is calculated from entries recorded by the Grat team.</p></div></div>
    {loadError ? <p className="notice error">{loadError} The balance ledger may not be enabled yet.</p> : <>
      <div className="balance-card"><span>Recorded balance · USD</span><strong>{money(balance.balance_cents)}</strong><small>{balance.entry_count} ledger {balance.entry_count===1?"entry":"entries"}{balance.last_entry_at ? ` · Updated ${date(balance.last_entry_at)}` : " · No entries recorded yet"}</small></div>
      <div className="panel"><h3>Account activity</h3>{entries.length ? <div className="activity-list">{entries.map(entry=><article className="activity-row" key={entry.id}><span className={`activity-icon ${entry.entry_type}`}>{entry.entry_type==="credit"?"+":"−"}</span><div><strong>{entry.description}</strong><small>{date(entry.created_at)}{entry.external_reference?` · Ref ${entry.external_reference}`:""}</small></div><b className={entry.entry_type}>{entry.entry_type==="credit"?"+":"−"}{money(entry.amount_cents)}</b></article>)}</div> : <p>Your account activity will appear here when a ledger entry is recorded.</p>}</div>
    </>}
    <p className="helper-copy">Grat records requests for manual review. The recorded balance is not a bank balance, and Grat does not hold or move funds.</p>
  </section>;
}
