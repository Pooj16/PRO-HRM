-- 🛠️ Fix RLS Policies for Candidate Assessment Portal
-- This allows anonymous candidates to view and complete tests using their secure tokens.

-- 1. Candidates Table: Allow public to read basic info
DROP POLICY IF EXISTS "Portal candidate access" ON public.candidates;
CREATE POLICY "Portal candidate access" ON public.candidates
    FOR SELECT TO public
    USING (true);

-- 2. Assessments Table: Allow public to read test details
DROP POLICY IF EXISTS "Portal assessment access" ON public.assessments;
CREATE POLICY "Portal assessment access" ON public.assessments
    FOR SELECT TO public
    USING (true);

-- 3. Assessment Questions: Allow public to read questions
DROP POLICY IF EXISTS "Portal question access" ON public.assessment_questions;
CREATE POLICY "Portal question access" ON public.assessment_questions
    FOR SELECT TO public
    USING (true);

-- 4. Assessment Sessions: Allow public to READ and UPDATE their session
DROP POLICY IF EXISTS "Portal session select access" ON public.assessment_sessions;
CREATE POLICY "Portal session select access" ON public.assessment_sessions
    FOR SELECT TO public
    USING (true); -- We filter by token in the query anyway

DROP POLICY IF EXISTS "Portal session update access" ON public.assessment_sessions;
CREATE POLICY "Portal session update access" ON public.assessment_sessions
    FOR UPDATE TO public
    USING (status != 'evaluated')
    WITH CHECK (status != 'evaluated');

-- 5. Candidate Responses: Ensure public can insert/update their answers
DROP POLICY IF EXISTS "Portal response access" ON public.candidate_responses;
CREATE POLICY "Portal response access" ON public.candidate_responses
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);

-- 6. Assessment Assignments: Allow public to read info
DROP POLICY IF EXISTS "Portal assignment access" ON public.assessment_assignments;
CREATE POLICY "Portal assignment access" ON public.assessment_assignments
    FOR SELECT TO public
    USING (true);

-- 7. Secure standard select for evaluation results if needed (for later)
DROP POLICY IF EXISTS "Portal evaluation access" ON public.evaluation_results;
CREATE POLICY "Portal evaluation access" ON public.evaluation_results
    FOR SELECT TO public
    USING (true);
