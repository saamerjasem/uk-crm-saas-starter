# UK CRM SaaS, Option B starter

A minimal multi-tenant CRM starter, Next.js App Router + Postgres + Stripe. 
It uses Postgres Row Level Security, with a per-request tenant context using a Postgres GUC.

## Quick start

1. Create a Postgres database in a UK or EU region. Supabase, Neon, or RDS will work.
2. Run the SQL in `db/supabase_schema.sql` to create tables, indexes, and RLS.
3. Copy `.env.example` to `.env.local`, fill in variables.
4. `npm install`
5. `npm run dev`
6. Create a Stripe Product with prices for Starter, Pro, Team, then set the webhook secret. 
   Point the Stripe webhook to `/api/stripe/webhook`.

## Multi-tenancy

- We resolve tenant by hostname, for example `acme.yourcrm.co.uk` maps to a `domains` row that references a `tenants` row.
- Before each query we set a Postgres GUC `app.tenant_id` to the tenant id; RLS policies only allow rows for that tenant.
- The helper `withTenant` in `src/server/db.ts` takes care of this.

## RLS note

Admin operations should use a connection that sets `role = 'admin'` so you can manage tenants and domains.
The schema contains a simple policy that permits full access if `current_setting('app.role', true) = 'admin'`.

## Stripe flow summary

- User checks out, on success Stripe redirects back to `/checkout/success?session_id=...`.
- We handle `checkout.session.completed` in the webhook, we create a tenant, a domain placeholder, and a subscription row.
- You can then direct the user to set a subdomain name which creates a `domains` row.

## Minimal endpoints

- `POST /api/contacts` create a contact
- `GET /api/contacts` list contacts
- `POST /api/deals` create a deal
- `GET /api/deals` list deals

Extend as needed.

## Production

- Deploy frontend to Vercel, add wildcard domain `*.yourcrm.co.uk`.
- Use managed Postgres, enable daily backups and point-in-time recovery.
- Put Cloudflare in front for TLS and caching, set security headers.
- Store object files, for example quote PDFs, on an S3 compatible store with signed URLs.
