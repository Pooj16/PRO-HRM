
-- Add missing columns to existing tables for the complete workflow
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_expectation INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_text TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 0;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS match_percentage INTEGER DEFAULT 0;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'uploaded';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_status TEXT DEFAULT 'pending';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS applied_date TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to assessments table
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'intermediate';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS required_skills TEXT[];
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS pass_rate INTEGER DEFAULT 0;

-- Create assessment questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB,
  correct_answer TEXT,
  points INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create candidate_assessments table for tracking assignments
CREATE TABLE IF NOT EXISTS candidate_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'assigned',
  score INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create interview_schedule table
CREATE TABLE IF NOT EXISTS interview_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  interviewer_email TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  calendar_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hr_settings table for configuration
CREATE TABLE IF NOT EXISTS hr_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create role_thresholds table with unique constraint on role_name
CREATE TABLE IF NOT EXISTS role_thresholds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_name TEXT UNIQUE NOT NULL,
  min_ats_score INTEGER NOT NULL,
  max_ats_score INTEGER NOT NULL,
  min_assessment_score INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_thresholds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow all operations on candidates" ON candidates;
DROP POLICY IF EXISTS "Allow all operations on assessments" ON assessments;
DROP POLICY IF EXISTS "Allow all operations on assessment_questions" ON assessment_questions;
DROP POLICY IF EXISTS "Allow all operations on candidate_assessments" ON candidate_assessments;
DROP POLICY IF EXISTS "Allow all operations on interview_schedule" ON interview_schedule;
DROP POLICY IF EXISTS "Allow all operations on hr_settings" ON hr_settings;
DROP POLICY IF EXISTS "Allow all operations on role_thresholds" ON role_thresholds;

-- Create policies (allow all for now - you can make them more restrictive later)
CREATE POLICY "Allow all operations on candidates" ON candidates FOR ALL USING (true);
CREATE POLICY "Allow all operations on assessments" ON assessments FOR ALL USING (true);
CREATE POLICY "Allow all operations on assessment_questions" ON assessment_questions FOR ALL USING (true);
CREATE POLICY "Allow all operations on candidate_assessments" ON candidate_assessments FOR ALL USING (true);
CREATE POLICY "Allow all operations on interview_schedule" ON interview_schedule FOR ALL USING (true);
CREATE POLICY "Allow all operations on hr_settings" ON hr_settings FOR ALL USING (true);
CREATE POLICY "Allow all operations on role_thresholds" ON role_thresholds FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_ai_score ON candidates(ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_assessment_status ON candidates(assessment_status);
CREATE INDEX IF NOT EXISTS idx_candidate_assessments_status ON candidate_assessments(status);
CREATE INDEX IF NOT EXISTS idx_interview_schedule_status ON interview_schedule(status);

-- Insert default role thresholds (now with UNIQUE constraint on role_name)
INSERT INTO role_thresholds (role_name, min_ats_score, max_ats_score, min_assessment_score) 
VALUES 
  ('Software Developer', 65, 85, 70),
  ('Java Developer', 65, 80, 70),
  ('Frontend Developer', 60, 80, 65),
  ('Backend Developer', 70, 85, 75),
  ('Data Scientist', 75, 90, 80)
ON CONFLICT (role_name) DO NOTHING;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_candidates_updated_at ON candidates;
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_interview_schedule_updated_at ON interview_schedule;
CREATE TRIGGER update_interview_schedule_updated_at BEFORE UPDATE ON interview_schedule
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hr_settings_updated_at ON hr_settings;
CREATE TRIGGER update_hr_settings_updated_at BEFORE UPDATE ON hr_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_role_thresholds_updated_at ON role_thresholds;
CREATE TRIGGER update_role_thresholds_updated_at BEFORE UPDATE ON role_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
