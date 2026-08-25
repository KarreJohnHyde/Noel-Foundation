-- Noel Foundation public website data model.
-- Every public-schema table uses explicit grants and row-level security.

create table public.impact_metrics (
  id bigint generated always as identity primary key,
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9_]{1,79}$'),
  label text not null check (char_length(label) between 2 and 120),
  value numeric(18, 2) not null check (value >= 0),
  unit text check (unit is null or char_length(unit) <= 40),
  description text check (description is null or char_length(description) <= 500),
  programme text check (programme is null or char_length(programme) <= 120),
  source text check (source is null or char_length(btrim(source)) between 2 and 300),
  verification_status text not null default 'draft'
    check (verification_status in ('draft', 'under_review', 'verified', 'rejected')),
  public_visibility boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_metric_requires_audit check (
    verification_status <> 'verified' or (verified_at is not null and verified_by is not null)
  ),
  constraint published_metric_requires_evidence check (
    not public_visibility
    or (
      verification_status = 'verified'
      and verified_at is not null
      and verified_by is not null
      and source is not null
    )
  )
);

create table public.contact_messages (
  id bigint generated always as identity primary key,
  submission_id uuid not null unique,
  reference text not null unique check (reference ~ '^NF-C-[0-9]{8}-[A-Z0-9]{8}$'),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 40),
  organisation text check (organisation is null or char_length(organisation) <= 160),
  subject text not null check (char_length(subject) between 2 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  consent_at timestamptz not null,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'resolved', 'archived')),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.volunteer_applications (
  id bigint generated always as identity primary key,
  submission_id uuid not null unique,
  reference text not null unique check (reference ~ '^NF-V-[0-9]{8}-[A-Z0-9]{8}$'),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (char_length(phone) between 5 and 40),
  city text not null check (char_length(city) between 2 and 120),
  cause text not null check (char_length(cause) between 2 and 120),
  availability text not null check (availability in ('Weekdays', 'Weekends', 'Both', 'Flexible')),
  skills text check (skills is null or char_length(skills) <= 600),
  area_of_interest text check (area_of_interest is null or char_length(area_of_interest) <= 300),
  experience text check (experience is null or char_length(experience) <= 2000),
  message text check (message is null or char_length(message) <= 4000),
  communication_preference text not null default 'Email'
    check (communication_preference in ('Email', 'Phone', 'WhatsApp')),
  consent_at timestamptz not null,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'contacted', 'placed', 'closed', 'archived')),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.csr_enquiries (
  id bigint generated always as identity primary key,
  submission_id uuid not null unique,
  reference text not null unique check (reference ~ '^NF-P-[0-9]{8}-[A-Z0-9]{8}$'),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 40),
  organisation text not null check (char_length(organisation) between 2 and 160),
  cause text not null check (char_length(cause) between 2 and 120),
  partnership_model text not null check (char_length(partnership_model) between 2 and 160),
  outcome_goal text not null check (char_length(outcome_goal) between 2 and 160),
  message text check (message is null or char_length(message) <= 4000),
  consent_at timestamptz not null,
  status text not null default 'new'
    check (status in ('new', 'qualifying', 'discussion', 'proposal', 'closed', 'archived')),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_submission_log (
  id bigint generated always as identity primary key,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('contact', 'volunteer', 'csr')),
  created_at timestamptz not null default now()
);

create table public.donors (
  id bigint generated always as identity primary key,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 40),
  organisation text check (organisation is null or char_length(organisation) <= 160),
  pan_last_four text check (pan_last_four is null or pan_last_four ~ '^[A-Z0-9]{4}$'),
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.donations (
  id bigint generated always as identity primary key,
  reference text not null unique check (reference ~ '^NF-D-[A-Z0-9-]{6,40}$'),
  donor_id bigint not null references public.donors (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  designation text check (designation is null or char_length(designation) <= 160),
  payment_provider text check (payment_provider is null or char_length(payment_provider) <= 80),
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 160),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed', 'refunded', 'cancelled')),
  paid_at timestamptz,
  receipted_at timestamptz,
  tax_receipt_number text check (tax_receipt_number is null or char_length(tax_receipt_number) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint confirmed_donation_requires_payment_time check (
    status <> 'confirmed' or paid_at is not null
  )
);

create index impact_metrics_public_order_idx
  on public.impact_metrics (display_order, id)
  where verification_status = 'verified' and public_visibility = true;
create index contact_messages_work_queue_idx
  on public.contact_messages (status, created_at desc);
create index volunteer_applications_work_queue_idx
  on public.volunteer_applications (status, created_at desc);
create index csr_enquiries_work_queue_idx
  on public.csr_enquiries (status, created_at desc);
create index form_submission_log_rate_limit_idx
  on public.form_submission_log (fingerprint, created_at desc);
create unique index donors_email_unique_idx on public.donors (lower(email));
create index donations_donor_id_idx on public.donations (donor_id);
create index donations_status_paid_at_idx on public.donations (status, paid_at desc);
create unique index donations_payment_reference_unique_idx
  on public.donations (payment_reference)
  where payment_reference is not null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.claim_form_submission_rate_limit(
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
    or p_kind not in ('contact', 'volunteer', 'csr')
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

  if recent_count >= p_max_submissions then
    return false;
  end if;

  insert into public.form_submission_log (fingerprint, kind)
  values (p_fingerprint, p_kind);

  return true;
end;
$$;

create trigger impact_metrics_set_updated_at
before update on public.impact_metrics
for each row execute function public.set_updated_at();
create trigger contact_messages_set_updated_at
before update on public.contact_messages
for each row execute function public.set_updated_at();
create trigger volunteer_applications_set_updated_at
before update on public.volunteer_applications
for each row execute function public.set_updated_at();
create trigger csr_enquiries_set_updated_at
before update on public.csr_enquiries
for each row execute function public.set_updated_at();
create trigger donors_set_updated_at
before update on public.donors
for each row execute function public.set_updated_at();
create trigger donations_set_updated_at
before update on public.donations
for each row execute function public.set_updated_at();

alter table public.impact_metrics enable row level security;
alter table public.contact_messages enable row level security;
alter table public.volunteer_applications enable row level security;
alter table public.csr_enquiries enable row level security;
alter table public.form_submission_log enable row level security;
alter table public.donors enable row level security;
alter table public.donations enable row level security;

revoke all on table public.impact_metrics from public, anon, authenticated, service_role;
revoke all on table public.contact_messages from public, anon, authenticated, service_role;
revoke all on table public.volunteer_applications from public, anon, authenticated, service_role;
revoke all on table public.csr_enquiries from public, anon, authenticated, service_role;
revoke all on table public.form_submission_log from public, anon, authenticated, service_role;
revoke all on table public.donors from public, anon, authenticated, service_role;
revoke all on table public.donations from public, anon, authenticated, service_role;

grant select (
  key,
  label,
  value,
  unit,
  description,
  programme,
  source,
  verification_status,
  public_visibility,
  display_order,
  updated_at
)
  on table public.impact_metrics to anon;
grant select on table public.impact_metrics to authenticated;
grant insert, update, delete on table public.impact_metrics to authenticated;
grant select, insert, update, delete on table public.contact_messages to authenticated;
grant select, insert, update, delete on table public.volunteer_applications to authenticated;
grant select, insert, update, delete on table public.csr_enquiries to authenticated;
grant select, delete on table public.form_submission_log to authenticated;
grant select, insert, update, delete on table public.donors to authenticated;
grant select, insert, update, delete on table public.donations to authenticated;

grant all privileges on table public.impact_metrics to service_role;
grant all privileges on table public.contact_messages to service_role;
grant all privileges on table public.volunteer_applications to service_role;
grant all privileges on table public.csr_enquiries to service_role;
grant all privileges on table public.form_submission_log to service_role;
grant all privileges on table public.donors to service_role;
grant all privileges on table public.donations to service_role;

revoke all on sequence public.impact_metrics_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.contact_messages_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.volunteer_applications_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.csr_enquiries_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.form_submission_log_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.donors_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.donations_id_seq from public, anon, authenticated, service_role;

grant usage, select on sequence public.impact_metrics_id_seq to authenticated, service_role;
grant usage, select on sequence public.contact_messages_id_seq to authenticated, service_role;
grant usage, select on sequence public.volunteer_applications_id_seq to authenticated, service_role;
grant usage, select on sequence public.csr_enquiries_id_seq to authenticated, service_role;
grant usage, select on sequence public.form_submission_log_id_seq to service_role;
grant usage, select on sequence public.donors_id_seq to authenticated, service_role;
grant usage, select on sequence public.donations_id_seq to authenticated, service_role;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke all on function public.set_updated_at() from public, anon;
grant execute on function public.set_updated_at() to authenticated, service_role;
revoke all on function public.claim_form_submission_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_form_submission_rate_limit(text, text, integer, integer)
  to service_role;

create policy "public reads verified impact metrics"
on public.impact_metrics
for select
to anon
using (verification_status = 'verified' and public_visibility = true);

create policy "administrators manage impact metrics"
on public.impact_metrics
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administrators manage contact messages"
on public.contact_messages
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administrators manage volunteer applications"
on public.volunteer_applications
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administrators manage csr enquiries"
on public.csr_enquiries
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administrators read submission log"
on public.form_submission_log
for select
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administrators delete submission log"
on public.form_submission_log
for delete
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administrators manage donors"
on public.donors
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administrators manage donations"
on public.donations
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

comment on table public.impact_metrics is
  'Only verified rows approved for public visibility are readable by website visitors.';
comment on table public.donations is
  'Private reconciliation records; public totals must be derived from confirmed payments only.';
