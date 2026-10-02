-- 0003: water tracking, and food logged by searching for it.

-- water_entries ---------------------------------------------------------
-- Same shape as the other daily metrics in 0001: one row per user per day, holding the day's
-- running total, upserted on (user_id, date).

create table water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  ml integer not null check (ml >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table water_entries enable row level security;
create policy "water_entries: owner select" on water_entries for select using (auth.uid() = user_id);
create policy "water_entries: owner insert" on water_entries for insert with check (auth.uid() = user_id);
create policy "water_entries: owner update" on water_entries for update using (auth.uid() = user_id);
create policy "water_entries: owner delete" on water_entries for delete using (auth.uid() = user_id);

create trigger water_entries_set_updated_at before update on water_entries
  for each row execute function set_updated_at();

create index water_entries_user_id_idx on water_entries (user_id);

-- food_entries.source -----------------------------------------------------
-- Foods picked from search results (the built-in staples or an Open Food Facts text search) are
-- recorded as 'search', alongside the existing 'manual' and 'barcode'. Without widening the
-- check, every such entry would be rejected by the server and block the sync queue behind it.

alter table food_entries drop constraint food_entries_source_check;
alter table food_entries add constraint food_entries_source_check
  check (source in ('manual', 'barcode', 'search'));
