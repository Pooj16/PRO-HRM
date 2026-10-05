-- Phase 2, first slice: tenant-owned job postings linked to the existing candidate pipeline.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  department text,
  location text,
  employment_type text,
  description text,
  openings integer not null default 1 check (openings > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, slug)
);

create index jobs_public_listing_idx on public.jobs (organization_id, status, created_at desc);
alter table public.jobs enable row level security;
create policy jobs_member_read on public.jobs for select to authenticated
  using (public.is_organization_member(organization_id));
create policy jobs_manager_insert on public.jobs for insert to authenticated
  with check (public.can_manage_organization(organization_id));
create policy jobs_manager_update on public.jobs for update to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));
create policy jobs_manager_delete on public.jobs for delete to authenticated
  using (public.can_manage_organization(organization_id));

alter table public.candidates add column job_id uuid;
alter table public.candidates add constraint candidates_job_same_organization_fkey
  foreign key (organization_id, job_id) references public.jobs (organization_id, id);
create index candidates_organization_job_idx on public.candidates (organization_id, job_id);

create trigger set_jobs_updated_at before update on public.jobs
  for each row execute function public.update_updated_at_column();

-- Give every current and future tenant a public Careers URL that resolves through
-- career_sites. The legacy tenant keeps the existing /careers slug.
create or replace function public.create_default_career_site()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.career_sites (organization_id, slug)
  values (
    new.id,
    case when new.id = '00000000-0000-0000-0000-000000000001'::uuid
      then 'careers'
      else 'careers-' || left(replace(new.id::text, '-', ''), 8)
    end
  )
  on conflict (slug) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_create_career_site on public.organizations;
create trigger organizations_create_career_site
  after insert on public.organizations
  for each row execute function public.create_default_career_site();

insert into public.career_sites (organization_id, slug)
select o.id,
  case when o.id = '00000000-0000-0000-0000-000000000001'::uuid
    then 'careers'
    else 'careers-' || left(replace(o.id::text, '-', ''), 8)
  end
from public.organizations o
on conflict (slug) do nothing;

-- Keep the current public Careers page populated while moving its roles into managed data.
insert into public.jobs (organization_id, title, slug, department, location, employment_type, openings, status)
values
 ('00000000-0000-0000-0000-000000000001', 'Frontend Engineer', 'frontend-engineer', 'Engineering', 'Remote', 'Full-time', 3, 'published'),
 ('00000000-0000-0000-0000-000000000001', 'Backend Engineer', 'backend-engineer', 'Engineering', 'Remote', 'Full-time', 2, 'published'),
 ('00000000-0000-0000-0000-000000000001', 'Full Stack Engineer', 'full-stack-engineer', 'Engineering', 'Remote', 'Full-time', 2, 'published'),
 ('00000000-0000-0000-0000-000000000001', 'Product Manager', 'product-manager', 'Product', 'Remote', 'Full-time', 1, 'published'),
 ('00000000-0000-0000-0000-000000000001', 'UX Designer', 'ux-designer', 'Design', 'Remote', 'Full-time', 2, 'published'),
 ('00000000-0000-0000-0000-000000000001', 'Data Scientist', 'data-scientist', 'Data', 'Remote', 'Full-time', 1, 'published')
on conflict (organization_id, slug) do nothing;
