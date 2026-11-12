import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createTransferRequest, getAccountBalance, getAuthenticatedUser, getProfile,
  listAccountLedgerEntries, listCustomerAccountBalances, listTransferRequests,
  recordAccountLedgerEntry, SupabaseError, supabaseConfig, updateTransferRequest,
} from './src/supabase-store.mjs';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = resolve(projectRoot, 'public');
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

async function readJson(request, maxBytes = 16_384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 });
  }
}

function isShortText(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function bearerToken(request) {
  const match = (request.headers.authorization ?? '').match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? '';
}

async function requireUser(request) {
  const token = bearerToken(request);
  const user = await getAuthenticatedUser(token);
  const profile = await getProfile(token, user.id);
  return { token, user, profile };
}

async function handleTransferRequests(request, response, pathname) {
  const collectionPath = '/api/transfer-requests';
  if (pathname === collectionPath && request.method === 'GET') {
    try {
      const { token } = await requireUser(request);
      sendJson(response, 200, await listTransferRequests(token));
    } catch (error) {
      sendJson(response, error.statusCode ?? 500, { error: error.message });
    }
    return true;
  }

  if (pathname === collectionPath && request.method === 'POST') {
    try {
      const { token, user } = await requireUser(request);
      const body = await readJson(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(response, 400, { error: 'Invalid request body.' });
        return true;
      }
      const valid = isShortText(body.fromAccount, 2, 80)
        && isShortText(body.recipient, 2, 100)
        && isShortText(body.bank, 2, 100)
        && typeof body.accountLast4 === 'string' && /^\d{4}$/.test(body.accountLast4)
        && Number.isSafeInteger(body.amountCents) && body.amountCents > 0
        && (body.memo === undefined || (typeof body.memo === 'string' && body.memo.trim().length <= 120));
      if (!valid) {
        sendJson(response, 400, { error: 'Check the transfer request details and try again.' });
        return true;
      }
      sendJson(response, 201, await createTransferRequest(token, user.id, body));
    } catch (error) {
      if (!error.statusCode) console.error('Could not save transfer request:', error.message);
      sendJson(response, error.statusCode ?? 500, { error: error.statusCode ? error.message : 'Could not save the transfer request.' });
    }
    return true;
  }

  const match = pathname.match(/^\/api\/transfer-requests\/([\w-]+)$/);
  if (match && request.method === 'PATCH') {
    try {
      const { token, profile } = await requireUser(request);
      if (!['staff', 'admin'].includes(profile.role)) throw new SupabaseError('Staff access is required.', 403);
      const body = await readJson(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(response, 400, { error: 'Invalid request body.' });
        return true;
      }
      sendJson(response, 200, await updateTransferRequest(token, match[1], body));
    } catch (error) {
      if (!error.statusCode) console.error('Could not update transfer request:', error.message);
      sendJson(response, error.statusCode ?? 500, { error: error.statusCode ? error.message : 'Could not update the transfer request.' });
    }
    return true;
  }

  return false;
}

async function handleAccountLedger(request, response, pathname) {
  if (pathname === '/api/account-ledger' && request.method === 'GET') {
    try {
      const { token, user } = await requireUser(request);
      const [balance, entries] = await Promise.all([
        getAccountBalance(token, user.id), listAccountLedgerEntries(token, user.id),
      ]);
      sendJson(response, 200, { ...balance, entries });
    } catch (error) {
      sendJson(response, error.statusCode ?? 500, { error: error.statusCode ? error.message : 'Could not load the account ledger.' });
    }
    return true;
  }
  if (pathname === '/api/account-ledger' && request.method === 'POST') {
    try {
      const { token, profile } = await requireUser(request);
      if (!['staff', 'admin'].includes(profile.role)) throw new SupabaseError('Staff access is required to post ledger entries.', 403);
      const body = await readJson(request);
      const valid = body && typeof body === 'object' && !Array.isArray(body)
        && typeof body.customerId === 'string' && /^[\w-]{36}$/.test(body.customerId)
        && ['credit', 'debit'].includes(body.type)
        && Number.isSafeInteger(body.amountCents) && body.amountCents > 0
        && isShortText(body.description, 2, 160)
        && (body.externalReference === undefined || body.externalReference === null
          || (typeof body.externalReference === 'string' && body.externalReference.trim().length <= 160));
      if (!valid) throw new SupabaseError('Check the customer, entry type, amount, and description.', 400);
      sendJson(response, 201, await recordAccountLedgerEntry(token, body));
    } catch (error) {
      sendJson(response, error.statusCode ?? 500, { error: error.statusCode ? error.message : 'Could not record the ledger entry.' });
    }
    return true;
  }
  if (pathname === '/api/admin/accounts' && request.method === 'GET') {
    try {
      const { token, profile } = await requireUser(request);
      if (!['staff', 'admin'].includes(profile.role)) throw new SupabaseError('Staff access is required.', 403);
      sendJson(response, 200, await listCustomerAccountBalances(token));
    } catch (error) {
      sendJson(response, error.statusCode ?? 500, { error: error.statusCode ? error.message : 'Could not load customer accounts.' });
    }
    return true;
  }
  return false;
}

const server = createServer(async (request, response) => {
  const method = request.method ?? 'GET';
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    sendJson(response, 400, { error: 'Invalid URL' });
    return;
  }

  if (pathname === '/api/health') {
    if (method !== 'GET' && method !== 'HEAD') {
      response.setHeader('allow', 'GET, HEAD');
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    sendJson(response, 200, { status: 'ok', service: 'grat', database: 'supabase-configured' });
    return;
  }

  if (pathname === '/api/config') {
    if (method !== 'GET' && method !== 'HEAD') {
      response.setHeader('allow', 'GET, HEAD');
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    sendJson(response, 200, { supabaseUrl: supabaseConfig.url, publishableKey: supabaseConfig.publishableKey });
    return;
  }

  if (pathname === '/api/me' && method === 'GET') {
    try {
      const { user, profile } = await requireUser(request);
      sendJson(response, 200, { id: user.id, email: user.email, fullName: profile.full_name, role: profile.role });
    } catch (error) {
      sendJson(response, error.statusCode ?? 500, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/')) {
    if (await handleAccountLedger(request, response, pathname)) return;
    if (await handleTransferRequests(request, response, pathname)) return;
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    response.setHeader('allow', 'GET, HEAD');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = resolve(publicRoot, `.${requestedPath}`);
  const relativePath = relative(publicRoot, filePath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
    response.end(method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }
    sendJson(response, 500, { error: 'Internal server error' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Grat is available at http://localhost:${port}`);
});
