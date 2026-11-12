import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const databasePath = resolve(process.env.GRAT_DB_PATH || fileURLToPath(new URL('../var/grat.sqlite', import.meta.url)));
await mkdir(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath, { timeout: 5000, defensive: true });
database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = FULL;

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS transfer_requests (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    from_account TEXT NOT NULL,
    recipient TEXT NOT NULL,
    bank TEXT NOT NULL,
    account_last4 TEXT NOT NULL CHECK (account_last4 GLOB '[0-9][0-9][0-9][0-9]'),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    memo TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('submitted','under_review','needs_info','approved','sent','rejected')),
    staff_note TEXT NOT NULL DEFAULT '',
    payout_provider TEXT,
    payout_reference TEXT,
    payout_amount_cents INTEGER CHECK (payout_amount_cents IS NULL OR payout_amount_cents > 0),
    payout_sent_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (
      (status = 'sent' AND payout_provider IS NOT NULL AND payout_reference IS NOT NULL
        AND payout_amount_cents IS NOT NULL AND payout_sent_at IS NOT NULL)
      OR (status <> 'sent' AND payout_provider IS NULL AND payout_reference IS NULL
        AND payout_amount_cents IS NULL AND payout_sent_at IS NULL)
    )
  ) STRICT;

  CREATE TABLE IF NOT EXISTS transfer_request_history (
    id INTEGER PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    actor TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_transfer_requests_customer_created
    ON transfer_requests(customer_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_transfer_requests_status_created
    ON transfer_requests(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_transfer_request_history_request
    ON transfer_request_history(request_id, id);
`);

const demoCustomer = {
  id: 'demo-customer',
  name: 'Anna Meier',
  email: 'anna.meier@example.com',
};
database.prepare(`
  INSERT INTO customers (id, name, email, created_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`).run(demoCustomer.id, demoCustomer.name, demoCustomer.email, new Date().toISOString());

const selectRequest = database.prepare(`
  SELECT r.*, c.name AS customer_name, c.email AS customer_email
  FROM transfer_requests r
  JOIN customers c ON c.id = r.customer_id
  WHERE r.id = ?
`);
const selectHistory = database.prepare(`
  SELECT status, actor, note, created_at AS at
  FROM transfer_request_history
  WHERE request_id = ?
  ORDER BY id ASC
`);

export class TransferStoreError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function serializeRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    customer: { id: row.customer_id, name: row.customer_name, email: row.customer_email },
    fromAccount: row.from_account,
    recipient: row.recipient,
    bank: row.bank,
    accountLast4: row.account_last4,
    amountCents: row.amount_cents,
    memo: row.memo,
    status: row.status,
    staffNote: row.staff_note,
    ...(row.payout_provider ? {
      payout: {
        provider: row.payout_provider,
        reference: row.payout_reference,
        amountCents: row.payout_amount_cents,
        sentAt: row.payout_sent_at,
      },
    } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    history: selectHistory.all(row.id).map(item => ({
      status: item.status,
      actor: item.actor,
      note: item.note,
      at: item.at,
    })),
  };
}

export function listTransferRequests() {
  const rows = database.prepare(`
    SELECT id FROM transfer_requests ORDER BY created_at DESC, id DESC
  `).all();
  return rows.map(({ id }) => serializeRequest(selectRequest.get(id)));
}

export function createTransferRequest(input) {
  const id = `tr-${randomUUID()}`;
  const now = new Date().toISOString();
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO transfer_requests (
        id, customer_id, from_account, recipient, bank, account_last4,
        amount_cents, memo, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
    `).run(
      id, demoCustomer.id, input.fromAccount.trim(), input.recipient.trim(), input.bank.trim(),
      input.accountLast4, input.amountCents, (input.memo ?? '').trim(), now, now,
    );
    database.prepare(`
      INSERT INTO transfer_request_history (request_id, status, actor, note, created_at)
      VALUES (?, 'submitted', 'Customer', 'Transfer request submitted. No funds moved.', ?)
    `).run(id, now);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return serializeRequest(selectRequest.get(id));
}

const allowedTransitions = {
  submitted: ['under_review', 'rejected'],
  under_review: ['needs_info', 'approved', 'rejected'],
  needs_info: ['under_review', 'rejected'],
  approved: ['sent'],
  sent: [],
  rejected: [],
};

export function updateTransferRequest(id, input) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const current = serializeRequest(selectRequest.get(id));
    if (!current) throw new TransferStoreError('Transfer request not found.', 404);
    if (!allowedTransitions[current.status]?.includes(input.status)) {
      throw new TransferStoreError('That status change is not allowed.', 409);
    }
    if (input.note !== undefined && (typeof input.note !== 'string' || input.note.trim().length > 240)) {
      throw new TransferStoreError('Staff notes must be 240 characters or fewer.', 400);
    }

    let payout = null;
    if (input.status === 'sent') {
      if (typeof input.externalProvider !== 'string' || input.externalProvider.trim().length < 2 || input.externalProvider.trim().length > 80
        || typeof input.externalReference !== 'string' || input.externalReference.trim().length < 3 || input.externalReference.trim().length > 160
        || !Number.isSafeInteger(input.payoutAmountCents) || input.payoutAmountCents <= 0) {
        throw new TransferStoreError('Enter the off-ramp, external reference, and amount sent.', 400);
      }
      payout = {
        provider: input.externalProvider.trim(),
        reference: input.externalReference.trim(),
        amountCents: input.payoutAmountCents,
        sentAt: new Date().toISOString(),
      };
    }

    const now = new Date().toISOString();
    database.prepare(`
      UPDATE transfer_requests SET
        status = ?,
        staff_note = ?,
        payout_provider = ?,
        payout_reference = ?,
        payout_amount_cents = ?,
        payout_sent_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      input.status,
      input.note === undefined ? current.staffNote : input.note.trim(),
      payout?.provider ?? null,
      payout?.reference ?? null,
      payout?.amountCents ?? null,
      payout?.sentAt ?? null,
      now,
      id,
    );
    const historyNote = input.note?.trim() || (payout
      ? `Marked sent via ${payout.provider}; reference ${payout.reference}; amount ${(payout.amountCents / 100).toFixed(2)} USD.`
      : `Request marked ${input.status.replaceAll('_', ' ')}.`);
    database.prepare(`
      INSERT INTO transfer_request_history (request_id, status, actor, note, created_at)
      VALUES (?, ?, 'Demo staff member', ?, ?)
    `).run(id, input.status, historyNote, now);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return serializeRequest(selectRequest.get(id));
}
