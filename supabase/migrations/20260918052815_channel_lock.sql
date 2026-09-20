begin;

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lock_token text,
  lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint channels_lock_pair check (
    (lock_token is null) = (lock_expires_at is null)
  )
);

create unique index channels_name_unique_ci
  on public.channels (lower(trim(name)));

insert into public.channels (name) values ('General');

alter table public.alarms add column channel_id uuid;
update public.alarms
set channel_id = (select id from public.channels where name = 'General')
where channel_id is null;
do $$
declare
  v_general_id uuid;
begin
  select id into v_general_id from public.channels where name = 'General';
  execute format(
    'alter table public.alarms alter column channel_id set default %L::uuid',
    v_general_id
  );
end;
$$;
alter table public.alarms alter column channel_id set not null;
alter table public.alarms add constraint alarms_channel_id_fkey
  foreign key (channel_id) references public.channels(id) on delete restrict;
create index alarms_channel_id_idx on public.alarms(channel_id);

create or replace function public.acquire_channel_lock(
  p_channel_id uuid,
  p_token text
) returns table (ok boolean, expires_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_channel public.channels%rowtype;
  v_expires_at timestamptz;
begin
  select * into v_channel
  from public.channels
  where id = p_channel_id
  for update;

  if v_channel.id is null then
    return query select false, null::timestamptz;
    return;
  end if;

  if v_channel.lock_token is null
     or v_channel.lock_expires_at < now()
     or v_channel.lock_token = p_token then
    update public.channels
    set lock_token = p_token,
        lock_expires_at = now() + interval '30 seconds'
    where id = p_channel_id
    returning lock_expires_at into v_expires_at;
    return query select true, v_expires_at;
    return;
  end if;

  return query select false, null::timestamptz;
end;
$$;

revoke all on table public.channels, public.alarms, public.templates
  from anon, authenticated;
alter table public.channels enable row level security;
drop policy if exists "Enable all access for all users" on public.alarms;
drop policy if exists "Enable all access for all users" on public.templates;
revoke execute on function public.acquire_channel_lock(uuid, text)
  from public, anon, authenticated;
grant select, insert, update, delete on table public.channels, public.alarms, public.templates
  to service_role;
grant execute on function public.acquire_channel_lock(uuid, text)
  to service_role;

commit;
