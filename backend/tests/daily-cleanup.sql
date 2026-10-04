-- Run in the linked database; all fixture and cleanup changes are rolled back.
begin;
do $$
declare
  boundary timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  old_empty uuid;
  active uuid;
  today uuid;
  with_current uuid;
  expired uuid;
  suffix text := gen_random_uuid()::text;
begin
  insert into public.channels(name, created_at) values ('cleanup-old-' || suffix, boundary - interval '1 day') returning id into old_empty;
  insert into public.channels(name, created_at, lock_token, lock_expires_at)
    values ('cleanup-active-' || suffix, boundary - interval '1 day', suffix, now() + interval '1 hour') returning id into active;
  insert into public.channels(name, created_at) values ('cleanup-today-' || suffix, boundary) returning id into today;
  insert into public.channels(name, created_at) values ('cleanup-current-' || suffix, boundary - interval '1 day') returning id into with_current;
  insert into public.channels(name, created_at, lock_token, lock_expires_at)
    values ('cleanup-expired-' || suffix, boundary - interval '1 day', suffix, now() - interval '1 second') returning id into expired;
  insert into public.alarms(channel_id,h,m,created_at)
    values (old_empty,9,0,boundary - interval '1 millisecond'),
           (active,9,0,boundary - interval '1 day'),
           (with_current,9,0,boundary),
           (with_current,10,0,boundary + interval '1 day');
  perform public.cleanup_daily_channels();
  if exists(select 1 from public.channels where id in (old_empty,expired)) then
    raise exception 'Old idle channels must be removed';
  end if;
  if (select count(*) from public.channels where id in (active,today,with_current)) <> 3 then
    raise exception 'Active, new and populated channels must survive';
  end if;
  if exists(select 1 from public.alarms where channel_id in (old_empty,active)) then
    raise exception 'Historical alarms must be removed';
  end if;
  if (select count(*) from public.alarms where channel_id=with_current) <> 2 then
    raise exception 'Midnight and future alarms must survive';
  end if;
  perform public.cleanup_daily_channels();
  if (select count(*) from public.channels where id in (active,today,with_current)) <> 3 then
    raise exception 'Repeated cleanup must preserve eligible survivors';
  end if;
end;
$$;
rollback;
