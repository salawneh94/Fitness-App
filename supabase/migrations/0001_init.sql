-- FitTrack core schema: one table per local data type, all owned by auth.uid(),
-- all readable/writable only by their owner via RLS. subscription_status is the
-- one exception — clients get read-only access; only a service-role webhook
-- (added in M5) can write to it, so a client can never grant itself an
-- entitlement.

create extension if not exists "pgcrypto";

-- Every syncable table gets an `updated_at` that this trigger keeps current,
-- so the client's last-write-wins merge always has something to compare against.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- profiles ---------------------------------------------------------------
-- One row per user, keyed by their auth id directly (not a separate uuid).

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  age integer not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  height_cm numeric not null,
  weight_kg numeric not null,
  goal text not null check (goal in ('lose_fat', 'maintain', 'build_muscle', 'improve_endurance', 'general_health')),
  target_weight_kg numeric,
  timeframe_weeks integer not null,
  expectations text not null default '',
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  preferred_days_per_week integer not null,
  unit_system text not null check (unit_system in ('metric', 'imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: owner select" on profiles for select using (auth.uid() = id);
create policy "profiles: owner insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles: owner update" on profiles for update using (auth.uid() = id);
create policy "profiles: owner delete" on profiles for delete using (auth.uid() = id);

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- daily metric history -----------------------------------------------------
-- weight/steps/sleep are all "one entry per user per day", upserted by date.

create table weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table steps_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  steps integer not null,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table sleep_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  hours numeric not null,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  waist_cm numeric,
  chest_cm numeric,
  arms_cm numeric,
  hips_cm numeric,
  thighs_cm numeric,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- food & meals --------------------------------------------------------------
-- food_entries keeps the client-generated id as its primary key (so a device
-- can write it offline and reconcile later without a server round-trip for
-- an id). saved_meal items are stored as JSONB on the parent row — they're
-- always read/written together with their meal, so a separate child table
-- would only add sync-ordering complexity for no real benefit here.

create table food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  brand text,
  quantity numeric not null,
  serving_label text,
  calories numeric not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  micros jsonb,
  source text not null check (source in ('manual', 'barcode')),
  barcode text,
  logged_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table saved_meals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- workouts --------------------------------------------------------------
-- scheduled_workouts: at most one per weekday per user, matching the app's
-- single weekly-schedule-slot-per-day model. exercises stored as JSONB since
-- they're always read/written as a whole list per scheduled day.

create table scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day text not null check (day in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
  name text not null,
  exercises jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create table workout_logs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  workout_name text not null,
  duration_min integer not null,
  calories_burned integer,
  notes text,
  exercise_logs jsonb,
  updated_at timestamptz not null default now()
);

-- progress photos --------------------------------------------------------
-- storage_path is filled in by M4 (Supabase Storage migration); until then
-- rows sync metadata only and photos stay device-local.

create table progress_photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  note text,
  storage_path text,
  updated_at timestamptz not null default now()
);

-- subscription entitlement (M5) ------------------------------------------
-- Read-only for clients: no insert/update/delete policy is granted to the
-- authenticated role, so only the service-role webhook (bypasses RLS) can
-- write here. A client can request a trial or purchase, but can never grant
-- itself one by writing this row directly.

create table subscription_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entitlement_active boolean not null default false,
  product_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table subscription_status enable row level security;
create policy "subscription_status: owner select" on subscription_status for select using (auth.uid() = user_id);

-- Apply the same owner-only RLS shape (all four operations) to every
-- remaining per-user table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'weight_entries', 'steps_entries', 'sleep_entries', 'body_measurements',
    'food_entries', 'saved_meals', 'scheduled_workouts', 'workout_logs', 'progress_photos'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "%s: owner select" on %I for select using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s: owner insert" on %I for insert with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s: owner update" on %I for update using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s: owner delete" on %I for delete using (auth.uid() = user_id)', t, t);
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- Helpful indexes for the sync layer's per-user pulls.
create index weight_entries_user_id_idx on weight_entries (user_id);
create index steps_entries_user_id_idx on steps_entries (user_id);
create index sleep_entries_user_id_idx on sleep_entries (user_id);
create index body_measurements_user_id_idx on body_measurements (user_id);
create index food_entries_user_id_idx on food_entries (user_id);
create index saved_meals_user_id_idx on saved_meals (user_id);
create index scheduled_workouts_user_id_idx on scheduled_workouts (user_id);
create index workout_logs_user_id_idx on workout_logs (user_id);
create index progress_photos_user_id_idx on progress_photos (user_id);
