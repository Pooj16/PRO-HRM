-- Enable real-time for all core tables to ensure the HR Dashboard is truly reactive
-- This allows the UI to update instantly when a candidate completes an assessment

-- 1. Enable replication for the core high-value tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assessment_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assessment_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluation_results;

-- 2. Ensure RLS allows the 'authenticated' user (HR) to receive these changes
-- (Policies are already in place, but this is a reminder that replication respects RLS)
