# Noel Foundation website

A responsive, donor-facing website for Noel Foundation, built with React 19, Vite 8 and Tailwind CSS 4. It presents the Foundation's three approved program pillars—children's health, education, and women's livelihoods—alongside impact governance, CSR partnership, volunteering, reports, events, stories and giving journeys.

## Experience highlights

- Responsive layouts for phones, tablets, laptops and wide desktop screens
- Glass navigation dock with motion and transparency preferences
- Filterable story collections with dynamic mosaic and accessible card-stack layouts
- Evidence-safe interactive impact studio with verified-record coverage views
- Three-step CSR partnership builder and five-step donation preparation flow
- Keyboard-friendly navigation, visible focus, semantic forms and reduced-motion support
- Donor and CSR journeys that avoid unverified impact claims or fabricated urgency
- Public enquiry, volunteer and CSR forms with Turnstile verification and a secure Supabase Edge Function hand-off
- Verified-only public impact metrics enforced by PostgreSQL row-level security
- Static-hosting deep-link support through `vercel.json`
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

Without the complete Supabase and Turnstile browser configuration, public forms deliberately open a prepared email to Noel Foundation. No payment credentials are collected by this application. Until an approved live payment URL is configured, the donation journey provides a prepared email hand-off instead of exposing a test or unapproved checkout.

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

4. Deploy the public form handler with `supabase functions deploy public-form --no-verify-jwt`.
5. Add the project URL, publishable key and Turnstile site key to the frontend deployment environment.

An optional `FORM_NOTIFICATION_WEBHOOK_URL` secret can notify a private workflow after durable storage; only the form kind and reference are sent. Turnstile is validated server-side before storage. An atomic per-address rate limit, origin allow-list, exact publishable-key check, timing check and honeypot provide additional layers. The form service fails closed if its Turnstile secret is absent.

The migration explicitly grants access and enables RLS on every public-schema table. Anonymous visitors may only read impact metrics that are both verified and approved for public visibility. Form submissions are written server-side with the service role and remain private.

## Content and operations

Program copy and public contact details live in `src/content.ts`. Public impact numbers are intentionally blank until verified records are published in `impact_metrics`. Donation reconciliation and tax/compliance statements must be approved by Noel Foundation before being shown as confirmed facts.

The typography stack supports the local family names `Ways` and `Gwen`, but their commercial font files are not included. Keep the current Manrope and Newsreader web fallbacks until properly licensed vendor WOFF2 packages and web-embedding rights are supplied. Do not convert or publish desktop font files without that licence.

## Deployment

Build output is generated in `dist/`:

```bash
pnpm build
```

`vercel.json` rewrites application routes to `index.html`. For another static host, configure the equivalent SPA fallback while continuing to serve `/images/*` and `/assets/*` directly.
