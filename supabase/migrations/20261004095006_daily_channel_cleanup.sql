begin;

create or replace function public.cleanup_daily_channels()
returns table (alarms_deleted bigint, channels_deleted bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  boundary timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  channel public.channels%rowtype;
  affected bigint;
begin
  alarms_deleted := 0;
  channels_deleted := 0;
  -- Share the channel row lock used by acquire_channel_lock. Busy transactions retry next minute.
  for channel in
    select c.* from public.channels c
    where c.created_at < boundary
       or exists (select 1 from public.alarms a where a.channel_id=c.id and a.created_at < boundary)
    order by c.id
    for update of c skip locked
  loop
    delete from public.alarms where channel_id=channel.id and created_at < boundary;
    get diagnostics affected = row_count;
    alarms_deleted := alarms_deleted + affected;

    if channel.created_at < boundary
       and (channel.lock_expires_at is null or channel.lock_expires_at <= now()) then
      delete from public.channels c where c.id=channel.id
        and not exists (select 1 from public.alarms a where a.channel_id=c.id);
      get diagnostics affected = row_count;
      channels_deleted := channels_deleted + affected;
    end if;
  end loop;
  return next;
end;
$$;

revoke execute on function public.cleanup_daily_channels() from public, anon, authenticated;
grant execute on function public.cleanup_daily_channels() to service_role;

create extension if not exists pg_cron;
select cron.schedule('alarm-daily-channel-cleanup', '* * * * *', 'select public.cleanup_daily_channels();');

commit;
