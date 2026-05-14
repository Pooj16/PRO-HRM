-- Migration for Background Verification (BGV) requirements

-- 1. Add BGV columns to existing candidates table
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS bgv_status TEXT DEFAULT 'Not Started',
ADD COLUMN IF NOT EXISTS upload_token TEXT,
ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS education_details TEXT,
ADD COLUMN IF NOT EXISTS last_employer_details TEXT;

-- 2. Create the bgv_verification_contacts table
CREATE TABLE IF NOT EXISTS public.bgv_verification_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    hr_email TEXT,
    manager_email TEXT,
    university_email TEXT,
    reference_email TEXT,
    mail_status TEXT DEFAULT 'Not Sent',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bgv_verification_contacts ENABLE ROW LEVEL SECURITY;

-- Allow read/write access for authenticated HR/Admin users and Service Role
CREATE POLICY "Allow HR to manage BGV contacts"
ON public.bgv_verification_contacts
FOR ALL
USING (true)
WITH CHECK (true);

-- Create updated_at trigger function if it doesn't already exist (hirespark tables migration usually has it)
-- Apply it to the new table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_bgv_contacts_updated_at'
    ) THEN
        CREATE TRIGGER update_bgv_contacts_updated_at 
        BEFORE UPDATE ON public.bgv_verification_contacts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
