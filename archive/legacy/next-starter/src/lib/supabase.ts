import { cookies } from "next/headers";

export type Profile = { id: string; full_name: string; email: string; role: "customer" | "staff" | "admin" };
export type SessionUser = { id: string; email: string };
export type TransferRequest = {
  id: string; customer_id: string; from_account: string; recipient: string; bank: string;
  account_last4: string; amount_cents: number; memo: string; status: string;
  staff_note: string; created_at: string; updated_at: string;
  payout_provider?: string | null; payout_reference?: string | null;
  payout_amount_cents?: number | null; payout_sent_at?: string | null;
  profiles?: { full_name: string; email: string };
};
export type LedgerEntry = {
  id: string; customer_id: string; entry_type: "credit" | "debit"; amount_cents: number;
  description: string; external_reference: string | null; created_at: string;
};
export type AccountBalance = { balance_cents: number; entry_count: number; last_entry_at: string | null };

export class GratError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new GratError("Supabase is not configured on the server.", 503);
  return { url, key };
}

export async function supabase<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  let data: unknown;
  try { data = body ? JSON.parse(body) : null; } catch { data = null; }
  if (!response.ok) {
    const error = data as { message?: string; msg?: string; error_description?: string } | null;
    const status = response.status === 401 || response.status === 403 ? response.status : 400;
    throw new GratError(error?.message || error?.msg || error?.error_description || "Supabase rejected the request.", status);
  }
  return data as T;
}

export async function authPost<T>(path: string, body: unknown): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST", cache: "no-store",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new GratError(data.msg || data.message || data.error_description || "Authentication failed.", response.status);
  return data as T;
}

export async function currentAccessToken() {
  return (await cookies()).get("grat_access")?.value || "";
}

export async function requireIdentity() {
  const token = await currentAccessToken();
  if (!token) return null;
  try {
    const user = await supabase<SessionUser>("/auth/v1/user", token);
    const rows = await supabase<Profile[]>(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email,role`, token);
    if (!rows[0]) return null;
    return { token, user, profile: rows[0] };
  } catch {
    return null;
  }
}

export async function getBalance(token: string, customerId: string) {
  const rows = await supabase<AccountBalance[]>("/rest/v1/rpc/get_grat_account_balance", token, {
    method: "POST", body: JSON.stringify({ p_customer_id: customerId }),
  });
  return rows[0] || { balance_cents: 0, entry_count: 0, last_entry_at: null };
}

export async function getLedger(token: string, customerId: string) {
  return supabase<LedgerEntry[]>(`/rest/v1/account_ledger_entries?customer_id=eq.${encodeURIComponent(customerId)}&select=id,customer_id,entry_type,amount_cents,description,external_reference,created_at&order=created_at.desc&limit=100`, token);
}

const requestSelect = "*,profiles!transfer_requests_customer_id_fkey(full_name,email)";
export async function getRequests(token: string) {
  return supabase<TransferRequest[]>(`/rest/v1/transfer_requests?select=${encodeURIComponent(requestSelect)}&order=created_at.desc`, token);
}

export async function getCustomerBalances(token: string) {
  return supabase<Array<{ customer_id: string; full_name: string; email: string; balance_cents: number; entry_count: number; last_entry_at: string | null }>>("/rest/v1/rpc/get_grat_account_balances", token, {
    method: "POST", body: "{}",
  });
}
