ALTER TABLE align.events ADD COLUMN organizer_name text;

ALTER TABLE align.events
  ADD CONSTRAINT events_organizer_name_length
  CHECK (organizer_name IS NULL OR char_length(organizer_name) BETWEEN 1 AND 200);

ALTER TABLE align.events
  ADD COLUMN time_zone text NOT NULL DEFAULT 'Asia/Manila';

ALTER TABLE align.events
  ADD CONSTRAINT events_time_zone_length
  CHECK (char_length(time_zone) BETWEEN 1 AND 64);
