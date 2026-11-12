"use client";

import { useActionState } from "react";
import { reviewTransfer, type ActionState } from "@/app/auth-actions";

export function ReviewForm({ requestId, status }: { requestId: string; status: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reviewTransfer, undefined);
  const transitions: Record<string, string[]> = {
    submitted: ["under_review", "rejected"],
    under_review: ["needs_info", "approved", "rejected"],
    needs_info: ["under_review", "rejected"],
    approved: ["sent"],
  };
  const labels: Record<string, string> = { under_review: "Under review", needs_info: "Needs information", approved: "Approved for manual payout", sent: "Payout confirmed outside Grat", rejected: "Decline request" };
  return <details className="mt-4 border-t border-[var(--line)] pt-3"><summary className="link cursor-pointer">Review request</summary><form action={action} className="grat-form mt-3"><input type="hidden" name="requestId" value={requestId}/><label>New status<select name="status" defaultValue={transitions[status]?.[0]}>{(transitions[status] || []).map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label><label>Note for customer<textarea name="note" maxLength={240} rows={2}/></label><div className="field-row"><label>Off-app provider (required when recording payout)<input name="provider" maxLength={80}/></label><label>External reference<input name="reference" maxLength={160}/></label></div><label>Confirmed payout amount (USD)<input name="payoutAmount" type="number" min="0.01" step="0.01"/></label><p className="text-xs text-[var(--muted)]">Only record a payout after you have completed and confirmed it outside Grat.</p>{state?.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}{state?.notice&&<p role="status" className="text-sm text-emerald-700">{state.notice}</p>}<button className="btn small" type="submit" disabled={pending}>{pending?"Saving…":"Save review"}</button></form></details>;
}
