-- Allow unauthenticated users to insert candidates from career page
-- This enables public career form submissions

CREATE POLICY "Allow unauthenticated users to insert candidates"
  ON public.candidates FOR INSERT
  TO anon
  WITH CHECK (true);

-- Also ensure unauthenticated users can view candidates (for career page)
CREATE POLICY "Allow unauthenticated users to view candidates"
  ON public.candidates FOR SELECT
  TO anon
  USING (true);
