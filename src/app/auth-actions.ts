"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authPost, config, currentAccessToken, GratError, requireIdentity, supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

type AuthResponse = { access_token?: string; refresh_token?: string; expires_in?: number; user?: { id: string } };
export type ActionState = { error?: string; notice?: string } | undefined;

async function setSession(data: AuthResponse) {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const maxAge = Math.max(60, data.expires_in || 3600);
  for (const [name, value] of [["grat_access", data.access_token], ["grat_refresh", data.refresh_token]] as const) {
    if (value) store.set(name, value, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
}

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (!email || password.length < 8) return { error: "Enter your email and password." };
  try {
    await setSession(await authPost<AuthResponse>("token?grant_type=password", { email, password }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not sign in." };
  }
  const identity = await requireIdentity();
  redirect(identity?.profile.role === "admin" ? "/dashboard/admin" : "/dashboard");
}

export async function signInAdmin(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (!email || password.length < 8) return { error: "Enter your administrator email and password." };
  try {
    await setSession(await authPost<AuthResponse>("token?grant_type=password", { email, password }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not sign in." };
  }
  const identity = await requireIdentity();
  if (!identity || identity.profile.role !== "admin") {
    const store = await cookies();
    store.delete("grat_access");
    store.delete("grat_refresh");
    return { error: "This account does not have administrator access." };
  }
  redirect("/dashboard/admin");
}

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const fullName = String(form.get("fullName") || "").trim();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (fullName.length < 2 || fullName.length > 100 || !email || password.length < 8) {
    return { error: "Enter your name, a valid email, and a password with at least 8 characters." };
  }
  try {
    const result = await authPost<AuthResponse>("signup", { email, password, data: { full_name: fullName } });
    if (!result.access_token) return { notice: "Check your email for a confirmation link, then sign in." };
    await setSession(result);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create your profile." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const token = await currentAccessToken();
  if (token) {
    try {
      const { url, key } = config();
      await fetch(`${url}/auth/v1/logout`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${token}` }, cache: "no-store" });
    } catch { /* Clear local auth even if remote sign-out fails. */ }
  }
  const store = await cookies();
  store.delete("grat_access");
  store.delete("grat_refresh");
  revalidatePath("/");
  redirect("/");
}

export async function reviewTransfer(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await import("@/lib/supabase").then(m => m.requireIdentity());
  if (!session || !["staff", "admin"].includes(session.profile.role)) return { error: "Staff access is required." };
  const id = String(form.get("requestId") || "");
  const status = String(form.get("status") || "");
  const note = String(form.get("note") || "").trim();
  if (!/^[\w-]{36}$/.test(id) || note.length > 240) return { error: "Check the review details." };
  const transitions: Record<string, string[]> = {
    submitted: ["under_review", "rejected"],
    under_review: ["needs_info", "approved", "rejected"],
    needs_info: ["under_review", "rejected"],
    approved: ["sent"],
  };
  const current = await supabase<Array<{ status: string }>>(`/rest/v1/transfer_requests?id=eq.${encodeURIComponent(id)}&select=status`, session.token);
  if (!current[0] || !transitions[current[0].status]?.includes(status)) return { error: "That status change is not allowed." };
  const patch: Record<string, unknown> = { status, staff_note: note, updated_at: new Date().toISOString() };
  if (status === "sent") {
    const externalProvider = String(form.get("provider") || "").trim();
    const externalReference = String(form.get("reference") || "").trim();
    const payoutAmountCents = Math.round(Number(form.get("payoutAmount")) * 100);
    if (externalProvider.length < 2 || externalProvider.length > 80 || externalReference.length < 3 || externalReference.length > 160 || !Number.isSafeInteger(payoutAmountCents) || payoutAmountCents < 1) return { error: "Enter the confirmed external payout provider, reference and amount." };
    patch.payout_provider = externalProvider;
    patch.payout_reference = externalReference;
    patch.payout_amount_cents = payoutAmountCents;
    patch.payout_sent_at = new Date().toISOString();
  }
  try {
    await supabase(`/rest/v1/transfer_requests?id=eq.${encodeURIComponent(id)}`, session.token, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(patch) });
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not update request." }; }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests");
  return { notice: "Request review saved." };
}

export async function createTransfer(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await import("@/lib/supabase").then(m => m.requireIdentity());
  if (!session) return { error: "Sign in again to submit a request." };
  const input = {
    from_account: String(form.get("fromAccount") || "").trim(),
    recipient: String(form.get("recipient") || "").trim(),
    bank: String(form.get("bank") || "").trim(),
    account_last4: String(form.get("accountLast4") || "").trim(),
    amount_cents: Math.round(Number(form.get("amount")) * 100),
    memo: String(form.get("memo") || "").trim(),
    customer_id: session.user.id,
  };
  if (input.from_account.length < 2 || input.recipient.length < 2 || input.bank.length < 2 || !/^\d{4}$/.test(input.account_last4) || !Number.isSafeInteger(input.amount_cents) || input.amount_cents < 1 || input.memo.length > 120) {
    return { error: "Check the transfer details and try again." };
  }
  try {
    await supabase("/rest/v1/transfer_requests", session.token, {
      method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(input),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not submit request." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests");
  return { notice: "Request submitted for manual review. No funds were moved." };
}

export async function postLedgerEntry(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await import("@/lib/supabase").then(m => m.requireIdentity());
  if (!session || !["staff", "admin"].includes(session.profile.role)) return { error: "Staff access is required." };
  const customerId = String(form.get("customerId") || "");
  const type = String(form.get("type") || "");
  const amountCents = Math.round(Number(form.get("amount")) * 100);
  const description = String(form.get("description") || "").trim();
  const reference = String(form.get("reference") || "").trim() || null;
  if (!/^[\w-]{36}$/.test(customerId) || !["credit", "debit"].includes(type) || !Number.isSafeInteger(amountCents) || amountCents < 1 || description.length < 2 || description.length > 160 || (reference && reference.length > 160)) return { error: "Check the ledger entry details." };
  try {
    await supabase("/rest/v1/rpc/record_grat_ledger_entry", session.token, {
      method: "POST", body: JSON.stringify({ p_customer_id: customerId, p_entry_type: type, p_amount_cents: amountCents, p_description: description, p_external_reference: reference }),
    });
  } catch (error) {
    return { error: error instanceof GratError ? error.message : "Could not record the ledger entry." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/admin");
  return { notice: "Ledger entry recorded." };
}

export async function updateUserRole(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await import("@/lib/supabase").then(m => m.requireIdentity());
  if (!session || session.profile.role !== "admin") return { error: "Administrator access is required." };
  const userId = String(form.get("userId") || "");
  const role = String(form.get("role") || "");
  if (!/^[\w-]{36}$/.test(userId) || !["customer", "staff", "admin"].includes(role)) {
    return { error: "Choose a valid user and access role." };
  }
  try {
    await supabase("/rest/v1/rpc/admin_set_grat_user_role", session.token, {
      method: "POST",
      body: JSON.stringify({ p_user_id: userId, p_role: role }),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the user role." };
  }
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/accounts");
  return { notice: "User access role updated." };
}
