-- Migration: Fix deletion constraints for candidates
-- This allows for a "fresh start" by deleting candidates without foreign key errors.

BEGIN;

-- 1. Fix assessment_assignments constraint
-- The user reported assessment_assignments_session_id_fkey blocks deletion.
-- We ensure all assignments are deleted when the session (and thus candidate) is deleted.
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'assessment_assignments_session_id_fkey') THEN
    ALTER TABLE public.assessment_assignments DROP CONSTRAINT IF EXISTS assessment_assignments_session_id_fkey;
    ALTER TABLE public.assessment_assignments 
    ADD CONSTRAINT assessment_assignments_session_id_fkey 
    FOREIGN KEY (session_id) REFERENCES public.assessment_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Fix employees table constraint
-- Deleting a candidate should also delete their converted employee record if it exists.
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'employees_candidate_id_fkey') THEN
    ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_candidate_id_fkey;
    ALTER TABLE public.employees 
    ADD CONSTRAINT employees_candidate_id_fkey 
    FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Double check other potential blockers
-- Ensure audit_logs don't block deletion (they don't have FKs, but good practice)
-- Ensure background verification contacts are cascaded (already checked in migration 20260304000000)

COMMIT;
