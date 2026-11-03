DO $$
DECLARE
  runtime_role text := nullif(btrim(current_setting('align.runtime_role', true)), '');
BEGIN
  IF runtime_role IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = runtime_role) THEN
      RAISE EXCEPTION 'Configured align.runtime_role % does not exist', runtime_role;
    END IF;

    EXECUTE format('GRANT USAGE ON TYPE align.availability_status TO %I', runtime_role);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE align.participants, align.participant_availability TO %I',
      runtime_role
    );
  END IF;
END
$$;