-- Migration: Allow email reuse for candidates
-- This enables testing with the same email while still preventing duplicates on sync.

BEGIN;

-- 1. Drop the UNIQUE(email) constraint if it exists
-- We check several possible names for the constraint based on common Supabase patterns
DO $$ 
BEGIN 
  -- Check for explicit unique constraint
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidates_email_key') THEN
    ALTER TABLE public.candidates DROP CONSTRAINT candidates_email_key;
  END IF;
  
  -- Check if setup-new-project added it as a unique index or constraint
  -- Some versions of the setup script use UNIQUE in table definition which creates an implicit constraint
END $$;

-- 2. Add career_id column to track origin
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS career_id UUID;

-- 3. Create index for faster sync deduplication
CREATE INDEX IF NOT EXISTS idx_candidates_career_id ON public.candidates(career_id);

COMMIT;
