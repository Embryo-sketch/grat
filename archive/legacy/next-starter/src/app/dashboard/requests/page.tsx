import { RequestForm } from "@/components/request-form";
import { ReviewForm } from "@/components/review-form";
import { getRequests, requireIdentity } from "@/lib/supabase";
import { redirect } from "next/navigation";

const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const statusName = (status: string) => status.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());

export default async function RequestsPage() {
  const identity = await requireIdentity();
  if (!identity) redirect("/login");
  const staff = ["staff", "admin"].includes(identity.profile.role);
  let requests: Awaited<ReturnType<typeof getRequests>> = [];
  let loadError = "";
  try { requests = await getRequests(identity.token); }
  catch (error) { loadError = error instanceof Error ? error.message : "Requests are unavailable."; }
  return <section className="page-content">
    <div className="section-heading"><div><p className="eyebrow">{staff?"OPERATIONS":"YOUR PROFILE"}</p><h2>{staff?"Request review":"Requests"}</h2><p>{staff?"Review customer submissions and record confirmed external payouts.":"Submit a request and follow its review status here."}</p></div></div>
    {!staff && <div className="panel request-create" id="new-request"><h3>New transfer request</h3><p>Requests are reviewed manually. Submitting one does not send money.</p><RequestForm/></div>}
    <div className="panel"><h3>{staff?"Customer requests":"Request history"}</h3>{loadError ? <p className="notice error">{loadError}</p> : requests.length ? <div className="request-list">{requests.map(request=><article className="request-card" key={request.id}>
      <div className="request-card-head"><div><span className={`status-pill status-${request.status}`}>{statusName(request.status)}</span><h4>{request.recipient} <span>· {money(request.amount_cents)}</span></h4><small>{staff?`${request.profiles?.full_name || "Customer"} · ${request.profiles?.email || ""} · `:""}{date(request.created_at)}</small></div></div>
      <dl className="request-details"><div><dt>Bank</dt><dd>{request.bank}</dd></div><div><dt>Account</dt><dd>•••• {request.account_last4}</dd></div><div><dt>From</dt><dd>{request.from_account}</dd></div>{request.memo&&<div><dt>Note</dt><dd>{request.memo}</dd></div>}</dl>
      {request.staff_note&&<p className="staff-note"><strong>Staff update:</strong> {request.staff_note}</p>}
      {request.payout_reference&&<p className="staff-note">External payout recorded: {request.payout_provider} · {request.payout_reference} · {money(request.payout_amount_cents || 0)}</p>}
      {staff&&<ReviewForm requestId={request.id} status={request.status}/>}
    </article>)}</div> : <p>{staff?"There are no requests to review yet.":"You have not submitted any requests yet."}</p>}</div>
  </section>;
}
