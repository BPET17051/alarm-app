-- Create audio_files table to store metadata
CREATE TABLE IF NOT EXISTS audio_files (
  id TEXT PRIMARY KEY,  -- Storage filename (timestamp-based)
  display_name TEXT NOT NULL,  -- User-friendly name
  original_name TEXT,  -- Original uploaded filename
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;

-- Allow public access (same as alarms table)
DROP POLICY IF EXISTS "Enable all access for all users" ON audio_files;
CREATE POLICY "Enable all access for all users" ON audio_files FOR ALL USING (true) WITH CHECK (true);
