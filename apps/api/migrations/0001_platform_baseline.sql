CREATE TABLE align.platform_metadata (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO align.platform_metadata (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;
