# Noel Foundation website

A responsive, donor-facing website for Noel Foundation, built with React 19, Vite 8 and Tailwind CSS 4. It presents the Foundation's three approved program pillars—children's health, education, and women's livelihoods—alongside impact governance, CSR partnership, volunteering, reports, events, stories and giving journeys.

## Experience highlights

- Responsive layouts for phones, tablets, laptops and wide desktop screens
- Neutral, community-led journeys for healthcare, education and livelihoods
- Sourced public milestones clearly separated from beneficiary stories and verified impact evidence
- Audience pathways for companies, foundations, community organisations, individual donors, volunteers and supporters
- A clean horizontal navigation system with no floating experience controls
- Filterable program perspectives with dynamic mosaic and accessible card-stack layouts
- Private, human-verified impact feedback captured through the Supabase Edge Function
- Representative progress-to-goal and dashboard views kept visibly separate from verified records
- Evidence-safe verified impact dashboard with public-record coverage views
- Three-step CSR partnership builder and five-step donation flow with Stripe Checkout hand-off
- Keyboard-friendly navigation, visible focus, semantic forms and reduced-motion support
- Donor and CSR journeys that avoid unverified impact claims or fabricated urgency
- Public enquiry, volunteer and CSR forms with Turnstile verification and a secure Supabase Edge Function hand-off
- Verified-only public impact metrics enforced by PostgreSQL row-level security
- Static-hosting deep-link support through `vercel.json`
- Signed Stripe webhook reconciliation for completed, recurring, cancelled and refunded payments
- Honest email and published donation-page fallbacks when cloud configuration is absent

## Local development

Requirements: Node.js 22 and pnpm 11.

```bash
pnpm install
pnpm dev
```

The default development URL is `http://localhost:8443` unless `PORT` is set.

The Figma Make preview normally starts this server automatically. If `pnpm dev` reports that port 8443 is already in use, open `http://localhost:8443` rather than starting a second server, or run `pnpm dev -- --port 8444` for a separate instance.

Quality checks:

```bash
pnpm check
```

## Environment variables

Copy `.env.example` to `.env.local` and provide:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — browser-safe publishable key
- `VITE_TURNSTILE_SITE_KEY` — public Cloudflare Turnstile widget key
- `VITE_DONATION_URL` — finance-approved live HTTPS payment-provider page
- `VITE_ANNUAL_REPORT_2019_20_URL` — approved hosted copy of the archived annual report

Without the complete Supabase and Turnstile browser configuration, public forms deliberately open a prepared email to Noel Foundation. Payment credentials are entered only on Stripe Checkout and never pass through the React application. Until Stripe or an approved live payment URL is configured, the donation journey provides a prepared email hand-off instead of exposing a test or unapproved checkout.

Set `VITE_DONATION_URL` only after finance confirms that the provider is in live mode. It must be an HTTPS destination and must not point back to the website's own `/donate` route. Publish the annual-report URL only after the approved file has been migrated to a durable host.

## Supabase setup

1. Link a Supabase project with `supabase link --project-ref <project-ref>`.
2. Apply the schema with `supabase db push`.
3. Create a Cloudflare Turnstile widget for the production hostnames, then set its server secret and the allowed production origins:

   ```bash
   supabase secrets set \
     PUBLIC_SITE_ORIGINS=https://noelfoundation.in,https://www.noelfoundation.in \
     TURNSTILE_SECRET_KEY=your_turnstile_secret
   ```

4. Add the Stripe integration in Vercel (`vercel integration add stripe`) or create the Stripe keys directly, then copy `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Supabase Edge Function secrets. Never expose either key as a `VITE_` variable.
5. Deploy the public endpoints:

   ```bash
   supabase functions deploy public-form --no-verify-jwt
   supabase functions deploy create-checkout --no-verify-jwt
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

6. Register `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` as a Stripe webhook endpoint for Checkout Session, invoice and refund events.
7. Add the project URL, publishable key and Turnstile site key to the Vercel frontend environment.

An optional `FORM_NOTIFICATION_WEBHOOK_URL` secret can notify a private workflow after durable storage; only the form kind and reference are sent. Turnstile is validated server-side before storage. An atomic per-address rate limit, origin allow-list, exact publishable-key check, timing check and honeypot provide additional layers. The form service fails closed if its Turnstile secret is absent.

The migration explicitly grants access and enables RLS on every public-schema table. Anonymous visitors may only read impact metrics that are both verified and approved for public visibility. Form submissions are written server-side with the service role and remain private.

## Content and operations

Program copy and public contact details live in `src/content.ts`. Public impact numbers are intentionally blank until verified records are published in `impact_metrics`. Donation reconciliation and tax/compliance statements must be approved by Noel Foundation before being shown as confirmed facts.

Safeguarding commitments and historical source excerpts should receive leadership review before a production release. Published milestones link to their existing official source. New beneficiary stories require documented consent, fact review, guardian approval for minors, publication approval and a withdrawal workflow; the site does not expose a public auto-publish form.

The typography stack is restricted to the local family names `Ways` and `Gwen`. Their commercial font files are not included, so licensed vendor WOFF2 packages and web-embedding rights must be supplied before those exact faces can render in production. Do not convert or publish desktop font files without that licence.

The supplied launch film is stored at `public/media/noel-foundation-intro.mp4`. It plays as a clean, full-bleed opening film without a logo, veil, progress bar or promotional copy over the footage. Because browsers block unsolicited autoplay audio, visitors can enable the original AAC soundtrack through the discreet sound control; the landing hero exposes the same control.

## Vercel CI/CD

The GitHub Actions workflow in `.github/workflows/vercel.yml` is the deployment source of truth:

- Every pull request to `main` must pass typechecking, formatting and a production build before it receives a Vercel Preview deployment.
- Every push to `main` passes the same quality gate, dry-runs and applies Supabase migrations, deploys the three Edge Functions, and promotes a prebuilt artifact to Vercel Production.
- Preview deployments use the Vercel `preview` environment. Production uses the GitHub `production` environment, so required reviewers can be enabled in repository environment settings.
- Concurrent preview runs for the same branch are cancelled; an in-progress production release is never cancelled automatically.

Create these encrypted GitHub Actions secrets before enabling the workflow:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY` and the optional public URLs in both the Vercel Preview and Production environments. Configure `PUBLIC_SITE_ORIGINS`, `TURNSTILE_SECRET_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Supabase function secrets. None of these private values belong in the repository.

The workflow uses pinned Vercel and Supabase CLI versions and deploys a locally built artifact with `vercel deploy --prebuilt`. Build output is generated in `dist/`, and `vercel.json` explicitly fixes the pnpm install, Vite build and SPA routing configuration.

For a rollback, select the last healthy deployment in the Vercel dashboard and promote it to production. Database migrations must remain forward-compatible; use a new corrective migration instead of deleting or rewriting a migration that has already reached production.

Local release validation remains:

```bash
pnpm check
```

In GitHub, require the `Quality gate` status check on `main` and protect the `production` environment with the appropriate reviewer. The first Vercel project link supplies the organization and project IDs; keep `.vercel/` local and uncommitted.
