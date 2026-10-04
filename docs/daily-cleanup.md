# Daily cleanup

Enabled on the SIMSETAlarm_web Supabase project on 2026-10-04.

The `alarm-daily-channel-cleanup` database cron job calls
`public.cleanup_daily_channels()` every minute. It runs independently of
the Render backend, including while the backend sleeps.

- Remove alarms whose `created_at` is before today's midnight in Asia/Bangkok.
- Remove channels created before today only when no alarms remain and the
  channel lease is absent or expired.
- Keep channels created today, active leases, and current or future alarms.
- Lock each channel using the same row lock as lease acquisition. Skip rows
  held by another transaction and retry on the next scheduled run.
- Do not change templates or audio files.

This supersedes the earlier channel-lock spec's decision to omit scheduled
cleanup. The user explicitly selected old-alarm cleanup plus deletion of old,
empty, unused rooms. The first production run removed 135 alarms and 5 channels.

Migration: `supabase/migrations/20261004095006_daily_channel_cleanup.sql`.
Regression test: run `backend/tests/daily-cleanup.sql` using the SQL editor or
Supabase SQL tool. The test uses a transaction and rolls back all changes.

Inspect scheduling and recent execution:

```sql
select jobname, schedule, active from cron.job
where jobname = 'alarm-daily-channel-cleanup';

select status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'alarm-daily-channel-cleanup')
order by start_time desc limit 5;
```

To disable future automatic cleanup:

```sql
select cron.unschedule('alarm-daily-channel-cleanup');
```

The backend's manual-delete fix is built and locally tested, but has not been
deployed to Render. Database cleanup is already active in production.
