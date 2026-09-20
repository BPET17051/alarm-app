-- Rollback for supabase/migrations/20260918052815_channel_lock.sql
-- Not part of the applied migration history (Supabase CLI has no down-migrations).
-- Run manually via the Dashboard SQL Editor only if the channel-lock migration
-- needs to be fully reverted. Safe to run even if some objects were already
-- removed (every drop is guarded).

begin;

revoke execute on function public.acquire_channel_lock(uuid, text) from service_role;
drop function if exists public.acquire_channel_lock(uuid, text);

alter table public.alarms drop constraint if exists alarms_channel_id_fkey;
drop index if exists alarms_channel_id_idx;
alter table public.alarms alter column channel_id drop default;
alter table public.alarms alter column channel_id drop not null;
alter table public.alarms drop column if exists channel_id;

drop index if exists channels_name_unique_ci;
drop table if exists public.channels;

-- restore the original permissive policies
drop policy if exists "Enable all access for all users" on public.alarms;
create policy "Enable all access for all users" on public.alarms for all using (true) with check (true);

drop policy if exists "Enable all access for all users" on public.templates;
create policy "Enable all access for all users" on public.templates for all using (true) with check (true);

-- restore the original table-level grants the migration revoked
grant select, insert, update, delete on table public.alarms, public.templates to anon, authenticated;

commit;
