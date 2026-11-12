# Grat

Grat is a Next.js App Router project built with TypeScript and Tailwind CSS. Its landing page, sign-in and registration screens, customer dashboard, account history, requests, profile and staff review tools live in separate route and component files under `src/`.

Grat records customer requests and staff-posted ledger entries. It does not connect to US banks, hold funds, or execute payments. Staff review requests and perform any payout outside the portal before recording confirmation.

## Run locally

Use Node.js 20.9 or later. Supabase configuration is loaded from the ignored `.env` file; see `.env.example` for the variable names.

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. If that port is occupied, run `npm.cmd run dev -- --port 3001` and open `http://localhost:3001`.

Run a production build with `npm.cmd run build`; start the built app locally with `npm.cmd run start`.

## Deploy to Vercel

The project is configured for Vercel's Next.js framework detection. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for Production, Preview, and Development. Never expose a Supabase secret or service-role key in browser code or commit it to the repository.

## Supabase setup

Apply the migrations in `supabase/migrations/` in numeric order:

1. `202610030001_initial_grat_backend.sql` creates profiles, transfer requests, review history, and row-level security policies.
2. `202610030002_profile_email.sql` adds customer email to staff request views.
3. `202610030003_account_ledger.sql` adds the append-only ledger, balance summaries, staff-only ledger posting, and debit balance checks.
4. `202610030004_admin_role_management.sql` adds the admin-only role management function used by the admin dashboard.
5. `20261112110252_restrict_trigger_rpc_access.sql` removes API execution rights from trigger-only security-definer functions.

New signups receive the `customer` role. To bootstrap the first administrator, first create and confirm your account, apply all migrations, then run this once in the Supabase SQL Editor with your sign-up email in place of the example:

```sql
update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = lower('you@example.com')
returning id, email, role;
```

Confirm that the returned row shows your account as `admin`. After that, use the Admin dashboard to assign customer, staff, or admin roles to other users. You cannot change your own role or demote the last administrator. The application and database policies both check access.

Administrators can use `/admin/login` for the dedicated admin sign-in screen. The same credentials are checked against the database role before access to `/dashboard/admin` is granted.

## Current scope

- Customer email/password authentication and profile.
- Transfer request submission and request history.
- Staff request review, customer notes, and recording an externally completed payout.
- Customer recorded balance and ledger history, with staff-only confirmed ledger entries.
- No bank connection or in-app payment execution. An approval alone does not change a balance or execute a payout.
- Other request types are future milestones.
# grat
