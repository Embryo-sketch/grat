const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env before starting Grat.');
}
if (!/^https:\/\//.test(supabaseUrl)) {
  throw new Error('SUPABASE_URL must use HTTPS.');
}

export const supabaseConfig = { url: supabaseUrl, publishableKey };
export class SupabaseError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function supabaseFetch(path, { token, method = 'GET', body, prefer } = {}) {
  const headers = { apikey: publishableKey, authorization: `Bearer ${token || publishableKey}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (prefer) headers.prefer = prefer;
  let response;
  try {
    response = await fetch(`${supabaseUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new SupabaseError('Supabase could not be reached. Check the server connection and try again.', 503);
  }
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const status = response.status === 401 || response.status === 403 ? response.status : 400;
    const message = data?.message || data?.msg || data?.error_description || data?.hint || 'Supabase rejected the request.';
    throw new SupabaseError(message, status);
  }
  return data;
}

export async function getAuthenticatedUser(token) {
  if (!token || token.length > 8192) throw new SupabaseError('Sign in to continue.', 401);
  try {
    return await supabaseFetch('/auth/v1/user', { token });
  } catch (error) {
    if (error.statusCode === 400) error.statusCode = 401;
    throw error;
  }
}

export async function getProfile(token, userId) {
  const rows = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,full_name,role`, { token });
  if (!Array.isArray(rows) || !rows[0]) throw new SupabaseError('Your Grat profile is not ready yet. Contact support.', 403);
  return rows[0];
}

function mapRequest(row) {
  const profile = row.profiles || {};
  return {
    id: row.id,
    customer: { id: row.customer_id, name: profile.full_name || '', email: profile.email || '' },
    fromAccount: row.from_account,
    recipient: row.recipient,
    bank: row.bank,
    accountLast4: row.account_last4,
    amountCents: Number(row.amount_cents),
    memo: row.memo,
    status: row.status,
    staffNote: row.staff_note,
    ...(row.payout_provider ? { payout: {
      provider: row.payout_provider,
      reference: row.payout_reference,
      amountCents: Number(row.payout_amount_cents),
      sentAt: row.payout_sent_at,
    } } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    history: (row.transfer_request_history || []).map(item => ({
      status: item.status, actor: item.actor_id === row.customer_id ? 'Customer' : 'Staff', note: item.note, at: item.created_at,
    })),
  };
}

const requestSelect = '*,profiles!transfer_requests_customer_id_fkey(id,full_name,email),transfer_request_history(status,actor_id,note,created_at)';
export async function listTransferRequests(token) {
  const rows = await supabaseFetch(`/rest/v1/transfer_requests?select=${encodeURIComponent(requestSelect)}&order=created_at.desc`, { token });
  return rows.map(mapRequest);
}

export async function createTransferRequest(token, customerId, input) {
  const rows = await supabaseFetch('/rest/v1/transfer_requests?select=*', {
    token, method: 'POST', prefer: 'return=representation',
    body: {
      customer_id: customerId,
      from_account: input.fromAccount.trim(),
      recipient: input.recipient.trim(),
      bank: input.bank.trim(),
      account_last4: input.accountLast4,
      amount_cents: input.amountCents,
      memo: (input.memo ?? '').trim(),
    },
  });
  if (!Array.isArray(rows) || !rows[0]) throw new SupabaseError('The request was not saved.', 500);
  const [saved] = await supabaseFetch(`/rest/v1/transfer_requests?id=eq.${encodeURIComponent(rows[0].id)}&select=${encodeURIComponent(requestSelect)}`, { token });
  return mapRequest(saved);
}

const allowedTransitions = {
  submitted: ['under_review', 'rejected'],
  under_review: ['needs_info', 'approved', 'rejected'],
  needs_info: ['under_review', 'rejected'],
  approved: ['sent'], sent: [], rejected: [],
};

export async function updateTransferRequest(token, id, input) {
  const [current] = await supabaseFetch(`/rest/v1/transfer_requests?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(requestSelect)}`, { token });
  if (!current) throw new SupabaseError('Transfer request not found.', 404);
  if (!allowedTransitions[current.status]?.includes(input.status)) throw new SupabaseError('That status change is not allowed.', 409);
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.trim().length > 240)) {
    throw new SupabaseError('Staff notes must be 240 characters or fewer.', 400);
  }
  const patch = { status: input.status, updated_at: new Date().toISOString() };
  if (input.note !== undefined) patch.staff_note = input.note.trim();
  if (input.status === 'sent') {
    if (typeof input.externalProvider !== 'string' || input.externalProvider.trim().length < 2 || input.externalProvider.trim().length > 80
      || typeof input.externalReference !== 'string' || input.externalReference.trim().length < 3 || input.externalReference.trim().length > 160
      || !Number.isSafeInteger(input.payoutAmountCents) || input.payoutAmountCents <= 0) {
      throw new SupabaseError('Enter the off-ramp, external reference, and amount sent.', 400);
    }
    patch.payout_provider = input.externalProvider.trim();
    patch.payout_reference = input.externalReference.trim();
    patch.payout_amount_cents = input.payoutAmountCents;
    patch.payout_sent_at = new Date().toISOString();
  }
  const updated = await supabaseFetch(`/rest/v1/transfer_requests?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(requestSelect)}`, {
    token, method: 'PATCH', prefer: 'return=representation', body: patch,
  });
  if (!updated?.[0]) throw new SupabaseError('The request could not be updated.', 409);
  const [saved] = await supabaseFetch(`/rest/v1/transfer_requests?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(requestSelect)}`, { token });
  return mapRequest(saved);
}

function mapLedgerEntry(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.entry_type,
    amountCents: Number(row.amount_cents),
    description: row.description,
    externalReference: row.external_reference,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function getAccountBalance(token, customerId) {
  const rows = await supabaseFetch('/rest/v1/rpc/get_grat_account_balance', {
    token, method: 'POST', body: { p_customer_id: customerId },
  });
  const row = rows?.[0];
  if (!row) throw new SupabaseError('Account balance could not be loaded.', 500);
  return {
    balanceCents: Number(row.balance_cents),
    entryCount: Number(row.entry_count),
    lastEntryAt: row.last_entry_at,
  };
}

export async function listAccountLedgerEntries(token, customerId) {
  const rows = await supabaseFetch(`/rest/v1/account_ledger_entries?customer_id=eq.${encodeURIComponent(customerId)}&select=id,customer_id,entry_type,amount_cents,description,external_reference,created_by,created_at&order=created_at.desc&limit=100`, { token });
  return rows.map(mapLedgerEntry);
}

export async function listCustomerAccountBalances(token) {
  const rows = await supabaseFetch('/rest/v1/rpc/get_grat_account_balances', {
    token, method: 'POST', body: {},
  });
  return rows.map(row => ({
    customerId: row.customer_id,
    fullName: row.full_name,
    email: row.email,
    balanceCents: Number(row.balance_cents),
    entryCount: Number(row.entry_count),
    lastEntryAt: row.last_entry_at,
  }));
}

export async function recordAccountLedgerEntry(token, input) {
  const rows = await supabaseFetch('/rest/v1/rpc/record_grat_ledger_entry', {
    token, method: 'POST', body: {
      p_customer_id: input.customerId,
      p_entry_type: input.type,
      p_amount_cents: input.amountCents,
      p_description: input.description.trim(),
      p_external_reference: input.externalReference?.trim() || null,
    },
  });
  if (!rows?.[0]) throw new SupabaseError('The ledger entry was not recorded.', 500);
  return mapLedgerEntry(rows[0]);
}
