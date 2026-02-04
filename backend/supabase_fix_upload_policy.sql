-- Allow updating (overwriting) objects in the 'audio' bucket
-- This is required because we use 'upsert: true' in the backend

DROP POLICY IF EXISTS "Public Update" ON storage.objects;
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING ( bucket_id = 'audio' );

-- Ensure Insert is also correct (just in case)
-- DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
-- CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'audio' );
