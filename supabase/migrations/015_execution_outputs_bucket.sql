-- Storage bucket for code execution output files (CSV, PDF, images, etc.)
-- Uploaded by the VPS docker-executor after sandbox runs complete.

INSERT INTO storage.buckets (id, name, public)
VALUES ('execution-outputs', 'execution-outputs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload execution output files
CREATE POLICY "Authenticated users can upload execution outputs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'execution-outputs');

-- Allow service role to upload (VPS executor uses service role key)
CREATE POLICY "Service role can upload execution outputs"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'execution-outputs');

-- Allow public read access to execution output files
CREATE POLICY "Public read access for execution outputs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'execution-outputs');
