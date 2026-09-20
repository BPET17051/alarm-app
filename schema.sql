-- Create the alarms table if it doesn't exist
CREATE TABLE IF NOT EXISTS alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_key TEXT NOT NULL DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD'),
  h INTEGER NOT NULL,
  m INTEGER NOT NULL,
  s INTEGER DEFAULT 0,
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

-- Create the channels table (user-managed alarm channels with a renewable lease lock)
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lock_token TEXT,
  lock_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT channels_lock_pair CHECK (
    (lock_token IS NULL) = (lock_expires_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS channels_name_unique_ci
  ON public.channels (lower(trim(name)));

INSERT INTO public.channels (name)
SELECT 'General'
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE lower(trim(name)) = 'general');

-- Scope alarms to a channel; defaults to General so a not-yet-updated backend still works
ALTER TABLE public.alarms ADD COLUMN IF NOT EXISTS channel_id UUID;

DO $$
DECLARE
  v_general_id uuid;
BEGIN
  SELECT id INTO v_general_id FROM public.channels WHERE lower(trim(name)) = 'general';

  UPDATE public.alarms SET channel_id = v_general_id WHERE channel_id IS NULL;

  EXECUTE format(
    'ALTER TABLE public.alarms ALTER COLUMN channel_id SET DEFAULT %L::uuid',
    v_general_id
  );
END;
$$;

ALTER TABLE public.alarms ALTER COLUMN channel_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alarms_channel_id_fkey'
  ) THEN
    ALTER TABLE public.alarms ADD CONSTRAINT alarms_channel_id_fkey
      FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS alarms_channel_id_idx ON public.alarms(channel_id);

-- Atomic acquire/renew for the channel lease; the only supported way to take or extend a lock
CREATE OR REPLACE FUNCTION public.acquire_channel_lock(
  p_channel_id uuid,
  p_token text
) RETURNS TABLE (ok boolean, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_channel public.channels%rowtype;
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v_channel
  FROM public.channels
  WHERE id = p_channel_id
  FOR UPDATE;

  IF v_channel.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_channel.lock_token IS NULL
     OR v_channel.lock_expires_at < now()
     OR v_channel.lock_token = p_token THEN
    UPDATE public.channels
    SET lock_token = p_token,
        lock_expires_at = now() + interval '30 seconds'
    WHERE id = p_channel_id
    RETURNING lock_expires_at INTO v_expires_at;
    RETURN QUERY SELECT true, v_expires_at;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, NULL::timestamptz;
END;
$$;

-- Create the storage bucket for audio if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS (safe to run multiple times)
ALTER TABLE alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- Alarms and templates are no longer publicly writable: only the backend (via the
-- Supabase secret key, which bypasses RLS) may read/write them. `channels` never
-- gets a public policy either. This closes the gap where anyone holding the
-- anon/publishable key could bypass Express and the lease entirely.
DROP POLICY IF EXISTS "Enable all access for all users" ON alarms;
DROP POLICY IF EXISTS "Enable all access for all users" ON templates;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'audio' );

DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'audio' );

REVOKE ALL ON TABLE public.channels, public.alarms, public.templates FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acquire_channel_lock(uuid, text) FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.channels, public.alarms, public.templates TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_channel_lock(uuid, text) TO service_role;
