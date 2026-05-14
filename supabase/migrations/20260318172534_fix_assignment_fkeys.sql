-- Comprehensive constraint fix for assessment_assignments to cascade on delete
-- Addresses the 'Key (id)=(...) is still referenced from table assessment_assignments' error 
-- on candidate deletion by dropping and recreating all relevant foreign keys with ON DELETE CASCADE.

BEGIN;

DO $$ 
BEGIN 
  -- 1. Fix candidate_id foreign key constraint in assessment_assignments
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'assessment_assignments_candidate_id_fkey') THEN
    ALTER TABLE public.assessment_assignments DROP CONSTRAINT IF EXISTS assessment_assignments_candidate_id_fkey;
  END IF;
  
  ALTER TABLE public.assessment_assignments 
  ADD CONSTRAINT assessment_assignments_candidate_id_fkey 
  FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;

  -- 2. Fix assessment_id foreign key constraint in assessment_assignments (for completeness)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'assessment_assignments_assessment_id_fkey') THEN
    ALTER TABLE public.assessment_assignments DROP CONSTRAINT IF EXISTS assessment_assignments_assessment_id_fkey;
  END IF;
  
  ALTER TABLE public.assessment_assignments 
  ADD CONSTRAINT assessment_assignments_assessment_id_fkey 
  FOREIGN KEY (assessment_id) REFERENCES public.assessments(id) ON DELETE CASCADE;

  -- 3. Fix session_id foreign key constraint in assessment_assignments (dynamically check column)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_assignments' AND column_name = 'session_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'assessment_assignments_session_id_fkey') THEN
      ALTER TABLE public.assessment_assignments DROP CONSTRAINT IF EXISTS assessment_assignments_session_id_fkey;
    END IF;
    
    ALTER TABLE public.assessment_assignments 
    ADD CONSTRAINT assessment_assignments_session_id_fkey 
    FOREIGN KEY (session_id) REFERENCES public.assessment_sessions(id) ON DELETE CASCADE;
  END IF;

END $$;

COMMIT;
