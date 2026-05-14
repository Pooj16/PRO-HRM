-- Add ai_analysis column to candidates table for storing detailed AI analysis
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS ai_analysis text;