-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'team_lead');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  applied_role TEXT NOT NULL,
  experience TEXT,
  location TEXT,
  skills TEXT[],
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

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view candidates"
  ON public.candidates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert candidates"
  ON public.candidates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update candidates"
  ON public.candidates FOR UPDATE
  TO authenticated
  USING (true);

-- Create assessments table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assessments"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage assessments"
  ON public.assessments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Create assessment_questions table
CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  points INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view questions"
  ON public.assessment_questions FOR SELECT
  TO authenticated
  USING (true);

-- Create assessment_assignments table
CREATE TABLE public.assessment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'assigned',
  score INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (candidate_id, assessment_id)
);

ALTER TABLE public.assessment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignments"
  ON public.assessment_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage assignments"
  ON public.assessment_assignments FOR ALL
  TO authenticated
  USING (true);

-- Create interview_schedule table
CREATE TABLE public.interview_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  interview_date TIMESTAMPTZ NOT NULL,
  interview_type TEXT NOT NULL,
  interviewer TEXT,
  status TEXT DEFAULT 'scheduled',
  meeting_link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view interviews"
  ON public.interview_schedule FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage interviews"
  ON public.interview_schedule FOR ALL
  TO authenticated
  USING (true);

-- Create team_leads table
CREATE TABLE public.team_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.team_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view team leads"
  ON public.team_leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage team leads"
  ON public.team_leads FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Create candidate_assignments table
CREATE TABLE public.candidate_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  team_lead_id UUID REFERENCES public.team_leads(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  review_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (candidate_id, team_lead_id)
);

ALTER TABLE public.candidate_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignments"
  ON public.candidate_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage assignments"
  ON public.candidate_assignments FOR ALL
  TO authenticated
  USING (true);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Create hr_settings table
CREATE TABLE public.hr_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hr_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings"
  ON public.hr_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage settings"
  ON public.hr_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Create role_thresholds table
CREATE TABLE public.role_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  min_score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.role_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view thresholds"
  ON public.role_thresholds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage thresholds"
  ON public.role_thresholds FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Create google_form_responses table
CREATE TABLE public.google_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.google_form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view responses"
  ON public.google_form_responses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert responses"
  ON public.google_form_responses FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create hr_users table
CREATE TABLE public.hr_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  gemini_api_key TEXT,
  openai_api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hr_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR users can view their own data"
  ON public.hr_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage hr users"
  ON public.hr_users FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for candidates table
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;