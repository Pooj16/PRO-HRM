-- Refine HR availability to specific dates and time ranges
-- instead of weekly recurring days.

-- 1. Add new columns for specific dates and time ranges
ALTER TABLE public.hr_users 
ADD COLUMN IF NOT EXISTS availability_dates DATE[] DEFAULT ARRAY[]::DATE[],
ADD COLUMN IF NOT EXISTS availability_start_time TIME DEFAULT '10:00:00',
ADD COLUMN IF NOT EXISTS availability_end_time TIME DEFAULT '17:00:00';

-- 2. Update comments
COMMENT ON COLUMN public.hr_users.availability_dates IS 'Specific calendar dates selected by the HR for interviews';
COMMENT ON COLUMN public.hr_users.availability_start_time IS 'Start of the feasible interview window';
COMMENT ON COLUMN public.hr_users.availability_end_time IS 'End of the feasible interview window';

-- 3. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
