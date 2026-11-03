import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';

import { createDatabase } from '@align/db';

import { createApp } from '../../src/app.ts';
import { runMigrations } from '../../src/migrations.ts';

const migrationDatabaseUrl = process.env.TEST_MIGRATION_DATABASE_URL;
const runtimeDatabaseUrl = process.env.TEST_RUNTIME_DATABASE_URL;

if (!migrationDatabaseUrl || !runtimeDatabaseUrl) {
  throw new Error(
    'TEST_MIGRATION_DATABASE_URL and TEST_RUNTIME_DATABASE_URL are required for integration tests',
  );
}

const { Pool } = pg;
const migrationPool = new Pool({ connectionString: migrationDatabaseUrl, max: 4 });
const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl, max: 4 });
const expectedIdentity = { environment: 'test', databaseName: 'align_test' };
const migrationsDirectory = new URL('../../migrations/', import.meta.url);

let app;

test.before(async () => {
  await migrationPool.query('DROP SCHEMA IF EXISTS align CASCADE');

  const configuredRole = await migrationPool.query(
    "SELECT nullif(btrim(current_setting('align.runtime_role', true)), '') AS role",
  );
  if (!configuredRole.rows[0]?.role) {
    const runtimeUser = decodeURIComponent(new URL(runtimeDatabaseUrl).username);
    const client = await migrationPool.connect();
    await client.query("SELECT set_config('align.runtime_role', $1, false)", [runtimeUser]);
    await runMigrations({
      pool: {
        connect: async () => ({
          query: (text, values) => client.query(text, values),
          release: () => client.release(),
        }),
      },
      expectedIdentity,
      migrationsDirectory,
    });
  } else {
    await runMigrations({ pool: migrationPool, expectedIdentity, migrationsDirectory });
  }

  app = createApp({ database: createDatabase(runtimePool) });
  await app.ready();
});

test.beforeEach(async () => {
  await runtimePool.query('DELETE FROM align.events');
});

test.after(async () => {
  await app?.close();
  await runtimePool.end();
  await migrationPool.end();
});

async function createEvent(overrides = {}) {
  const response = await app.inject({
    method: 'POST',
    url: '/events',
    payload: {
      title: 'Availability fixture',
      schedule_type: 'dates_and_times',
      dates: ['2026-10-15', '2026-10-16'],
      weekdays: [],
      daily_start_minute: 540,
      daily_end_minute: 1020,
      slot_interval_minutes: 30,
      ...overrides,
    },
  });
  assert.equal(response.statusCode, 201);
  return response.json();
}

function submit(eventId, body) {
  return app.inject({ method: 'POST', url: `/events/${eventId}/availability`, payload: body });
}

async function countOf(sql, values = []) {
  const result = await runtimePool.query(sql, values);
  return Number(result.rows[0].count);
}

test('a missing event is reported as not found', async () => {
  const response = await submit('f47ac10b-58cc-4372-a567-0e02b2c3d479', { name: 'X', slots: [] });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: 'event_not_found' });
});

test('a malformed event id is rejected before any query', async () => {
  const response = await submit('not-a-uuid', { name: 'X', slots: [] });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'validation_failed');
});

test('identity fields are validated', async () => {
  const event = await createEvent();

  const nameless = await submit(event.id, { slots: [] });
  assert.equal(nameless.statusCode, 400);
  assert.ok(nameless.json().details.some((detail) => detail.field === 'name'));

  const badEmail = await submit(event.id, { name: 'X', email: 'nope', slots: [] });
  assert.equal(badEmail.statusCode, 400);
  assert.ok(badEmail.json().details.some((detail) => detail.field === 'email'));
});

test('a first submission is created and its slots are persisted', async () => {
  const event = await createEvent();
  const response = await submit(event.id, {
    name: 'Patricia',
    email: 'p@dlsu.edu.ph',
    slots: [
      { date: '2026-10-15', minute: 540 },
      { date: '2026-10-15', minute: 570 },
      { date: '2026-10-16', minute: 990 },
    ],
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.slot_count, 3);

  const stored = await runtimePool.query(
    `SELECT slot_date::text AS date, slot_minute AS minute, status
     FROM align.participant_availability WHERE participant_id = $1
     ORDER BY slot_date, slot_minute`,
    [body.participant_id],
  );
  assert.deepEqual(stored.rows, [
    { date: '2026-10-15', minute: 540, status: 'available' },
    { date: '2026-10-15', minute: 570, status: 'available' },
    { date: '2026-10-16', minute: 990, status: 'available' },
  ]);
});

test('resubmitting with the same email replaces the previous availability', async () => {
  const event = await createEvent();
  const first = await submit(event.id, {
    name: 'Patricia',
    email: 'p@dlsu.edu.ph',
    slots: [
      { date: '2026-10-15', minute: 540 },
      { date: '2026-10-15', minute: 570 },
    ],
  });
  assert.equal(first.statusCode, 201);

  const second = await submit(event.id, {
    name: 'Patricia Naui',
    email: 'P@DLSU.EDU.PH',
    slots: [{ date: '2026-10-16', minute: 600 }],
  });

  assert.equal(second.statusCode, 200);
  assert.equal(second.json().participant_id, first.json().participant_id);
  assert.equal(
    await countOf('SELECT count(*) AS count FROM align.participants WHERE event_id = $1', [
      event.id,
    ]),
    1,
  );
  assert.equal(
    await countOf(
      'SELECT count(*) AS count FROM align.participant_availability WHERE participant_id = $1',
      [second.json().participant_id],
    ),
    1,
  );

  const renamed = await runtimePool.query(
    'SELECT display_name FROM align.participants WHERE id = $1',
    [second.json().participant_id],
  );
  assert.equal(renamed.rows[0].display_name, 'Patricia Naui');
});

test('submissions without an email always create a new participant', async () => {
  const event = await createEvent();
  const first = await submit(event.id, {
    name: 'Anon',
    slots: [{ date: '2026-10-15', minute: 540 }],
  });
  const second = await submit(event.id, {
    name: 'Anon',
    slots: [{ date: '2026-10-15', minute: 540 }],
  });

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.notEqual(first.json().participant_id, second.json().participant_id);
  assert.equal(
    await countOf(
      'SELECT count(*) AS count FROM align.participants WHERE event_id = $1 AND email IS NULL',
      [event.id],
    ),
    2,
  );
});

test("slots outside the event's schedule are rejected and write nothing", async () => {
  const event = await createEvent();

  const cases = [
    [{ date: '2026-10-15', minute: 1020 }, /daily time window/],
    [{ date: '2026-10-15', minute: 545 }, /align/],
    [{ date: '2026-10-17', minute: 540 }, /not part of this event/],
  ];

  for (const [slot, pattern] of cases) {
    const response = await submit(event.id, { name: 'Ghost', slots: [slot] });
    assert.equal(response.statusCode, 400);
    assert.match(response.json().details[0].message, pattern);
  }

  assert.equal(
    await countOf('SELECT count(*) AS count FROM align.participants WHERE event_id = $1', [
      event.id,
    ]),
    0,
  );
});

test('duplicate slots inside one submission are rejected', async () => {
  const event = await createEvent();
  const response = await submit(event.id, {
    name: 'X',
    slots: [
      { date: '2026-10-15', minute: 540 },
      { date: '2026-10-15', minute: 540 },
    ],
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().details[0].message, /duplicate/);
});

test('a dates-only event stores bare dates and refuses minutes', async () => {
  const event = await createEvent({
    schedule_type: 'dates_only',
    dates: ['2026-10-20'],
    daily_start_minute: null,
    daily_end_minute: null,
  });

  const accepted = await submit(event.id, { name: 'D', slots: [{ date: '2026-10-20' }] });
  assert.equal(accepted.statusCode, 201);

  const stored = await runtimePool.query(
    'SELECT slot_date::text AS date, slot_minute AS minute FROM align.participant_availability WHERE participant_id = $1',
    [accepted.json().participant_id],
  );
  assert.deepEqual(stored.rows, [{ date: '2026-10-20', minute: null }]);

  const rejected = await submit(event.id, {
    name: 'D2',
    slots: [{ date: '2026-10-20', minute: 540 }],
  });
  assert.equal(rejected.statusCode, 400);
});

test('a recurring event stores weekdays instead of calendar dates', async () => {
  const event = await createEvent({
    schedule_type: 'days_of_week',
    dates: [],
    weekdays: [1, 3],
    slot_interval_minutes: 60,
  });

  const accepted = await submit(event.id, {
    name: 'R',
    slots: [
      { weekday: 1, minute: 540 },
      { weekday: 3, minute: 600 },
    ],
  });
  assert.equal(accepted.statusCode, 201);

  const stored = await runtimePool.query(
    'SELECT slot_date, slot_weekday AS weekday, slot_minute AS minute FROM align.participant_availability WHERE participant_id = $1 ORDER BY slot_weekday',
    [accepted.json().participant_id],
  );
  assert.deepEqual(stored.rows, [
    { slot_date: null, weekday: 1, minute: 540 },
    { slot_date: null, weekday: 3, minute: 600 },
  ]);

  const rejected = await submit(event.id, { name: 'R2', slots: [{ weekday: 2, minute: 540 }] });
  assert.equal(rejected.statusCode, 400);
});

test('deleting an event removes its participants and their availability', async () => {
  const event = await createEvent();
  const submitted = await submit(event.id, {
    name: 'Patricia',
    email: 'p@dlsu.edu.ph',
    slots: [{ date: '2026-10-15', minute: 540 }],
  });
  assert.equal(submitted.statusCode, 201);

  await runtimePool.query('DELETE FROM align.events WHERE id = $1', [event.id]);

  assert.equal(await countOf('SELECT count(*) AS count FROM align.participants'), 0);
  assert.equal(await countOf('SELECT count(*) AS count FROM align.participant_availability'), 0);
});

test('the runtime role can write availability but cannot alter its schema', async () => {
  const event = await createEvent();
  const submitted = await submit(event.id, {
    name: 'X',
    slots: [{ date: '2026-10-15', minute: 540 }],
  });
  assert.equal(submitted.statusCode, 201);

  await assert.rejects(
    runtimePool.query('DROP TABLE align.participant_availability'),
    (error) => error.code === '42501',
  );
  await assert.rejects(
    runtimePool.query('ALTER TABLE align.participants ADD COLUMN injected text'),
    (error) => error.code === '42501',
  );
});
