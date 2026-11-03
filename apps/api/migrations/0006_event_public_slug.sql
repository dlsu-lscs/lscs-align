ALTER TABLE align.events ADD COLUMN public_slug text;

UPDATE align.events
SET public_slug = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
WHERE public_slug IS NULL;

-- A column default keeps the previous application release able to insert
-- events if it is rolled back while this migration stays applied.
ALTER TABLE align.events
  ALTER COLUMN public_slug SET DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

ALTER TABLE align.events ALTER COLUMN public_slug SET NOT NULL;

ALTER TABLE align.events
  ADD CONSTRAINT events_public_slug_format
  CHECK (public_slug ~ '^[A-Za-z0-9_-]{8,24}$');

CREATE UNIQUE INDEX events_public_slug_key ON align.events (public_slug);