
-- 🛠️ Fixing missing columns in interview_schedule
-- The TypeScript types expect these, but the DB is missing them.

ALTER TABLE public.interview_schedule 
ADD COLUMN IF NOT EXISTS interview_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS interview_type TEXT DEFAULT 'Technical';

-- Ensure RLS allows public to insert these new columns
DROP POLICY IF EXISTS "Portal interview insert" ON public.interview_schedule;
CREATE POLICY "Portal interview insert" ON public.interview_schedule
    FOR INSERT TO public
    WITH CHECK (true);
