-- Verified-impact ledger for Noel Foundation.
--
-- The existing public.impact_metrics table remains the website-compatible read
-- model. New measurements are authored as immutable, versioned observations and
-- are copied into that read model only by the controlled review workflow below.
-- Evidence records contain metadata and locators only; sensitive source files
-- belong in a private Storage bucket with separate object-level policies.

create schema if not exists noel_private;

revoke all on schema noel_private from public, anon, authenticated, service_role;

create table if not exists public.evidence_sources (
  id bigint generated always as identity primary key,
  internal_title text not null
    check (char_length(btrim(internal_title)) between 2 and 200),
  public_label text not null
    check (char_length(btrim(public_label)) between 2 and 250),
  source_type text not null
    check (
      source_type in (
        'annual_report',
        'programme_report',
        'financial_report',
        'hospital_record',
        'partner_confirmation',
        'payment_reconciliation',
        'survey',
        'other'
      )
    ),
  reporting_period_start date,
  reporting_period_end date,
  issued_on date,
  public_url text
    check (
      public_url is null
      or (
        char_length(public_url) <= 2048
        and public_url ~* '^https://[^[:space:]]+$'
      )
    ),
  storage_path text
    check (
      storage_path is null
      or (
        char_length(btrim(storage_path)) between 3 and 500
        and storage_path !~ '(^|/)\.\.(/|$)'
      )
    ),
  external_reference text
    check (external_reference is null or char_length(btrim(external_reference)) between 2 and 200),
  checksum_sha256 text
    check (checksum_sha256 is null or checksum_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  sensitivity text not null default 'internal'
    check (sensitivity in ('public', 'internal', 'confidential', 'restricted')),
  approved_for_public boolean not null default false,
  created_by uuid not null default auth.uid()
    references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evidence_source_period_is_valid check (
    (reporting_period_start is null and reporting_period_end is null)
    or (
      reporting_period_start is not null
      and reporting_period_end is not null
      and reporting_period_start <= reporting_period_end
    )
  ),
  constraint evidence_source_has_locator check (
    public_url is not null
    or storage_path is not null
    or external_reference is not null
    or checksum_sha256 is not null
  )
);

create table if not exists public.metric_definitions (
  id bigint generated always as identity primary key,
  key text not null unique
    check (key ~ '^[a-z0-9][a-z0-9_]{1,79}$'),
  label text not null
    check (char_length(btrim(label)) between 2 and 120),
  unit text
    check (unit is null or char_length(btrim(unit)) between 1 and 40),
  programme text
    check (programme is null or char_length(btrim(programme)) between 2 and 120),
  definition text not null
    check (char_length(btrim(definition)) between 10 and 1000),
  aggregation_method text not null
    check (
      aggregation_method in (
        'sum',
        'latest',
        'distinct_count',
        'average',
        'ratio',
        'manual_verified'
      )
    ),
  reporting_frequency text not null default 'annual'
    check (
      reporting_frequency in ('one_time', 'monthly', 'quarterly', 'annual', 'cumulative')
    ),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'retired')),
  display_order integer not null default 0
    check (display_order >= 0),
  current_verified_observation_id bigint,
  created_by uuid not null default auth.uid()
    references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metric_observations (
  id bigint generated always as identity primary key,
  metric_definition_id bigint not null
    references public.metric_definitions (id) on delete restrict,
  version_number integer not null
    check (version_number > 0),
  value numeric(18, 2) not null
    check (value >= 0),
  reporting_period_start date,
  reporting_period_end date,
  as_of_date date not null,
  geography text
    check (geography is null or char_length(btrim(geography)) between 2 and 160),
  population_scope text
    check (population_scope is null or char_length(btrim(population_scope)) between 2 and 300),
  public_description text
    check (public_description is null or char_length(btrim(public_description)) between 2 and 500),
  methodology_notes text
    check (methodology_notes is null or char_length(btrim(methodology_notes)) between 2 and 4000),
  evidence_source_id bigint
    references public.evidence_sources (id) on delete restrict,
  public_visibility boolean not null default true,
  status text not null default 'draft'
    check (status in ('draft', 'under_review', 'verified', 'rejected')),
  created_by uuid not null default auth.uid()
    references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  verified_by uuid references auth.users (id) on delete restrict,
  verified_at timestamptz,
  published_at timestamptz,
  constraint metric_observations_definition_version_key
    unique (metric_definition_id, version_number),
  constraint metric_observations_definition_id_id_key
    unique (metric_definition_id, id),
  constraint metric_observation_period_is_valid check (
    (reporting_period_start is null and reporting_period_end is null)
    or (
      reporting_period_start is not null
      and reporting_period_end is not null
      and reporting_period_start <= reporting_period_end
    )
  ),
  constraint metric_observation_review_has_evidence check (
    status = 'draft' or evidence_source_id is not null
  ),
  constraint metric_observation_review_was_submitted check (
    status = 'draft' or submitted_at is not null
  ),
  constraint metric_observation_verification_audit check (
    (
      status = 'verified'
      and verified_by is not null
      and verified_at is not null
    )
    or (
      status <> 'verified'
      and verified_by is null
      and verified_at is null
      and published_at is null
    )
  ),
  constraint metric_observation_publication_is_verified check (
    published_at is null
    or (status = 'verified' and public_visibility = true)
  ),
  constraint public_verified_observation_is_published check (
    status <> 'verified'
    or public_visibility = false
    or published_at is not null
  )
);

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'metric_definitions_current_verified_observation_fk'
      and conrelid = 'public.metric_definitions'::regclass
  ) then
    alter table public.metric_definitions
      add constraint metric_definitions_current_verified_observation_fk
      foreign key (id, current_verified_observation_id)
      references public.metric_observations (metric_definition_id, id)
      on delete restrict;
  end if;
end
$migration$;

create table if not exists public.verification_events (
  id bigint generated always as identity primary key,
  observation_id bigint not null
    references public.metric_observations (id) on delete restrict,
  event_type text not null
    check (
      event_type in (
        'created',
        'submitted',
        'invalidated',
        'verified',
        'rejected',
        'status_changed'
      )
    ),
  from_status text
    check (from_status is null or from_status in ('draft', 'under_review', 'verified', 'rejected')),
  to_status text not null
    check (to_status in ('draft', 'under_review', 'verified', 'rejected')),
  actor_id uuid references auth.users (id) on delete restrict,
  actor_role text
    check (actor_role is null or char_length(actor_role) <= 80),
  note text
    check (note is null or char_length(note) <= 2000),
  event_at timestamptz not null default now()
);

create index if not exists evidence_sources_reporting_period_idx
  on public.evidence_sources (reporting_period_start, reporting_period_end);

create index if not exists metric_observations_definition_created_idx
  on public.metric_observations (metric_definition_id, created_at desc);

create index if not exists metric_observations_evidence_source_idx
  on public.metric_observations (evidence_source_id)
  where evidence_source_id is not null;

create index if not exists metric_observations_review_queue_idx
  on public.metric_observations (submitted_at, metric_definition_id)
  where status = 'under_review';

create index if not exists metric_observations_verified_history_idx
  on public.metric_observations (metric_definition_id, verified_at desc)
  where status = 'verified';

create index if not exists metric_observations_verified_evidence_idx
  on public.metric_observations (evidence_source_id)
  where status = 'verified';

create index if not exists verification_events_observation_time_idx
  on public.verification_events (observation_id, event_at, id);

create or replace function noel_private.is_verified_impact_workflow_executor()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select current_user = pg_catalog.pg_get_userbyid(procedure.proowner)
  from pg_catalog.pg_proc as procedure
  where procedure.oid = 'noel_private.is_verified_impact_workflow_executor()'::regprocedure;
$function$;

create or replace function noel_private.assign_metric_observation_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_next_version integer;
begin
  if new.metric_definition_id is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(new.metric_definition_id);

  select coalesce(max(observation.version_number), 0) + 1
    into v_next_version
    from public.metric_observations as observation
   where observation.metric_definition_id = new.metric_definition_id;

  new.version_number := v_next_version;
  return new;
end;
$function$;

create or replace function noel_private.guard_metric_observation_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_material_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft'
      or new.submitted_at is not null
      or new.verified_by is not null
      or new.verified_at is not null
      or new.published_at is not null then
      raise exception 'metric observations must be inserted as drafts';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'metric observations form an append-only ledger and cannot be deleted';
  end if;

  if old.metric_definition_id is distinct from new.metric_definition_id
    or old.version_number is distinct from new.version_number
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at then
    raise exception 'metric observation identity and authorship are immutable';
  end if;

  if old.status = 'verified' or old.published_at is not null then
    raise exception 'verified metric observations are immutable; create a new observation version';
  end if;

  if not noel_private.is_verified_impact_workflow_executor() then
    if old.status is distinct from new.status
      or old.submitted_at is distinct from new.submitted_at
      or old.verified_by is distinct from new.verified_by
      or old.verified_at is distinct from new.verified_at
      or old.published_at is distinct from new.published_at then
      raise exception 'use the submit/review workflow to change observation status';
    end if;
  end if;

  v_material_changed :=
    old.value is distinct from new.value
    or old.reporting_period_start is distinct from new.reporting_period_start
    or old.reporting_period_end is distinct from new.reporting_period_end
    or old.as_of_date is distinct from new.as_of_date
    or old.geography is distinct from new.geography
    or old.population_scope is distinct from new.population_scope
    or old.public_description is distinct from new.public_description
    or old.methodology_notes is distinct from new.methodology_notes
    or old.evidence_source_id is distinct from new.evidence_source_id
    or old.public_visibility is distinct from new.public_visibility;

  if v_material_changed and old.status in ('under_review', 'rejected') then
    new.status := 'draft';
    new.submitted_at := null;
    new.verified_by := null;
    new.verified_at := null;
    new.published_at := null;
  end if;

  return new;
end;
$function$;

create or replace function noel_private.append_metric_verification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_type text;
  v_from_status text;
  v_note text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'created';
    v_from_status := null;
  elsif new.status is not distinct from old.status then
    return null;
  elsif new.status = 'under_review' then
    v_event_type := 'submitted';
    v_from_status := old.status;
  elsif new.status = 'verified' then
    v_event_type := 'verified';
    v_from_status := old.status;
  elsif new.status = 'rejected' then
    v_event_type := 'rejected';
    v_from_status := old.status;
  elsif new.status = 'draft' then
    v_event_type := 'invalidated';
    v_from_status := old.status;
  else
    v_event_type := 'status_changed';
    v_from_status := old.status;
  end if;

  v_note := nullif(
    pg_catalog.left(
      btrim(coalesce(current_setting('noel.verification_note', true), '')),
      2000
    ),
    ''
  );

  insert into public.verification_events (
    observation_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    actor_role,
    note
  )
  values (
    new.id,
    v_event_type,
    v_from_status,
    new.status,
    auth.uid(),
    nullif((select auth.jwt()) -> 'app_metadata' ->> 'role', ''),
    v_note
  );

  return null;
end;
$function$;

create or replace function noel_private.prevent_verification_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'verification events are append-only';
end;
$function$;

create or replace function noel_private.guard_evidence_source_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_role text;
  v_material_changed boolean;
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.metric_observations as observation
      where observation.evidence_source_id = old.id
        and observation.status in ('under_review', 'verified')
    ) then
      raise exception 'evidence referenced by a submitted or verified observation is immutable';
    end if;

    return old;
  end if;

  if old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at then
    raise exception 'evidence source authorship is immutable';
  end if;

  v_role := coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '');

  if old.approved_for_public is distinct from new.approved_for_public
    and not noel_private.is_verified_impact_workflow_executor()
    and v_role <> 'admin' then
    raise exception 'only administrators can change public evidence approval';
  end if;

  v_material_changed :=
    old.internal_title is distinct from new.internal_title
    or old.public_label is distinct from new.public_label
    or old.source_type is distinct from new.source_type
    or old.reporting_period_start is distinct from new.reporting_period_start
    or old.reporting_period_end is distinct from new.reporting_period_end
    or old.issued_on is distinct from new.issued_on
    or old.public_url is distinct from new.public_url
    or old.storage_path is distinct from new.storage_path
    or old.external_reference is distinct from new.external_reference
    or old.checksum_sha256 is distinct from new.checksum_sha256
    or old.sensitivity is distinct from new.sensitivity
    or old.approved_for_public is distinct from new.approved_for_public;

  if v_material_changed and exists (
    select 1
    from public.metric_observations as observation
    where observation.evidence_source_id = old.id
      and observation.status in ('under_review', 'verified')
  ) then
    raise exception 'evidence referenced by a submitted or verified observation is immutable; add a new evidence source';
  end if;

  return new;
end;
$function$;

create or replace function noel_private.guard_metric_definition_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.current_verified_observation_id is not null
      and not noel_private.is_verified_impact_workflow_executor() then
      raise exception 'the current verified observation is maintained by the review workflow';
    end if;

    return new;
  end if;

  if old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at then
    raise exception 'metric definition authorship is immutable';
  end if;

  if old.current_verified_observation_id is distinct from new.current_verified_observation_id
    and not noel_private.is_verified_impact_workflow_executor() then
    raise exception 'the current verified observation is maintained by the review workflow';
  end if;

  if (
      old.current_verified_observation_id is not null
      or exists (
        select 1
        from public.metric_observations as observation
        where observation.metric_definition_id = old.id
          and observation.status = 'under_review'
      )
    )
    and not noel_private.is_verified_impact_workflow_executor()
    and (
      old.key is distinct from new.key
      or old.label is distinct from new.label
      or old.unit is distinct from new.unit
      or old.programme is distinct from new.programme
      or old.definition is distinct from new.definition
      or old.aggregation_method is distinct from new.aggregation_method
      or old.reporting_frequency is distinct from new.reporting_frequency
    ) then
    raise exception 'submitted or published metric definitions are immutable; create a replacement definition';
  end if;

  return new;
end;
$function$;

create or replace function noel_private.sync_metric_definition_presentation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.current_verified_observation_id is not null
    and old.display_order is distinct from new.display_order then
    update public.impact_metrics
       set display_order = new.display_order
     where key = new.key;
  end if;

  return null;
end;
$function$;

create or replace function noel_private.guard_impact_metric_read_model()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_material_changed boolean;
begin
  if tg_op = 'INSERT' then
    if not noel_private.is_verified_impact_workflow_executor()
      and (new.verification_status = 'verified' or new.public_visibility = true) then
      raise exception 'verified impact metrics are published through the observation review workflow';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.verification_status = 'verified' or old.public_visibility = true then
      raise exception 'published impact read-model rows cannot be deleted';
    end if;

    return old;
  end if;

  v_material_changed :=
    old.key is distinct from new.key
    or old.label is distinct from new.label
    or old.value is distinct from new.value
    or old.unit is distinct from new.unit
    or old.description is distinct from new.description
    or old.programme is distinct from new.programme
    or old.source is distinct from new.source
    or old.verification_status is distinct from new.verification_status
    or old.public_visibility is distinct from new.public_visibility
    or old.verified_at is distinct from new.verified_at
    or old.verified_by is distinct from new.verified_by;

  if not noel_private.is_verified_impact_workflow_executor()
    and (
      (
        (old.verification_status = 'verified' or old.public_visibility = true)
        and v_material_changed
      )
      or (
        (new.verification_status = 'verified' or new.public_visibility = true)
        and v_material_changed
      )
    ) then
    raise exception 'verified impact metrics are immutable; verify a new observation version';
  end if;

  return new;
end;
$function$;

create or replace function noel_private.submit_metric_observation(
  p_observation_id bigint,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_role text;
  v_observation public.metric_observations%rowtype;
  v_definition public.metric_definitions%rowtype;
  v_evidence public.evidence_sources%rowtype;
  v_now timestamptz := statement_timestamp();
begin
  v_actor := auth.uid();
  v_role := coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '');

  if v_actor is null or v_role not in ('admin', 'impact_editor') then
    raise exception 'not authorized to submit metric observations';
  end if;

  if p_note is not null and char_length(btrim(p_note)) > 2000 then
    raise exception 'review note exceeds 2000 characters';
  end if;

  select observation.*
    into v_observation
    from public.metric_observations as observation
   where observation.id = p_observation_id
   for update;

  if not found then
    raise exception 'metric observation % was not found', p_observation_id;
  end if;

  if v_observation.status not in ('draft', 'rejected') then
    raise exception 'only draft or rejected observations can be submitted';
  end if;

  if v_role <> 'admin' and v_observation.created_by <> v_actor then
    raise exception 'impact editors can submit only their own observations';
  end if;

  select definition.*
    into v_definition
    from public.metric_definitions as definition
   where definition.id = v_observation.metric_definition_id
   for update;

  if not found or v_definition.status <> 'active' then
    raise exception 'the metric definition must be active before submission';
  end if;

  if v_observation.evidence_source_id is null then
    raise exception 'an evidence source is required before submission';
  end if;

  select evidence.*
    into v_evidence
    from public.evidence_sources as evidence
   where evidence.id = v_observation.evidence_source_id
   for share;

  if not found then
    raise exception 'the observation evidence source was not found';
  end if;

  if v_observation.public_visibility and not v_evidence.approved_for_public then
    raise exception 'public observations require an evidence source approved for public citation';
  end if;

  perform pg_catalog.set_config(
    'noel.verification_note',
    coalesce(btrim(p_note), ''),
    true
  );

  update public.metric_observations
     set status = 'under_review',
         submitted_at = v_now
   where id = p_observation_id;

  perform pg_catalog.set_config('noel.verification_note', '', true);
  return p_observation_id;
end;
$function$;

create or replace function noel_private.review_metric_observation(
  p_observation_id bigint,
  p_decision text,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_role text;
  v_decision text;
  v_observation public.metric_observations%rowtype;
  v_definition public.metric_definitions%rowtype;
  v_evidence public.evidence_sources%rowtype;
  v_now timestamptz := statement_timestamp();
begin
  v_actor := auth.uid();
  v_role := coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '');
  v_decision := lower(btrim(coalesce(p_decision, '')));

  if v_actor is null or v_role not in ('admin', 'impact_reviewer') then
    raise exception 'not authorized to review metric observations';
  end if;

  if v_decision not in ('verified', 'rejected') then
    raise exception 'review decision must be verified or rejected';
  end if;

  if p_note is not null and char_length(btrim(p_note)) > 2000 then
    raise exception 'review note exceeds 2000 characters';
  end if;

  select observation.*
    into v_observation
    from public.metric_observations as observation
   where observation.id = p_observation_id
   for update;

  if not found then
    raise exception 'metric observation % was not found', p_observation_id;
  end if;

  if v_observation.status <> 'under_review' then
    raise exception 'only observations under review can be reviewed';
  end if;

  if v_decision = 'verified'
    and v_role <> 'admin'
    and v_observation.created_by = v_actor then
    raise exception 'impact reviewers cannot verify their own observations';
  end if;

  select definition.*
    into v_definition
    from public.metric_definitions as definition
   where definition.id = v_observation.metric_definition_id
   for update;

  if not found then
    raise exception 'the metric definition was not found';
  end if;

  if v_decision = 'verified' and v_definition.status <> 'active' then
    raise exception 'only observations for active metric definitions can be verified';
  end if;

  select evidence.*
    into v_evidence
    from public.evidence_sources as evidence
   where evidence.id = v_observation.evidence_source_id
   for share;

  if not found then
    raise exception 'the observation evidence source was not found';
  end if;

  if v_decision = 'verified'
    and v_observation.public_visibility
    and not v_evidence.approved_for_public then
    raise exception 'public observations require an evidence source approved for public citation';
  end if;

  perform pg_catalog.set_config(
    'noel.verification_note',
    coalesce(btrim(p_note), ''),
    true
  );

  if v_decision = 'rejected' then
    update public.metric_observations
       set status = 'rejected',
           verified_by = null,
           verified_at = null,
           published_at = null
     where id = p_observation_id;

    perform pg_catalog.set_config('noel.verification_note', '', true);
    return p_observation_id;
  end if;

  update public.metric_observations
     set status = 'verified',
         verified_by = v_actor,
         verified_at = v_now,
         published_at = case when public_visibility then v_now else null end
   where id = p_observation_id;

  perform pg_catalog.set_config('noel.verification_note', '', true);

  update public.metric_definitions
     set current_verified_observation_id = p_observation_id
   where id = v_definition.id;

  insert into public.impact_metrics (
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
    verified_at,
    verified_by
  )
  values (
    v_definition.key,
    v_definition.label,
    v_observation.value,
    v_definition.unit,
    pg_catalog.left(
      coalesce(v_observation.public_description, v_definition.definition),
      500
    ),
    v_definition.programme,
    v_evidence.public_label,
    'verified',
    v_observation.public_visibility,
    v_definition.display_order,
    v_now,
    v_actor
  )
  on conflict (key) do update
    set label = excluded.label,
        value = excluded.value,
        unit = excluded.unit,
        description = excluded.description,
        programme = excluded.programme,
        source = excluded.source,
        verification_status = excluded.verification_status,
        public_visibility = excluded.public_visibility,
        display_order = excluded.display_order,
        verified_at = excluded.verified_at,
        verified_by = excluded.verified_by;

  return p_observation_id;
end;
$function$;

create or replace function public.submit_metric_observation(
  p_observation_id bigint,
  p_note text default null
)
returns bigint
language sql
security invoker
set search_path = ''
as $function$
  select noel_private.submit_metric_observation(p_observation_id, p_note);
$function$;

create or replace function public.review_metric_observation(
  p_observation_id bigint,
  p_decision text,
  p_note text default null
)
returns bigint
language sql
security invoker
set search_path = ''
as $function$
  select noel_private.review_metric_observation(p_observation_id, p_decision, p_note);
$function$;

drop trigger if exists metric_observations_assign_version on public.metric_observations;
create trigger metric_observations_assign_version
before insert on public.metric_observations
for each row execute function noel_private.assign_metric_observation_version();

drop trigger if exists metric_observations_guard_mutation on public.metric_observations;
create trigger metric_observations_guard_mutation
before insert or update or delete on public.metric_observations
for each row execute function noel_private.guard_metric_observation_mutation();

drop trigger if exists metric_observations_append_event on public.metric_observations;
create trigger metric_observations_append_event
after insert or update on public.metric_observations
for each row execute function noel_private.append_metric_verification_event();

drop trigger if exists metric_observations_set_updated_at on public.metric_observations;
create trigger metric_observations_set_updated_at
before update on public.metric_observations
for each row execute function public.set_updated_at();

drop trigger if exists metric_definitions_guard_mutation on public.metric_definitions;
create trigger metric_definitions_guard_mutation
before insert or update on public.metric_definitions
for each row execute function noel_private.guard_metric_definition_mutation();

drop trigger if exists metric_definitions_sync_presentation on public.metric_definitions;
create trigger metric_definitions_sync_presentation
after update of display_order on public.metric_definitions
for each row execute function noel_private.sync_metric_definition_presentation();

drop trigger if exists metric_definitions_set_updated_at on public.metric_definitions;
create trigger metric_definitions_set_updated_at
before update on public.metric_definitions
for each row execute function public.set_updated_at();

drop trigger if exists evidence_sources_guard_mutation on public.evidence_sources;
create trigger evidence_sources_guard_mutation
before update or delete on public.evidence_sources
for each row execute function noel_private.guard_evidence_source_mutation();

drop trigger if exists evidence_sources_set_updated_at on public.evidence_sources;
create trigger evidence_sources_set_updated_at
before update on public.evidence_sources
for each row execute function public.set_updated_at();

drop trigger if exists verification_events_prevent_mutation on public.verification_events;
create trigger verification_events_prevent_mutation
before update or delete on public.verification_events
for each row execute function noel_private.prevent_verification_event_mutation();

drop trigger if exists impact_metrics_guard_verified_read_model on public.impact_metrics;
create trigger impact_metrics_guard_verified_read_model
before insert or update or delete on public.impact_metrics
for each row execute function noel_private.guard_impact_metric_read_model();

alter table public.evidence_sources enable row level security;
alter table public.metric_definitions enable row level security;
alter table public.metric_observations enable row level security;
alter table public.verification_events enable row level security;

revoke all on table public.evidence_sources from public, anon, authenticated, service_role;
revoke all on table public.metric_definitions from public, anon, authenticated, service_role;
revoke all on table public.metric_observations from public, anon, authenticated, service_role;
revoke all on table public.verification_events from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.evidence_sources to authenticated;
grant select, insert, update, delete on table public.metric_definitions to authenticated;
grant select, insert, update on table public.metric_observations to authenticated;
grant select on table public.verification_events to authenticated;

grant all privileges on table public.evidence_sources to service_role;
grant all privileges on table public.metric_definitions to service_role;
grant all privileges on table public.metric_observations to service_role;
grant all privileges on table public.verification_events to service_role;

revoke all on sequence public.evidence_sources_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.metric_definitions_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.metric_observations_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.verification_events_id_seq from public, anon, authenticated, service_role;

grant usage, select on sequence public.evidence_sources_id_seq to authenticated, service_role;
grant usage, select on sequence public.metric_definitions_id_seq to authenticated, service_role;
grant usage, select on sequence public.metric_observations_id_seq to authenticated, service_role;
grant usage, select on sequence public.verification_events_id_seq to service_role;

drop policy if exists "impact team reads evidence sources" on public.evidence_sources;
create policy "impact team reads evidence sources"
on public.evidence_sources
for select
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role')
    in ('admin', 'impact_editor', 'impact_reviewer')
);

drop policy if exists "impact editors insert evidence sources" on public.evidence_sources;
create policy "impact editors insert evidence sources"
on public.evidence_sources
for insert
to authenticated
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
  and created_by = (select auth.uid())
);

drop policy if exists "impact editors update evidence sources" on public.evidence_sources;
create policy "impact editors update evidence sources"
on public.evidence_sources
for update
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
)
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
);

drop policy if exists "impact editors delete evidence sources" on public.evidence_sources;
create policy "impact editors delete evidence sources"
on public.evidence_sources
for delete
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
);

drop policy if exists "impact team reads metric definitions" on public.metric_definitions;
create policy "impact team reads metric definitions"
on public.metric_definitions
for select
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role')
    in ('admin', 'impact_editor', 'impact_reviewer')
);

drop policy if exists "impact editors insert metric definitions" on public.metric_definitions;
create policy "impact editors insert metric definitions"
on public.metric_definitions
for insert
to authenticated
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
  and created_by = (select auth.uid())
  and current_verified_observation_id is null
);

drop policy if exists "impact editors update metric definitions" on public.metric_definitions;
create policy "impact editors update metric definitions"
on public.metric_definitions
for update
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
)
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
);

drop policy if exists "impact editors delete metric definitions" on public.metric_definitions;
create policy "impact editors delete metric definitions"
on public.metric_definitions
for delete
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
);

drop policy if exists "impact team reads metric observations" on public.metric_observations;
create policy "impact team reads metric observations"
on public.metric_observations
for select
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role')
    in ('admin', 'impact_editor', 'impact_reviewer')
);

drop policy if exists "impact editors insert metric observations" on public.metric_observations;
create policy "impact editors insert metric observations"
on public.metric_observations
for insert
to authenticated
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
  and created_by = (select auth.uid())
  and status = 'draft'
  and submitted_at is null
  and verified_by is null
  and verified_at is null
  and published_at is null
);

drop policy if exists "impact editors update metric observations" on public.metric_observations;
create policy "impact editors update metric observations"
on public.metric_observations
for update
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
  and status <> 'verified'
)
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'impact_editor')
  and status <> 'verified'
);

drop policy if exists "impact team reads verification events" on public.verification_events;
create policy "impact team reads verification events"
on public.verification_events
for select
to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role')
    in ('admin', 'impact_editor', 'impact_reviewer')
);

drop policy if exists "authenticated reads verified impact metrics" on public.impact_metrics;
create policy "authenticated reads verified impact metrics"
on public.impact_metrics
for select
to authenticated
using (verification_status = 'verified' and public_visibility = true);

grant usage on schema noel_private to authenticated, service_role;

revoke all on function noel_private.is_verified_impact_workflow_executor()
  from public, anon, authenticated, service_role;
revoke all on function noel_private.assign_metric_observation_version()
  from public, anon, authenticated, service_role;
revoke all on function noel_private.guard_metric_observation_mutation()
  from public, anon, authenticated, service_role;
revoke all on function noel_private.append_metric_verification_event()
  from public, anon, authenticated, service_role;
revoke all on function noel_private.prevent_verification_event_mutation()
  from public, anon, authenticated, service_role;
revoke all on function noel_private.guard_evidence_source_mutation()
  from public, anon, authenticated, service_role;
revoke all on function noel_private.guard_metric_definition_mutation()
  from public, anon, authenticated, service_role;
revoke all on function noel_private.sync_metric_definition_presentation()
  from public, anon, authenticated, service_role;
revoke all on function noel_private.guard_impact_metric_read_model()
  from public, anon, authenticated, service_role;
revoke all on function noel_private.submit_metric_observation(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function noel_private.review_metric_observation(bigint, text, text)
  from public, anon, authenticated, service_role;

grant execute on function noel_private.is_verified_impact_workflow_executor()
  to authenticated, service_role;
grant execute on function noel_private.submit_metric_observation(bigint, text)
  to authenticated;
grant execute on function noel_private.review_metric_observation(bigint, text, text)
  to authenticated;

revoke all on function public.submit_metric_observation(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.review_metric_observation(bigint, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.submit_metric_observation(bigint, text)
  to authenticated;
grant execute on function public.review_metric_observation(bigint, text, text)
  to authenticated;

grant select (verified_at) on table public.impact_metrics to anon;

create or replace view public.verified_impact_snapshot
with (security_invoker = true, security_barrier = true)
as
select
  metric.key,
  metric.label,
  metric.value,
  metric.unit,
  metric.description,
  metric.programme,
  metric.source,
  metric.display_order,
  metric.verified_at,
  metric.updated_at as snapshot_updated_at
from public.impact_metrics as metric
where metric.verification_status = 'verified'
  and metric.public_visibility = true;

revoke all on table public.verified_impact_snapshot
  from public, anon, authenticated, service_role;
grant select on table public.verified_impact_snapshot
  to anon, authenticated, service_role;

comment on schema noel_private is
  'Non-exposed security-definer workflow and trigger functions for verified impact data.';

comment on table public.metric_definitions is
  'Stable definitions for impact measures. Semantics are frozen after the first verified observation.';

comment on column public.metric_definitions.current_verified_observation_id is
  'Workflow-maintained pointer to the latest verified observation synchronized to impact_metrics.';

comment on table public.metric_observations is
  'Versioned impact measurements. Verified rows are immutable; corrections require a new version.';

comment on table public.evidence_sources is
  'Evidence metadata and safe locators only. Do not store beneficiary or patient data in this table.';

comment on column public.evidence_sources.public_label is
  'Non-sensitive citation copied to the public impact read model after approval.';

comment on table public.verification_events is
  'Append-only workflow audit events. Database superusers can still perform exceptional maintenance.';

comment on view public.verified_impact_snapshot is
  'Security-invoker public snapshot containing only verified, public impact read-model rows.';

comment on function public.submit_metric_observation(bigint, text) is
  'Submits a draft observation for review; callable by admin or impact_editor app_metadata roles.';

comment on function public.review_metric_observation(bigint, text, text) is
  'Verifies or rejects an observation; callable by admin or impact_reviewer app_metadata roles.';

comment on table public.impact_metrics is
  'Website-compatible verified-impact read model. Material changes are synchronized by the observation review workflow.';
