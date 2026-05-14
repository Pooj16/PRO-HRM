
-- Create candidates table
CREATE TABLE candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  position TEXT NOT NULL,
  experience TEXT,
  skills TEXT[], -- Array of skills
  education TEXT,
  location TEXT,
  salary_expectation INTEGER,
  resume_text TEXT, -- Full resume text for AI processing
  ai_score INTEGER DEFAULT 0,
  match_percentage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  assessment_status TEXT DEFAULT 'pending',
  applied_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assessments table
CREATE TABLE assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER, -- in minutes
  questions_count INTEGER DEFAULT 0,
  type TEXT NOT NULL, -- 'technical', 'leadership', 'creative'
  difficulty TEXT NOT NULL, -- 'beginner', 'intermediate', 'advanced', 'expert'
  required_skills TEXT[],
  pass_rate INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assessment_questions table
CREATE TABLE assessment_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'multiple_choice', 'coding', 'essay'
  options JSONB, -- For multiple choice questions
  correct_answer TEXT,
  points INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create candidate_assessments table (junction table)
CREATE TABLE candidate_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'assigned', -- 'assigned', 'in_progress', 'completed'
  score INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create filter_criteria table
CREATE TABLE filter_criteria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  experience_min TEXT,
  required_skills TEXT[],
  education_level TEXT,
  location_preference TEXT,
  salary_min INTEGER,
  job_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_criteria ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - adjust based on your auth requirements)
CREATE POLICY "Allow all operations on candidates" ON candidates FOR ALL USING (true);
CREATE POLICY "Allow all operations on assessments" ON assessments FOR ALL USING (true);
CREATE POLICY "Allow all operations on assessment_questions" ON assessment_questions FOR ALL USING (true);
CREATE POLICY "Allow all operations on candidate_assessments" ON candidate_assessments FOR ALL USING (true);
CREATE POLICY "Allow all operations on filter_criteria" ON filter_criteria FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_ai_score ON candidates(ai_score DESC);
CREATE INDEX idx_candidates_match_percentage ON candidates(match_percentage DESC);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_candidate_assessments_status ON candidate_assessments(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_filter_criteria_updated_at BEFORE UPDATE ON filter_criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
