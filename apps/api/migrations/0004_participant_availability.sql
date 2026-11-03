CREATE TYPE align.availability_status AS ENUM ('available', 'if_need_be');

CREATE TABLE align.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES align.events (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT participants_display_name_length CHECK (
    char_length(display_name) BETWEEN 1 AND 200
  ),
  CONSTRAINT participants_email_length CHECK (
    email IS NULL OR char_length(email) BETWEEN 3 AND 320
  )
);

CREATE INDEX participants_event_id_idx ON align.participants (event_id);

CREATE UNIQUE INDEX participants_event_email_key
  ON align.participants (event_id, lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE align.participant_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES align.participants (id) ON DELETE CASCADE,
  slot_date date,
  slot_weekday smallint,
  slot_minute smallint,
  status align.availability_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT participant_availability_exactly_one_kind CHECK (
    (slot_date IS NOT NULL AND slot_weekday IS NULL)
    OR (slot_date IS NULL AND slot_weekday IS NOT NULL)
  ),
  CONSTRAINT participant_availability_weekday_range CHECK (
    slot_weekday IS NULL OR slot_weekday BETWEEN 0 AND 6
  ),
  CONSTRAINT participant_availability_minute_range CHECK (
    slot_minute IS NULL OR slot_minute BETWEEN 0 AND 1439
  )
);

CREATE INDEX participant_availability_participant_id_idx
  ON align.participant_availability (participant_id);

CREATE UNIQUE INDEX participant_availability_dated_slot_key
  ON align.participant_availability (participant_id, slot_date, slot_minute)
  NULLS NOT DISTINCT
  WHERE slot_date IS NOT NULL;

CREATE UNIQUE INDEX participant_availability_weekday_slot_key
  ON align.participant_availability (participant_id, slot_weekday, slot_minute)
  NULLS NOT DISTINCT
  WHERE slot_weekday IS NOT NULL;