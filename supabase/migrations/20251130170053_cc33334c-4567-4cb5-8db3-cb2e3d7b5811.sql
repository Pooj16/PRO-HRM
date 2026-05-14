-- Add missing columns to match TypeScript interfaces

-- Update assessments table
ALTER TABLE public.assessments
ADD COLUMN IF NOT EXISTS duration integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS questions integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS difficulty text,
ADD COLUMN IF NOT EXISTS required_skills text[],
ADD COLUMN IF NOT EXISTS pass_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS candidates_assigned integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Update assessment_questions table
ALTER TABLE public.assessment_questions
ADD COLUMN IF NOT EXISTS question_type text DEFAULT 'multiple_choice';

-- Update interview_schedule table (rename and add columns)
ALTER TABLE public.interview_schedule
ADD COLUMN IF NOT EXISTS interviewer_email text,
ADD COLUMN IF NOT EXISTS scheduled_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS calendar_event_id text;

-- Migrate existing data
UPDATE public.interview_schedule
SET interviewer_email = interviewer,
    scheduled_time = interview_date
WHERE interviewer_email IS NULL OR scheduled_time IS NULL;

-- Update role_thresholds table
ALTER TABLE public.role_thresholds
ADD COLUMN IF NOT EXISTS min_ats_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_ats_score integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS min_assessment_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_shortlist boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS team_lead_id uuid REFERENCES team_leads(id),
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Migrate existing data in role_thresholds
UPDATE public.role_thresholds
SET min_ats_score = min_score
WHERE min_ats_score = 0;

-- Update hr_users table
ALTER TABLE public.hr_users
ADD COLUMN IF NOT EXISTS google_calendar_connected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS google_access_token text,
ADD COLUMN IF NOT EXISTS google_refresh_token text,
ADD COLUMN IF NOT EXISTS google_token_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Update candidates table
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS education text,
ADD COLUMN IF NOT EXISTS salary_expectation numeric;

-- Create filter_presets table for advanced filtering
CREATE TABLE IF NOT EXISTS public.filter_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  min_experience_years integer,
  required_skills text[],
  education_levels text[],
  location_preferences text[],
  min_salary numeric,
  max_salary numeric,
  job_types text[],
  min_ats_score integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on filter_presets
ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view filter presets"
ON public.filter_presets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage filter presets"
ON public.filter_presets FOR ALL
TO authenticated
USING (true);

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hr_users_updated_at
BEFORE UPDATE ON public.hr_users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_filter_presets_updated_at
BEFORE UPDATE ON public.filter_presets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
