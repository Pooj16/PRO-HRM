-- Create audit_logs table for tracking all changes
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'candidate', 'assignment', 'assessment', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'status_change', 'assignment', 'review', etc.
  old_value JSONB,
  new_value JSONB,
  changed_by UUID, -- user_id who made the change
  changed_by_role TEXT, -- 'hr', 'team_lead', 'system', 'ai'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view audit logs
CREATE POLICY "Authenticated users can view audit logs"
ON public.audit_logs
FOR SELECT
USING (true);

-- Create policy for authenticated users to insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Add pipeline_status column to candidates for explicit pipeline tracking
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS pipeline_status TEXT DEFAULT 'applied';

-- Add assigned_team_lead_id column to candidates for role-based ownership
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS assigned_team_lead_id UUID REFERENCES public.team_leads(id);

-- Add review_notes column to candidates for mandatory review notes
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Add last_status_change_at column to candidates
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add last_status_changed_by column to candidates
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS last_status_changed_by UUID;

-- Add last_status_changed_by_role column to candidates
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS last_status_changed_by_role TEXT;

-- Create employees table if not exists for candidate conversion
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES public.candidates(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  role TEXT NOT NULL,
  start_date DATE,
  salary NUMERIC,
  manager_id UUID REFERENCES public.team_leads(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create policies for employees table
CREATE POLICY "Authenticated users can view employees"
ON public.employees
FOR SELECT
USING (true);

CREATE POLICY "HR can manage employees"
ON public.employees
FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'));

-- Create trigger to update updated_at on employees
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();