-- 3. Create Storage Bucket for BGV Documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('bgv-documents', 'bgv-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage.objects
-- Allow anyone with the token to upload (we'll enforce token via edge function/api routes if necessary)
-- but for the SQL level, let's allow service role full access and authenticated users to read.
CREATE POLICY "Allow Service Role full access to bgv documents" 
ON storage.objects FOR ALL 
USING (bucket_id = 'bgv-documents') 
WITH CHECK (bucket_id = 'bgv-documents');

CREATE POLICY "Allow Candidates to Insert bgv documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'bgv-documents');

CREATE POLICY "Allow HR to read bgv documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'bgv-documents');
