ALTER TABLE audio_files
ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE audio_files
ADD COLUMN IF NOT EXISTS original_name TEXT;

UPDATE audio_files
SET display_name = LEFT(
  REGEXP_REPLACE(
    COALESCE(NULLIF(original_name, ''), id),
    '\.(mp3|wav|ogg|aac|m4a|flac)$',
    '',
    'i'
  ),
  40
)
WHERE display_name IS NULL OR BTRIM(display_name) = '';

ALTER TABLE audio_files
ALTER COLUMN display_name SET NOT NULL;

UPDATE alarms AS a
SET audio_name = af.display_name
FROM audio_files AS af
WHERE a.audio_id = af.id
  AND (
    a.audio_name IS NULL
    OR BTRIM(a.audio_name) = ''
    OR a.audio_name ~* '\.(mp3|wav|ogg|aac|m4a|flac)$'
  );
