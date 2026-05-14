
-- Add file storage for resumes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', false);

-- Create storage policies for resumes bucket
CREATE POLICY "Authenticated users can upload resumes" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view resumes" ON storage.objects
FOR SELECT USING (bucket_id = 'resumes' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update resumes" ON storage.objects
FOR UPDATE USING (bucket_id = 'resumes' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete resumes" ON storage.objects
FOR DELETE USING (bucket_id = 'resumes' AND auth.role() = 'authenticated');

-- Update candidates table to include resume file information
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_file_path TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_file_name TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_uploaded_at TIMESTAMPTZ;

-- Create hr_users table for HR staff profiles
CREATE TABLE IF NOT EXISTS hr_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'hr_staff',
  gemini_api_key TEXT,
  google_calendar_connected BOOLEAN DEFAULT false,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create filter_presets table for saving filter configurations
CREATE TABLE IF NOT EXISTS filter_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  min_experience_years INTEGER,
  required_skills TEXT[],
  education_levels TEXT[],
  location_preferences TEXT[],
  min_salary INTEGER,
  max_salary INTEGER,
  job_types TEXT[],
  min_ats_score INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES hr_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assessment_assignments table to track which assessments are assigned to which candidates
CREATE TABLE IF NOT EXISTS assessment_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES hr_users(id),
  status TEXT DEFAULT 'pending',
  score INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, assessment_id)
);

-- Create interview_bookings table for Google Calendar integration
CREATE TABLE IF NOT EXISTS scheduled_interviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  interviewer_email TEXT NOT NULL,
  job_role TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  meet_link TEXT,
  calendar_event_id TEXT,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE hr_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_interviews ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "HR users can manage their own data" ON hr_users
FOR ALL USING (true);

CREATE POLICY "Anyone can view filter presets" ON filter_presets
FOR SELECT USING (true);

CREATE POLICY "HR users can manage filter presets" ON filter_presets
FOR ALL USING (true);

CREATE POLICY "Anyone can view assessment assignments" ON assessment_assignments
FOR SELECT USING (true);

CREATE POLICY "HR users can manage assessment assignments" ON assessment_assignments
FOR ALL USING (true);

CREATE POLICY "Anyone can view scheduled interviews" ON scheduled_interviews
FOR SELECT USING (true);

CREATE POLICY "HR users can manage scheduled interviews" ON scheduled_interviews
FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_candidates_resume_file_path ON candidates(resume_file_path);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_candidate ON assessment_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_assessment ON assessment_assignments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_interviews_candidate ON scheduled_interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_interviews_start_time ON scheduled_interviews(start_time);

-- Create triggers for updated_at
CREATE TRIGGER update_hr_users_updated_at BEFORE UPDATE ON hr_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_filter_presets_updated_at BEFORE UPDATE ON filter_presets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_interviews_updated_at BEFORE UPDATE ON scheduled_interviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
