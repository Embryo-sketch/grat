import {
  getAccountBalance, listAccountLedgerEntries, listCustomerAccountBalances, recordAccountLedgerEntry,
  createTransferRequest, getAuthenticatedUser, getProfile, listTransferRequests,
  SupabaseError, supabaseConfig, updateTransferRequest,
} from './supabase-store.mjs';

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.end(JSON.stringify(body));
}

function methodNotAllowed(response, allowed) {
  response.setHeader('allow', allowed.join(', '));
  sendJson(response, 405, { error: 'Method not allowed' });
}

function getToken(request) {
  return (request.headers.authorization ?? '').match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
}

async function requireUser(request) {
  const token = getToken(request);
  const user = await getAuthenticatedUser(token);
  const profile = await getProfile(token, user.id);
  return { token, user, profile };
}

async function bodyOf(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }); }
}

function isShortText(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

async function run(response, operation) {
  try { await operation(); }
  catch (error) {
    if (!error.statusCode) console.error('Supabase API request failed:', error.message);
    sendJson(response, error.statusCode ?? 500, { error: error.statusCode ? error.message : 'The request could not be completed.' });
  }
}

export async function config(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed(response, ['GET', 'HEAD']);
  sendJson(response, 200, { supabaseUrl: supabaseConfig.url, publishableKey: supabaseConfig.publishableKey });
}

export async function health(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed(response, ['GET', 'HEAD']);
  sendJson(response, 200, { status: 'ok', service: 'grat', database: 'supabase-configured' });
}

export async function me(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  await run(response, async () => {
    const { user, profile } = await requireUser(request);
    sendJson(response, 200, { id: user.id, email: user.email, fullName: profile.full_name, role: profile.role });
  });
}

export async function transferRequests(request, response) {
  if (request.method === 'GET') {
    return run(response, async () => {
      const { token } = await requireUser(request);
      sendJson(response, 200, await listTransferRequests(token));
    });
  }
  if (request.method === 'POST') {
    return run(response, async () => {
      const { token, user } = await requireUser(request);
      const body = await bodyOf(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SupabaseError('Invalid request body.', 400);
      const valid = isShortText(body.fromAccount, 2, 80)
        && isShortText(body.recipient, 2, 100)
        && isShortText(body.bank, 2, 100)
        && typeof body.accountLast4 === 'string' && /^\d{4}$/.test(body.accountLast4)
        && Number.isSafeInteger(body.amountCents) && body.amountCents > 0
        && (body.memo === undefined || (typeof body.memo === 'string' && body.memo.trim().length <= 120));
      if (!valid) throw new SupabaseError('Check the transfer request details and try again.', 400);
      sendJson(response, 201, await createTransferRequest(token, user.id, body));
    });
  }
  return methodNotAllowed(response, ['GET', 'POST']);
}

export async function transferRequest(request, response) {
  if (request.method !== 'PATCH') return methodNotAllowed(response, ['PATCH']);
  return run(response, async () => {
    const { token, profile } = await requireUser(request);
    if (!['staff', 'admin'].includes(profile.role)) throw new SupabaseError('Staff access is required.', 403);
    const id = request.query?.id;
    if (typeof id !== 'string' || !/^[\w-]+$/.test(id)) throw new SupabaseError('Invalid transfer request ID.', 400);
    const body = await bodyOf(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SupabaseError('Invalid request body.', 400);
    sendJson(response, 200, await updateTransferRequest(token, id, body));
  });
}

export async function accountLedger(request, response) {
  if (request.method === 'GET') {
    return run(response, async () => {
      const { token, user } = await requireUser(request);
      const [balance, entries] = await Promise.all([
        getAccountBalance(token, user.id), listAccountLedgerEntries(token, user.id),
      ]);
      sendJson(response, 200, { ...balance, entries });
    });
  }
  if (request.method === 'POST') {
    return run(response, async () => {
      const { token, profile } = await requireUser(request);
      if (!['staff', 'admin'].includes(profile.role)) throw new SupabaseError('Staff access is required to post ledger entries.', 403);
      const body = await bodyOf(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SupabaseError('Invalid request body.', 400);
      const valid = typeof body.customerId === 'string' && /^[\w-]{36}$/.test(body.customerId)
        && ['credit', 'debit'].includes(body.type)
        && Number.isSafeInteger(body.amountCents) && body.amountCents > 0
        && isShortText(body.description, 2, 160)
        && (body.externalReference === undefined || body.externalReference === null
          || (typeof body.externalReference === 'string' && body.externalReference.trim().length <= 160));
      if (!valid) throw new SupabaseError('Check the customer, entry type, amount, and description.', 400);
      sendJson(response, 201, await recordAccountLedgerEntry(token, body));
    });
  }
  return methodNotAllowed(response, ['GET', 'POST']);
}

export async function adminAccounts(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  return run(response, async () => {
    const { token, profile } = await requireUser(request);
    if (!['staff', 'admin'].includes(profile.role)) throw new SupabaseError('Staff access is required.', 403);
    sendJson(response, 200, await listCustomerAccountBalances(token));
  });
}
