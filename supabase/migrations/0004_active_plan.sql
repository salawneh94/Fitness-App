-- 0004: which plan the user is following, and since when.
--
-- Lives on the profile row (which already syncs) rather than in a table of its own: it's one
-- value per user, read and written with the profile, and it's what lets the Plans tab say
-- "week 3 of Upper / Lower" instead of only listing templates.
--
-- Deploy order matters: the app writes these columns on every profile save, so this must be
-- applied before (or with) the app version that sends them — otherwise each profile write fails
-- and, since the sync queue stops at its first failure, blocks every write behind it.

alter table profiles
  add column plan_template_id text,
  add column plan_started_on date;

-- Both or neither: a template with no start date can't produce a week number, and a start date
-- with no template means nothing.
alter table profiles add constraint profiles_active_plan_complete
  check ((plan_template_id is null) = (plan_started_on is null));
