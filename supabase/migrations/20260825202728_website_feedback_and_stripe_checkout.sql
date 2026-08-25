-- Private website feedback and Stripe reconciliation support.
-- Public visitors write only through validated Edge Functions using the service role.

create table public.website_feedback (
  id bigint generated always as identity primary key,
  submission_id uuid not null unique,
  reference text not null unique check (reference ~ '^NF-F-[0-9]{8}-[A-Z0-9]{8}$'),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 40),
  rating smallint not null check (rating between 1 and 5),
  page_context text not null check (char_length(page_context) between 1 and 160),
  message text not null check (char_length(message) between 10 and 4000),
  consent_at timestamptz not null,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'planned', 'resolved', 'archived')),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index website_feedback_work_queue_idx
  on public.website_feedback (status, created_at desc);

alter table public.donors
  add column if not exists stripe_customer_id text unique
    check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$');

alter table public.donations
  add column if not exists submission_id uuid unique,
  add column if not exists frequency text not null default 'one_time'
    check (frequency in ('one_time', 'monthly')),
  add column if not exists stripe_checkout_session_id text unique
    check (stripe_checkout_session_id is null or stripe_checkout_session_id ~ '^cs_(test_|live_)[A-Za-z0-9]+$'),
  add column if not exists stripe_payment_intent_id text unique
    check (stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  add column if not exists stripe_subscription_id text
    check (stripe_subscription_id is null or stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  add column if not exists stripe_invoice_id text unique
    check (stripe_invoice_id is null or stripe_invoice_id ~ '^in_[A-Za-z0-9]+$');

create index if not exists donations_stripe_subscription_idx
  on public.donations (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table public.stripe_webhook_events (
  event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null check (char_length(event_type) between 3 and 160),
  livemode boolean not null,
  processed_at timestamptz not null default now()
);

drop trigger if exists website_feedback_set_updated_at on public.website_feedback;
create trigger website_feedback_set_updated_at
before update on public.website_feedback
for each row execute function public.set_updated_at();

alter table public.website_feedback enable row level security;
alter table public.stripe_webhook_events enable row level security;

revoke all on table public.website_feedback from public, anon, authenticated, service_role;
revoke all on table public.stripe_webhook_events from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.website_feedback to authenticated;
grant select on table public.stripe_webhook_events to authenticated;
grant all privileges on table public.website_feedback to service_role;
grant all privileges on table public.stripe_webhook_events to service_role;

revoke all on sequence public.website_feedback_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.website_feedback_id_seq to authenticated, service_role;

create policy "administrators manage website feedback"
on public.website_feedback
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administrators read stripe webhook events"
on public.stripe_webhook_events
for select
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

alter table public.form_submission_log
  drop constraint if exists form_submission_log_kind_check;
alter table public.form_submission_log
  add constraint form_submission_log_kind_check
  check (kind in ('contact', 'volunteer', 'csr', 'feedback'));

create or replace function public.claim_form_submission_rate_limit(
  p_fingerprint text,
  p_kind text,
  p_window_seconds integer default 900,
  p_max_submissions integer default 5
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  recent_count integer;
begin
  if p_fingerprint !~ '^[a-f0-9]{64}$'
    or p_kind not in ('contact', 'volunteer', 'csr', 'feedback')
    or p_window_seconds not between 60 and 86400
    or p_max_submissions not between 1 and 100 then
    raise exception 'invalid rate-limit claim';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_fingerprint, 0));

  select count(*)::integer
    into recent_count
    from public.form_submission_log
   where fingerprint = p_fingerprint
     and created_at >= now() - pg_catalog.make_interval(secs => p_window_seconds);

  if recent_count >= p_max_submissions then return false; end if;

  insert into public.form_submission_log (fingerprint, kind)
  values (p_fingerprint, p_kind);
  return true;
end;
$$;

comment on table public.website_feedback is
  'Private website-improvement feedback; public clients cannot read or write this table directly.';
comment on table public.stripe_webhook_events is
  'Private idempotency ledger for signature-verified Stripe webhook events.';
