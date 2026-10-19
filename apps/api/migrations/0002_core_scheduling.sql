CREATE TYPE align.schedule_type AS ENUM ('dates_only', 'dates_and_times', 'days_of_week');

CREATE TABLE align.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  schedule_type align.schedule_type NOT NULL,
  slot_interval_minutes smallint NOT NULL DEFAULT 30,
  daily_start_minute smallint,
  daily_end_minute smallint,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT events_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT events_description_length CHECK (
    description IS NULL OR char_length(description) <= 2000
  ),
  CONSTRAINT events_slot_interval_supported CHECK (slot_interval_minutes IN (15, 30, 60)),
  CONSTRAINT events_daily_window_matches_schedule_type CHECK (
    (
      schedule_type = 'dates_only'
      AND daily_start_minute IS NULL
      AND daily_end_minute IS NULL
    )
    OR (
      schedule_type <> 'dates_only'
      AND daily_start_minute IS NOT NULL
      AND daily_end_minute IS NOT NULL
      AND daily_start_minute >= 0
      AND daily_end_minute <= 1440
      AND daily_end_minute > daily_start_minute
    )
  )
);

CREATE TABLE align.event_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES align.events (id) ON DELETE CASCADE,
  calendar_date date,
  weekday smallint,
  CONSTRAINT event_dates_exactly_one_kind CHECK (
    (calendar_date IS NOT NULL AND weekday IS NULL)
    OR (calendar_date IS NULL AND weekday IS NOT NULL)
  ),
  CONSTRAINT event_dates_weekday_range CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6)
);

CREATE INDEX event_dates_event_id_idx ON align.event_dates (event_id);

CREATE UNIQUE INDEX event_dates_event_calendar_date_key
  ON align.event_dates (event_id, calendar_date)
  WHERE calendar_date IS NOT NULL;

CREATE UNIQUE INDEX event_dates_event_weekday_key
  ON align.event_dates (event_id, weekday)
  WHERE weekday IS NOT NULL;
