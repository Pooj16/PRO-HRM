-- Tenant + security foundation.  This migration only adds columns, rows and policies;
-- it deliberately keeps all existing business data in a legacy/default organization.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'hr',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.profiles add column if not exists active_organization_id uuid references public.organizations(id);

insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Legacy organization', 'legacy')
on conflict (id) do nothing;

-- Existing users retain their most privileged legacy role; users without a role become HR.
insert into public.organization_memberships (organization_id, user_id, role)
select '00000000-0000-0000-0000-000000000001', p.id,
  coalesce((select case ur.role::text
                    when 'admin' then 'admin'::public.app_role
                    when 'hr' then 'hr'::public.app_role
                    when 'team_lead' then 'team_lead'::public.app_role
                    when 'hiring_manager' then 'team_lead'::public.app_role
                    else 'hr'::public.app_role end
             from public.user_roles ur where ur.user_id = p.id
             order by case ur.role::text when 'admin' then 3 when 'hr' then 2 when 'team_lead' then 1 when 'hiring_manager' then 1 else 0 end desc limit 1), 'hr'::public.app_role)
from public.profiles p
on conflict (organization_id, user_id) do nothing;

update public.profiles p
set active_organization_id = '00000000-0000-0000-0000-000000000001'
where active_organization_id is null
  and exists (select 1 from public.organization_memberships m where m.user_id = p.id);

-- New self-service accounts receive an isolated organization rather than access to
-- legacy data. This replaces the previous profile-only provisioning trigger.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare organization_uuid uuid := gen_random_uuid();
begin
  insert into public.profiles (id, email, full_name, active_organization_id)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email), organization_uuid)
  on conflict (id) do update set active_organization_id = excluded.active_organization_id;
  insert into public.organizations (id, name, slug)
  values (organization_uuid, coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Organization') || ' Organization', 'org-' || substr(new.id::text, 1, 8));
  insert into public.organization_memberships (organization_id, user_id, role)
  values (organization_uuid, new.id, 'admin');
  return new;
end;
$$;

create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.active_organization_id from public.profiles p where p.id = auth.uid()),
    (select m.organization_id from public.organization_memberships m where m.user_id = auth.uid() order by m.created_at limit 1)
  )
$$;

create or replace function public.is_organization_member(_organization_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_memberships m
                 where m.organization_id = _organization_id and m.user_id = _user_id)
$$;

create or replace function public.can_manage_organization(_organization_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_memberships m
                 where m.organization_id = _organization_id and m.user_id = _user_id
                   and m.role in ('admin', 'hr'))
$$;

-- Add the tenant key to every HR-owned record currently in this schema.  Defaults make
-- existing client inserts safe during the rollout; new tenants get their selected context.
do $$
declare t text;
begin
  foreach t in array array[
    'candidates','assessments','assessment_questions','assessment_assignments',
    'assessment_sessions','candidate_responses','evaluation_results','interview_schedule',
    'candidate_assignments','team_leads','hr_settings','role_thresholds','google_form_responses',
    'hr_users','employees','filter_presets','scheduled_interviews','bgv_verification_contacts','audit_logs',
    'candidate_assessments','filter_criteria','responses','assessment_anti_cheat','assessment_nonces'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists organization_id uuid', t);
      execute format('update public.%I set organization_id = $1 where organization_id is null', t)
        using '00000000-0000-0000-0000-000000000001'::uuid;
      execute format('alter table public.%I alter column organization_id set default public.current_organization_id()', t);
      execute format('alter table public.%I alter column organization_id set not null', t);
      if not exists (select 1 from pg_constraint where conname = t || '_organization_id_fkey') then
        execute format('alter table public.%I add constraint %I foreign key (organization_id) references public.organizations(id)', t, t || '_organization_id_fkey');
      end if;
      execute format('create index if not exists %I on public.%I (organization_id)', 'idx_' || t || '_organization_id', t);
    end if;
  end loop;
end $$;

-- A short-lived capability used only by the public Careers submit flow to authorize its
-- own extraction request. It is never readable through PostgREST after policy hardening.
alter table public.bgv_verification_contacts add column if not exists verification_token uuid unique;
alter table public.bgv_verification_contacts add column if not exists manager_status text not null default 'Pending';
alter table public.bgv_verification_contacts add column if not exists university_status text not null default 'Pending';
alter table public.bgv_verification_contacts add column if not exists hr_status text not null default 'Pending';
alter table public.bgv_verification_contacts add column if not exists reference_status text not null default 'Pending';

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

create policy "Members can view their organizations" on public.organizations for select to authenticated
  using (public.is_organization_member(id));
create policy "Admins can update their organizations" on public.organizations for update to authenticated
  using (public.can_manage_organization(id)) with check (public.can_manage_organization(id));
create policy "Members can view organization memberships" on public.organization_memberships for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "Admins can manage organization memberships" on public.organization_memberships for all to authenticated
  using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));

-- Replace the previous global `USING (true)` policies.  The loop intentionally targets
-- tenant-owned tables only, leaving auth/profile policy ownership untouched.
do $$
declare t text; p record;
begin
  foreach t in array array[
    'candidates','assessments','assessment_questions','assessment_assignments',
    'assessment_sessions','candidate_responses','evaluation_results','interview_schedule',
    'candidate_assignments','team_leads','hr_settings','role_thresholds','google_form_responses',
    'hr_users','employees','filter_presets','scheduled_interviews','bgv_verification_contacts','audit_logs',
    'candidate_assessments','filter_criteria','responses','assessment_anti_cheat','assessment_nonces'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy if exists %I on public.%I', p.policyname, t);
      end loop;
      execute format('create policy %I on public.%I for select to authenticated using (public.is_organization_member(organization_id))', t || '_tenant_select', t);
      execute format('create policy %I on public.%I for insert to authenticated with check (public.can_manage_organization(organization_id))', t || '_tenant_insert', t);
      execute format('create policy %I on public.%I for update to authenticated using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id))', t || '_tenant_update', t);
      execute format('create policy %I on public.%I for delete to authenticated using (public.can_manage_organization(organization_id))', t || '_tenant_delete', t);
    end if;
  end loop;
end $$;

-- Candidate-facing assessment/BGV interactions now go through token-validating Edge
-- Functions. No anonymous policy can enumerate candidate, question, session or BGV data.

-- Resume paths are now organization-prefixed. Only organization members can access them
-- directly; public uploads use a signed upload URL issued by the Careers function.
drop policy if exists "Authenticated users can upload resumes" on storage.objects;
drop policy if exists "Authenticated users can view resumes" on storage.objects;
drop policy if exists "Authenticated users can update resumes" on storage.objects;
drop policy if exists "Authenticated users can delete resumes" on storage.objects;
drop policy if exists "Allow Service Role full access to bgv documents" on storage.objects;
drop policy if exists "Allow Candidates to Insert bgv documents" on storage.objects;
drop policy if exists "Allow HR to read bgv documents" on storage.objects;
create policy "Organization members read resumes" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and public.is_organization_member((storage.foldername(name))[1]::uuid));
create policy "Organization managers write resumes" on storage.objects for all to authenticated
  using (bucket_id = 'resumes' and public.can_manage_organization((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'resumes' and public.can_manage_organization((storage.foldername(name))[1]::uuid));
create policy "Organization members read BGV documents" on storage.objects for select to authenticated
  using (bucket_id = 'bgv-documents' and public.is_organization_member((storage.foldername(name))[1]::uuid));

-- Ensure new sign-ups do not silently receive global access. An administrator must create
-- a membership (or the organization onboarding flow must do so) before dashboard access.
revoke execute on function public.current_organization_id() from public, anon;
revoke execute on function public.is_organization_member(uuid, uuid) from public, anon;
revoke execute on function public.can_manage_organization(uuid, uuid) from public, anon;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.is_organization_member(uuid, uuid) to authenticated;
grant execute on function public.can_manage_organization(uuid, uuid) to authenticated;

-- Public Careers sites provide an authoritative organization context. Clients submit a
-- site slug, never an organization UUID. Existing /careers traffic uses the legacy site.
create table if not exists public.career_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.career_sites (organization_id, slug)
values ('00000000-0000-0000-0000-000000000001', 'careers')
on conflict (slug) do nothing;
alter table public.career_sites enable row level security;
create policy "Published career sites are public" on public.career_sites for select to anon, authenticated using (is_published);
create policy "Organization managers manage career sites" on public.career_sites for all to authenticated
  using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));

-- Store public resume-processing capabilities separately from candidate rows. The raw
-- value is returned once to the browser; only its SHA-256 digest is persisted.
create table if not exists public.resume_processing_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.resume_processing_capabilities enable row level security;
create policy "Organization managers view resume capabilities" on public.resume_processing_capabilities for select to authenticated
  using (public.can_manage_organization(organization_id));

create table if not exists public.bgv_reference_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.bgv_verification_contacts(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('Manager', 'University Records', 'Human Resources', 'Reference')),
  token uuid not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (contact_id, recipient_role)
);
alter table public.bgv_reference_tokens enable row level security;
create policy "Organization managers view BGV reference tokens" on public.bgv_reference_tokens for select to authenticated
  using (public.can_manage_organization(organization_id));

-- Tenant relationship checks cover legacy foreign keys that cannot be made composite
-- without a destructive constraint rewrite.
create or replace function public.enforce_tenant_relationship()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_org uuid;
begin
  if tg_table_name in ('assessment_questions') then select organization_id into parent_org from public.assessments where id = new.assessment_id;
  elsif tg_table_name in ('assessment_assignments','candidate_assessments') then
    select organization_id into parent_org from public.candidates where id = new.candidate_id;
    if parent_org is distinct from new.organization_id or not exists (select 1 from public.assessments where id = new.assessment_id and organization_id = new.organization_id) then raise exception 'cross-organization assessment relationship'; end if;
  elsif tg_table_name = 'assessment_sessions' then
    select organization_id into parent_org from public.candidates where id = new.candidate_id;
    if parent_org is distinct from new.organization_id or not exists (select 1 from public.assessments where id = new.assessment_id and organization_id = new.organization_id) then raise exception 'cross-organization assessment session'; end if;
  elsif tg_table_name in ('candidate_responses','responses') then
    select organization_id into parent_org from public.assessment_sessions where id = new.session_id;
    if parent_org is distinct from new.organization_id or not exists (select 1 from public.assessment_questions where id = new.question_id and organization_id = new.organization_id) then raise exception 'cross-organization assessment response'; end if;
  elsif tg_table_name in ('evaluation_results','assessment_anti_cheat','assessment_nonces') then select organization_id into parent_org from public.assessment_sessions where id = new.session_id;
  elsif tg_table_name in ('interview_schedule','scheduled_interviews','bgv_verification_contacts','employees') then select organization_id into parent_org from public.candidates where id = new.candidate_id;
  elsif tg_table_name = 'candidate_assignments' then
    select organization_id into parent_org from public.candidates where id = new.candidate_id;
    if parent_org is distinct from new.organization_id or not exists (select 1 from public.team_leads where id = new.team_lead_id and organization_id = new.organization_id) then raise exception 'cross-organization candidate assignment'; end if;
  end if;
  if parent_org is distinct from new.organization_id then raise exception 'cross-organization relationship'; end if;
  return new;
end;
$$;
do $$ declare t text; begin
  foreach t in array array['assessment_questions','assessment_assignments','candidate_assessments','assessment_sessions','candidate_responses','responses','evaluation_results','assessment_anti_cheat','assessment_nonces','interview_schedule','scheduled_interviews','bgv_verification_contacts','employees','candidate_assignments'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', 'enforce_' || t || '_tenant_relationship', t);
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.enforce_tenant_relationship()', 'enforce_' || t || '_tenant_relationship', t);
    end if;
  end loop;
end $$;

-- A membership may select only an organization it belongs to as the active tenant.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and (active_organization_id is null or public.is_organization_member(active_organization_id)));

-- Scope configuration identities that are organization-owned; HR user identity remains
-- globally unique because it represents an auth user, not a tenant-local record.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'team_leads_email_key') then alter table public.team_leads drop constraint team_leads_email_key; end if;
  if exists (select 1 from pg_constraint where conname = 'hr_settings_setting_key_key') then alter table public.hr_settings drop constraint hr_settings_setting_key_key; end if;
  if exists (select 1 from pg_constraint where conname = 'hr_settings_setting_key') then alter table public.hr_settings drop constraint hr_settings_setting_key; end if;
  if exists (select 1 from pg_constraint where conname = 'role_thresholds_role_name_key') then alter table public.role_thresholds drop constraint role_thresholds_role_name_key; end if;
end $$;
create unique index if not exists team_leads_organization_email_key on public.team_leads(organization_id, email);
create unique index if not exists hr_settings_organization_key_key on public.hr_settings(organization_id, setting_key);
create unique index if not exists role_thresholds_organization_name_key on public.role_thresholds(organization_id, role_name);

-- Compatibility policy: new paths use a UUID first folder; legacy unprefixed paths are
-- visible only to members of the legacy organization and are never cast to UUID.
create or replace function public.storage_object_organization_id(object_name text)
returns uuid language sql immutable security definer set search_path = public as $$
  select case when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(object_name, '/', 1)::uuid else null end
$$;
drop policy if exists "Organization members read resumes" on storage.objects;
drop policy if exists "Organization managers write resumes" on storage.objects;
drop policy if exists "Organization members read BGV documents" on storage.objects;
create policy "Tenant members read resumes" on storage.objects
for select to authenticated
using (
  bucket_id = 'resumes'
  and (
    (
      public.storage_object_organization_id(name) is not null
      and public.is_organization_member(
        public.storage_object_organization_id(name)
      )
    )
    or (
      public.storage_object_organization_id(name) is null
      and public.is_organization_member(
        '00000000-0000-0000-0000-000000000001'
      )
    )
  )
);

create policy "Organization managers write resumes" on storage.objects
for all to authenticated
using (
  bucket_id = 'resumes'
  and (
    (
      public.storage_object_organization_id(name) is not null
      and public.can_manage_organization(
        public.storage_object_organization_id(name)
      )
    )
    or (
      public.storage_object_organization_id(name) is null
      and public.can_manage_organization(
        '00000000-0000-0000-0000-000000000001'
      )
    )
  )
)
with check (
  bucket_id = 'resumes'
  and (
    (
      public.storage_object_organization_id(name) is not null
      and public.can_manage_organization(
        public.storage_object_organization_id(name)
      )
    )
    or (
      public.storage_object_organization_id(name) is null
      and public.can_manage_organization(
        '00000000-0000-0000-0000-000000000001'
      )
    )
  )
);

create policy "Tenant members read BGV documents" on storage.objects
for select to authenticated
using (
  bucket_id = 'bgv-documents'
  and (
    (
      public.storage_object_organization_id(name) is not null
      and public.is_organization_member(
        public.storage_object_organization_id(name)
      )
    )
    or (
      public.storage_object_organization_id(name) is null
      and public.is_organization_member(
        '00000000-0000-0000-0000-000000000001'
      )
    )
  )
);
revoke execute on function public.storage_object_organization_id(text) from public, anon;
grant execute on function public.storage_object_organization_id(text) to authenticated;
