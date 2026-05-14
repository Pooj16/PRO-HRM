-- Update hr_users table to use OpenAI API key instead of Gemini
ALTER TABLE public.hr_users 
DROP COLUMN IF EXISTS gemini_api_key,
ADD COLUMN openai_api_key TEXT;

-- Update company_settings table to use OpenAI API key instead of Gemini  
ALTER TABLE public.company_settings
DROP COLUMN IF EXISTS gemini_api_key,
ADD COLUMN openai_api_key TEXT;