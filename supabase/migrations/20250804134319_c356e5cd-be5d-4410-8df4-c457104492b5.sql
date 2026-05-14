-- Add missing ai_analysis column to candidates table
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS ai_analysis jsonb DEFAULT '{}'::jsonb;

-- Update any candidates with null ai_analysis to empty object
UPDATE public.candidates 
SET ai_analysis = '{}'::jsonb 
WHERE ai_analysis IS NULL;