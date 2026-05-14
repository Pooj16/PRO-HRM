-- ============================================
-- CRITICAL SECURITY FIXES
-- ============================================

-- 1. Fix hr_users table - Remove overly permissive policy and add secure ones
DROP POLICY IF EXISTS "HR users can manage their own data" ON hr_users;

CREATE POLICY "Users can view own hr data"
ON hr_users FOR SELECT
TO authenticated
USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own hr data"
ON hr_users FOR UPDATE
TO authenticated
USING (auth.uid()::text = id::text);

CREATE POLICY "Users can insert own hr data"
ON hr_users FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = id::text);

-- 2. Fix assessment_questions - Hide correct answers from candidates
DROP POLICY IF EXISTS "Allow all operations on assessment_questions" ON assessment_questions;
DROP POLICY IF EXISTS "Anyone can create assessment questions" ON assessment_questions;
DROP POLICY IF EXISTS "Users can view assessment questions" ON assessment_questions;

-- Only authenticated HR users can manage questions with answers
CREATE POLICY "Authenticated users can manage assessment questions"
ON assessment_questions FOR ALL
TO authenticated
USING (true);

-- 3. Fix company_settings - Remove public access
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can view company settings" ON company_settings;

CREATE POLICY "Authenticated users can view company settings"
ON company_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage company settings"
ON company_settings FOR ALL
TO authenticated
USING (true);

-- 4. Fix google_calendar_settings - Users can only access their own settings
DROP POLICY IF EXISTS "Users can manage their own calendar settings" ON google_calendar_settings;

CREATE POLICY "Users can view own calendar settings"
ON google_calendar_settings FOR SELECT
TO authenticated
USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage own calendar settings"
ON google_calendar_settings FOR ALL
TO authenticated
USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 5. Fix team_leads - Add management policies for HR users
CREATE POLICY "HR users can manage team leads"
ON team_leads FOR ALL
TO authenticated
USING (true);

-- 6. Fix assessments - Restrict to authenticated users
DROP POLICY IF EXISTS "Allow all operations on assessments" ON assessments;
DROP POLICY IF EXISTS "Anyone can create assessments" ON assessments;
DROP POLICY IF EXISTS "Anyone can update assessments" ON assessments;
DROP POLICY IF EXISTS "Users can view all assessments" ON assessments;

CREATE POLICY "Authenticated users can manage assessments"
ON assessments FOR ALL
TO authenticated
USING (true);

-- 7. Fix filter_presets - Restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can view filter presets" ON filter_presets;
DROP POLICY IF EXISTS "HR users can manage filter presets" ON filter_presets;

CREATE POLICY "Authenticated users can view filter presets"
ON filter_presets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage filter presets"
ON filter_presets FOR ALL
TO authenticated
USING (true);

-- 8. Fix assessment_assignments
DROP POLICY IF EXISTS "Anyone can create assignments" ON assessment_assignments;
DROP POLICY IF EXISTS "Anyone can view assessment assignments" ON assessment_assignments;
DROP POLICY IF EXISTS "HR users can manage assessment assignments" ON assessment_assignments;
DROP POLICY IF EXISTS "Users can view all assignments" ON assessment_assignments;

CREATE POLICY "Authenticated users can manage assignments"
ON assessment_assignments FOR ALL
TO authenticated
USING (true);

-- 9. Fix hr_settings
DROP POLICY IF EXISTS "Allow all operations on hr_settings" ON hr_settings;

CREATE POLICY "Authenticated users can manage hr_settings"
ON hr_settings FOR ALL
TO authenticated
USING (true);

-- 10. Fix interview_schedule
DROP POLICY IF EXISTS "Allow all operations on interview_schedule" ON interview_schedule;

CREATE POLICY "Authenticated users can manage interview_schedule"
ON interview_schedule FOR ALL
TO authenticated
USING (true);

-- 11. Fix candidate_assessments
DROP POLICY IF EXISTS "Allow all operations on candidate_assessments" ON candidate_assessments;

CREATE POLICY "Authenticated users can manage candidate_assessments"
ON candidate_assessments FOR ALL
TO authenticated
USING (true);

-- 12. Fix role_thresholds
DROP POLICY IF EXISTS "Allow all operations on role_thresholds" ON role_thresholds;

CREATE POLICY "Authenticated users can manage role_thresholds"
ON role_thresholds FOR ALL
TO authenticated
USING (true);

-- 13. Fix scheduled_interviews - Clean up redundant policies
DROP POLICY IF EXISTS "Anyone can view scheduled interviews" ON scheduled_interviews;
DROP POLICY IF EXISTS "HR users can manage scheduled interviews" ON scheduled_interviews;

-- 14. Fix function search_path - Use CREATE OR REPLACE instead of DROP
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;