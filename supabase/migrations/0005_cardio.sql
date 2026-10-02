-- 0005: distance and pace for cardio sessions.
--
-- A JSONB list on the workout log rather than a table: a session's cardio is always read and
-- written with the session (like exercise_logs), and one session can hold more than one piece —
-- a run and a cool-down walk. Each item: { activity, durationMin, distanceKm? }, distance in km.
--
-- Deploy order: the app writes this column with every workout log, so apply this migration with
-- (or before) the app version that sends it — otherwise those writes fail and block the sync
-- queue behind them.

alter table workout_logs add column cardio jsonb;

-- A list or nothing: an object or a scalar here would be a client bug worth refusing loudly.
alter table workout_logs add constraint workout_logs_cardio_is_array
  check (cardio is null or jsonb_typeof(cardio) = 'array');
