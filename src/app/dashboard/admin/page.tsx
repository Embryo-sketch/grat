import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AdminRoleForm } from "@/components/admin-role-form";
import { ReviewForm } from "@/components/review-form";
import { getAdminUsers, getCustomerBalances, getRequests, requireIdentity } from "@/lib/supabase";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const statusName = (status: string) => status.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());

export default async function AdminPage() {
  const identity = await requireIdentity();
  if (!identity) redirect("/login");
  if (identity.profile.role !== "admin") notFound();

  const [usersResult, balancesResult, requestsResult] = await Promise.allSettled([
    getAdminUsers(identity.token),
    getCustomerBalances(identity.token),
    getRequests(identity.token),
  ]);
  const users = usersResult.status === "fulfilled" ? usersResult.value : [];
  const balances = balancesResult.status === "fulfilled" ? balancesResult.value : [];
  const requests = requestsResult.status === "fulfilled" ? requestsResult.value : [];
  const userError = usersResult.status === "rejected" ? (usersResult.reason instanceof Error ? usersResult.reason.message : "User list is unavailable.") : "";
  const requestError = requestsResult.status === "rejected" ? (requestsResult.reason instanceof Error ? requestsResult.reason.message : "Transactions are unavailable.") : "";
  const balanceError = balancesResult.status === "rejected" ? (balancesResult.reason instanceof Error ? balancesResult.reason.message : "Balance summaries are unavailable.") : "";
  const balanceByUser = new Map(balances.map(item => [item.customer_id, item]));
  const openRequests = requests.filter(request => !["sent", "rejected"].includes(request.status));
  const roleCounts = users.reduce((counts, user) => ({ ...counts, [user.role]: counts[user.role] + 1 }), { customer: 0, staff: 0, admin: 0 });
  const totalRecordedBalance = balances.reduce((total, item) => total + Number(item.balance_cents), 0);

  return <section className="page-content admin-page">
    <div className="section-heading admin-heading"><div><p className="eyebrow">GRAT OPERATIONS</p><h2>Admin dashboard</h2><p>Manage account access, review transfer requests, and oversee recorded ledger balances.</p></div><Link className="btn" href="/dashboard/accounts">Manage ledger</Link></div>

    <div className="admin-metrics" aria-label="Administration summary">
      <article className="admin-metric"><span>Customer accounts</span><strong>{roleCounts.customer}</strong><small>{roleCounts.staff} staff · {roleCounts.admin} admins</small></article>
      <article className="admin-metric"><span>Requests in progress</span><strong>{openRequests.length}</strong><small>Submitted through payout review</small></article>
      <article className="admin-metric"><span>Recorded customer balances</span><strong>{money(totalRecordedBalance)}</strong><small>{balanceError ? "Balance summary unavailable" : "Calculated from posted ledger entries"}</small></article>
    </div>

    <div className="panel admin-panel"><div className="admin-panel-heading"><div><h3>User access</h3><p>Change a user between customer, staff, and admin roles. Your own role is protected.</p></div><span className="admin-count">{users.length}{users.length === 250 ? "+" : ""} users</span></div>
      {userError ? <p className="notice error">{userError}</p> : users.length ? <div className="table-wrap"><table className="data-table admin-users-table"><thead><tr><th>User</th><th>Joined</th><th>Role</th><th>Recorded balance</th><th>Ledger entries</th><th>Access controls</th></tr></thead><tbody>{users.map(user=>{
        const balance = balanceByUser.get(user.id);
        return <tr key={user.id}><td><strong>{user.full_name || "Unnamed user"}</strong><small>{user.email}</small></td><td>{date(user.created_at)}</td><td><span className={`admin-role-tag role-${user.role}`}>{user.role}</span></td><td>{user.role === "customer" ? (balance ? money(balance.balance_cents) : balanceError ? "Unavailable" : money(0)) : "—"}</td><td>{user.role === "customer" ? (balance?.entry_count ?? (balanceError ? "—" : 0)) : "—"}</td><td><AdminRoleForm userId={user.id} role={user.role} isCurrentUser={user.id === identity.user.id}/></td></tr>;
      })}</tbody></table></div> : <p>No users found.</p>}
    </div>

    <div className="panel admin-panel"><div className="admin-panel-heading"><div><h3>Transfer requests</h3><p>Review customer submissions and record externally completed payouts.</p></div><span className="admin-count">{requests.length} total</span></div>
      {requestError ? <p className="notice error">{requestError}</p> : requests.length ? <div className="request-list">{requests.map(request=><article className="request-card admin-request-card" key={request.id}>
        <div className="request-card-head"><div><span className={`status-pill status-${request.status}`}>{statusName(request.status)}</span><h4>{request.recipient} <span>· {money(request.amount_cents)}</span></h4><small>{request.profiles?.full_name || "Customer"} · {request.profiles?.email || ""} · {date(request.created_at)}</small></div></div>
        <dl className="request-details"><div><dt>Bank</dt><dd>{request.bank}</dd></div><div><dt>Account</dt><dd>•••• {request.account_last4}</dd></div><div><dt>From</dt><dd>{request.from_account}</dd></div>{request.memo&&<div><dt>Note</dt><dd>{request.memo}</dd></div>}</dl>
        {request.staff_note&&<p className="staff-note"><strong>Staff update:</strong> {request.staff_note}</p>}
        {request.payout_reference&&<p className="staff-note">External payout recorded: {request.payout_provider} · {request.payout_reference} · {money(request.payout_amount_cents || 0)}</p>}
        {!(["sent", "rejected"].includes(request.status))&&<ReviewForm requestId={request.id} status={request.status}/>}
      </article>)}</div> : <p>No transfer requests have been submitted.</p>}
    </div>
    <p className="helper-copy">Grat records transfer requests and staff-entered ledger activity. The portal does not hold funds or execute payments.</p>
  </section>;
}
