"use client";

import { useActionState } from "react";
import { createTransfer, type ActionState } from "@/app/auth-actions";

export function RequestForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTransfer, undefined);
  return <form action={action} className="grat-form">
    <div className="field-row">
      <label>From account or wallet<input name="fromAccount" maxLength={80} required /></label>
      <label>Recipient name<input name="recipient" maxLength={100} required /></label>
    </div>
    <div className="field-row">
      <label>Recipient bank<input name="bank" maxLength={100} required /></label>
      <label>Account last 4 digits<input name="accountLast4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required /></label>
    </div>
    <label>Amount (USD)<input name="amount" type="number" min="0.01" max="1000000" step="0.01" required /></label>
    <label>Note for reviewer (optional)<textarea name="memo" maxLength={120} rows={3} /></label>
    <p className="grat-notice">Submitting a request does not move money. Grat staff reviews requests manually.</p>
    {state?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    {state?.notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{state.notice}</p>}
    <button type="submit" className="btn primary" disabled={pending}>{pending ? "Submitting…" : "Submit request"}</button>
  </form>;
}
