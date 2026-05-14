
-- Revert back to using Gemini API key instead of OpenAI
ALTER TABLE public.hr_users 
DROP COLUMN IF EXISTS openai_api_key,
ADD COLUMN gemini_api_key TEXT;

-- Update company_settings table to use Gemini API key instead of OpenAI  
ALTER TABLE public.company_settings
DROP COLUMN IF EXISTS openai_api_key,
ADD COLUMN gemini_api_key TEXT;
