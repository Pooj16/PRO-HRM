-- Add availability fields to hr_users to support automated interview scheduling
-- This allows HR to set a 3-day pattern and time for interviews.

-- 1. Add columns for availability
ALTER TABLE public.hr_users 
ADD COLUMN IF NOT EXISTS availability_days TEXT[] DEFAULT ARRAY['Monday', 'Wednesday', 'Friday'],
ADD COLUMN IF NOT EXISTS availability_time TIME DEFAULT '10:00:00';

-- 2. Add comment for clarity
COMMENT ON COLUMN public.hr_users.availability_days IS 'The days of the week when the HR user is available for interviews';
COMMENT ON COLUMN public.hr_users.availability_time IS 'The standard time slot for interviews on the available days';

-- 3. Ensure replication is enabled for this table (if not already)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_users;
