-- Add soft delete capability to candidates table
-- and ensure assessment results are ordered correctly for the UI

-- 1. Add is_deleted column
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Add index for performance on filtering
CREATE INDEX IF NOT EXISTS idx_candidates_is_deleted ON public.candidates(is_deleted);

-- 3. Add created_at indexes to assessment tables to ensure deterministic ordering
-- (Postgrest ordering is usually fine but indexes help the database)
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_created_at ON public.assessment_assignments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_created_at ON public.assessment_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_created_at ON public.evaluation_results(created_at DESC);
