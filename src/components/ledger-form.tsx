"use client";

import { useActionState } from "react";
import { postLedgerEntry, type ActionState } from "@/app/auth-actions";

export function LedgerForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(postLedgerEntry, undefined);
  return <form action={action} className="grat-form mt-4">
    <input type="hidden" name="customerId" value={customerId} />
    <div className="field-row"><label>Adjustment<select name="type"><option value="credit">Add to balance</option><option value="debit">Remove from balance</option></select></label><label>Amount (USD)<input name="amount" type="number" min="0.01" step="0.01" required /></label></div>
    <label>Reason for adjustment<input name="description" maxLength={160} required /></label>
    <label>External reference (optional)<input name="reference" maxLength={160} /></label>
    <small className="ledger-form-help">This changes the recorded Grat balance and creates an audit entry. It does not move money.</small>
    {state?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    {state?.notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{state.notice}</p>}
    <button className="btn small" type="submit" disabled={pending}>{pending ? "Saving…" : "Post ledger entry"}</button>
  </form>;
}
