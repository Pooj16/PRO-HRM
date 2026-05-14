-- Enable real-time for remaining interview tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_schedule;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_users;
