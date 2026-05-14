-- Create audit_logs table for security tracking
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  details jsonb default '{}',
  result text not null check (result in ('success', 'failed', 'denied')),
  user_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone default now()
);

-- Create indexes for efficient querying
create index if not exists idx_audit_logs_user_id on audit_logs(user_id);
create index if not exists idx_audit_logs_action on audit_logs(action);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);
create index if not exists idx_audit_logs_resource on audit_logs(resource_type, resource_id);

-- Enable Row Level Security
alter table audit_logs enable row level security;

-- Policy: Only admins and HR users can view audit logs
create policy "audit_logs_view_policy" on audit_logs
  for select
  using (
    exists (
      select 1 from auth.users
      where auth.uid() = users.id
      and (users.raw_user_meta_data ->> 'role' = 'admin' or users.raw_user_meta_data ->> 'role' = 'hr')
    )
  );

-- Policy: Only system can insert (via service role)
create policy "audit_logs_insert_policy" on audit_logs
  for insert
  with check (true);

-- Create rate_limit_tracking table
create table if not exists rate_limit_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  request_count integer default 1,
  window_start timestamp with time zone default now(),
  last_request_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Create indexes for rate limiting
create index if not exists idx_rate_limit_user_endpoint on rate_limit_tracking(user_id, endpoint);
create index if not exists idx_rate_limit_window_start on rate_limit_tracking(window_start);

-- Create assessment_anti_cheat table
create table if not exists assessment_anti_cheat (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references assessment_sessions(id),
  event_type text not null check (event_type in ('tab_switch', 'fullscreen_exit', 'mouse_leave', 'ip_change', 'proctoring_start', 'proctoring_stop')),
  details jsonb default '{}',
  severity text default 'info' check (severity in ('info', 'warning', 'critical')),
  created_at timestamp with time zone default now()
);

-- Create indexes for anti-cheat tracking
create index if not exists idx_anti_cheat_session on assessment_anti_cheat(assessment_session_id);
create index if not exists idx_anti_cheat_event_type on assessment_anti_cheat(event_type);

-- Create user_roles table for flexible RBAC
create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  role text not null check (role in ('admin', 'hr', 'hiring_manager', 'candidate', 'guest')),
  assigned_by uuid,
  assigned_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Create indexes for user roles
create index if not exists idx_user_roles_user_id on user_roles(user_id);
create index if not exists idx_user_roles_role on user_roles(role);

-- Add RLS policies for user_roles
alter table user_roles enable row level security;

create policy "user_roles_view_policy" on user_roles
  for select
  using (
    auth.uid() = user_id or 
    exists (
      select 1 from auth.users
      where auth.uid() = users.id
      and (users.raw_user_meta_data ->> 'role' = 'admin')
    )
  );

create policy "user_roles_update_policy" on user_roles
  for update
  using (
    exists (
      select 1 from auth.users
      where auth.uid() = users.id
      and (users.raw_user_meta_data ->> 'role' = 'admin')
    )
  );
