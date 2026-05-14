
-- Create team_leads table first
CREATE TABLE public.team_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role_specializations TEXT[] NOT NULL DEFAULT '{}',
  department TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create google_form_responses table
CREATE TABLE public.google_form_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_response_id TEXT UNIQUE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  role_applied_for TEXT NOT NULL,
  resume_file_url TEXT,
  additional_info JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'submitted',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create candidate_assignments table
CREATE TABLE public.candidate_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  team_lead_id UUID REFERENCES public.team_leads(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.hr_users(id),
  status TEXT NOT NULL DEFAULT 'assigned',
  notes TEXT,
  review_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_candidate_id UUID REFERENCES public.candidates(id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Now add the new columns to role_thresholds
ALTER TABLE public.role_thresholds 
ADD COLUMN auto_shortlist BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN team_lead_id UUID REFERENCES public.team_leads(id);

-- Insert sample team leads data
INSERT INTO public.team_leads (name, email, role_specializations, department) VALUES
  ('John Smith', 'john.smith@company.com', ARRAY['Frontend Developer', 'React Developer'], 'Engineering'),
  ('Sarah Johnson', 'sarah.johnson@company.com', ARRAY['Backend Developer', 'Node.js Developer'], 'Engineering'),
  ('Mike Chen', 'mike.chen@company.com', ARRAY['Data Scientist', 'ML Engineer'], 'Data Science'),
  ('Lisa Rodriguez', 'lisa.rodriguez@company.com', ARRAY['DevOps Engineer', 'Cloud Architect'], 'Infrastructure'),
  ('David Kumar', 'david.kumar@company.com', ARRAY['Product Manager', 'Business Analyst'], 'Product');

-- Update existing role thresholds with team lead assignments
UPDATE public.role_thresholds 
SET team_lead_id = tl.id, auto_shortlist = true
FROM public.team_leads tl 
WHERE role_thresholds.role_name = 'Frontend Developer' 
AND tl.email = 'john.smith@company.com';

UPDATE public.role_thresholds 
SET team_lead_id = tl.id, auto_shortlist = true
FROM public.team_leads tl 
WHERE role_thresholds.role_name = 'Backend Developer' 
AND tl.email = 'sarah.johnson@company.com';

UPDATE public.role_thresholds 
SET team_lead_id = tl.id, auto_shortlist = true
FROM public.team_leads tl 
WHERE role_thresholds.role_name = 'Data Scientist' 
AND tl.email = 'mike.chen@company.com';

UPDATE public.role_thresholds 
SET team_lead_id = tl.id, auto_shortlist = true
FROM public.team_leads tl 
WHERE role_thresholds.role_name = 'DevOps Engineer' 
AND tl.email = 'lisa.rodriguez@company.com';

UPDATE public.role_thresholds 
SET team_lead_id = tl.id, auto_shortlist = true
FROM public.team_leads tl 
WHERE role_thresholds.role_name = 'Product Manager' 
AND tl.email = 'david.kumar@company.com';

-- Add triggers
CREATE TRIGGER update_team_leads_updated_at
  BEFORE UPDATE ON public.team_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_form_responses_updated_at
  BEFORE UPDATE ON public.google_form_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidate_assignments_updated_at
  BEFORE UPDATE ON public.candidate_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE public.team_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view team leads" 
  ON public.team_leads 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "HR users can manage form responses" 
  ON public.google_form_responses 
  FOR ALL 
  TO authenticated 
  USING (true);

CREATE POLICY "Users can view relevant assignments" 
  ON public.candidate_assignments 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "HR users can manage assignments" 
  ON public.candidate_assignments 
  FOR ALL 
  TO authenticated 
  USING (true);

CREATE POLICY "Users can view their notifications" 
  ON public.notifications 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "System can create notifications" 
  ON public.notifications 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
