-- Create assessment_nonces table for anti-replay protection
create table if not exists assessment_nonces (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  nonce_hash text not null,
  used boolean default false,
  created_at timestamp with time zone default now(),
  used_at timestamp with time zone,
  expires_at timestamp with time zone not null,
  
  -- Foreign key to assessment_sessions
  constraint fk_assessment_nonces_session 
    foreign key (session_id) 
    references assessment_sessions(id) 
    on delete cascade
);

-- Create indexes for efficient querying
create index if not exists idx_assessment_nonces_session_id on assessment_nonces(session_id);
create index if not exists idx_assessment_nonces_nonce_hash on assessment_nonces(nonce_hash);
create index if not exists idx_assessment_nonces_expires_at on assessment_nonces(expires_at);
create index if not exists idx_assessment_nonces_used on assessment_nonces(used);

-- Add IP tracking columns to assessment_sessions if they don't exist
-- (This is safe to run multiple times)
alter table if exists assessment_sessions 
  add column if not exists client_ip text default 'unknown',
  add column if not exists ip_change_count integer default 0,
  add column if not exists last_activity_at timestamp with time zone default now();

-- Create indexes for IP tracking
create index if not exists idx_assessment_sessions_client_ip on assessment_sessions(client_ip);
create index if not exists idx_assessment_sessions_last_activity on assessment_sessions(last_activity_at);
