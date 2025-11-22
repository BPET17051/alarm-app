-- Create the alarms table if it doesn't exist
CREATE TABLE IF NOT EXISTS alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  h INTEGER NOT NULL,
  m INTEGER NOT NULL,
  s INTEGER DEFAULT 0,
  label TEXT,
  audio_id TEXT,
  audio_name TEXT,
  notify_status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  items_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the storage bucket for audio if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS (safe to run multiple times)
ALTER TABLE alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Re-create policies to ensure they are correct (drop first to avoid errors)
DROP POLICY IF EXISTS "Enable all access for all users" ON alarms;
CREATE POLICY "Enable all access for all users" ON alarms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON templates;
CREATE POLICY "Enable all access for all users" ON templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'audio' );

DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'audio' );
