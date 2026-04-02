ALTER TABLE alarms
ADD COLUMN IF NOT EXISTS day_key TEXT;

UPDATE alarms
SET day_key = to_char((COALESCE(created_at, NOW()) AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD')
WHERE day_key IS NULL;

ALTER TABLE alarms
ALTER COLUMN day_key SET NOT NULL;

ALTER TABLE alarms
ALTER COLUMN day_key SET DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD');

ALTER TABLE alarms
DROP COLUMN IF EXISTS label;
