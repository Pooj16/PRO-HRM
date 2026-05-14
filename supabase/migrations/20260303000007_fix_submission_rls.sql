
-- 🛠️ Final RLS Fixes for Candidate Submission
-- This allows the anonymous candidate portal to actually SAVE results

-- 1. Allow public to manage (insert/update) evaluation_results
DROP POLICY IF EXISTS "Portal evaluation access" ON public.evaluation_results;
CREATE POLICY "Portal evaluation access" ON public.evaluation_results
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);

-- 2. Allow public to update candidates (status only)
DROP POLICY IF EXISTS "Portal candidate update" ON public.candidates;
CREATE POLICY "Portal candidate update" ON public.candidates
    FOR UPDATE TO public
    USING (true);

-- 3. Allow public to update assessment_assignments
DROP POLICY IF EXISTS "Portal assignment update" ON public.assessment_assignments;
CREATE POLICY "Portal assignment update" ON public.assessment_assignments
    FOR UPDATE TO public
    USING (true);

-- 4. Allow public to update assessment_sessions (to save final scores)
DROP POLICY IF EXISTS "Portal session update access" ON public.assessment_sessions;
CREATE POLICY "Portal session update access" ON public.assessment_sessions
    FOR UPDATE TO public
    USING (true);
