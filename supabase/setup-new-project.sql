-- Create candidates table
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  applied_role TEXT NOT NULL,
  experience TEXT DEFAULT 'Not Specified',
  location TEXT DEFAULT 'Not Specified',
  skills TEXT[] DEFAULT '{}',
  resume_url TEXT,
  resume_text TEXT,
  status TEXT DEFAULT 'uploaded',
  assessment_status TEXT DEFAULT 'pending',
  ats_score INTEGER DEFAULT 0,
  match_percentage INTEGER DEFAULT 0,
  ats_notes TEXT,
  applied_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Create policies that allow public access (no RLS restrictions)
CREATE POLICY "Allow all to view candidates" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Allow all to insert candidates" ON public.candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all to update candidates" ON public.candidates FOR UPDATE USING (true);

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT DO NOTHING;

-- Create storage policies for resumes bucket
CREATE POLICY "Allow public upload to resumes" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Allow public read resumes" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'resumes');

CREATE POLICY "Allow public delete resumes" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'resumes');

CREATE POLICY "Allow public update resumes" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'resumes');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_candidates_email ON public.candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON public.candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON public.candidates(created_at DESC);
