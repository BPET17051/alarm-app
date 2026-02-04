-- Allow deletion of objects in the 'audio' bucket
-- Run this in your Supabase SQL Editor

DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING ( bucket_id = 'audio' );
