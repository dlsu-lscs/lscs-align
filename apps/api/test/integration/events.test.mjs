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

function payload(overrides = {}) {
  return {
    title: 'Design sync',
    description: 'Weekly catch-up',
    schedule_type: 'dates_only',
    dates: ['2026-10-20', '2026-10-21'],
    weekdays: [],
    daily_start_minute: null,
    daily_end_minute: null,
    time_zone: 'Asia/Manila',
    slot_interval_minutes: 30,
    ...overrides,
  };
}

function post(body) {
  return app.inject({ method: 'POST', url: '/events', payload: body });
}

test('a dates-only event is persisted with its selected dates', async () => {
  const response = await post(payload());
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.title, 'Design sync');
  assert.equal(body.schedule_type, 'dates_only');
  assert.equal(body.slot_interval_minutes, 30);
  assert.equal(body.daily_start_minute, null);

  const stored = await runtimePool.query(
    'SELECT title, description, schedule_type, slot_interval_minutes, daily_start_minute FROM align.events',
  );
  assert.deepEqual(stored.rows, [
    {
      title: 'Design sync',
      description: 'Weekly catch-up',
      schedule_type: 'dates_only',
      slot_interval_minutes: 30,
      daily_start_minute: null,
    },
  ]);

  const dates = await runtimePool.query(
    'SELECT calendar_date::text, weekday FROM align.event_dates ORDER BY calendar_date',
  );
  assert.deepEqual(dates.rows, [
    { calendar_date: '2026-10-20', weekday: null },
    { calendar_date: '2026-10-21', weekday: null },
  ]);
});

test('a timed event stores its daily window in minutes', async () => {
  const response = await post(
    payload({
      schedule_type: 'dates_and_times',
      daily_start_minute: 540,
      daily_end_minute: 1020,
    }),
  );

  assert.equal(response.statusCode, 201);

  const stored = await runtimePool.query(
    'SELECT schedule_type, daily_start_minute, daily_end_minute FROM align.events',
  );
  assert.deepEqual(stored.rows, [
    { schedule_type: 'dates_and_times', daily_start_minute: 540, daily_end_minute: 1020 },
  ]);
});

test('a recurring event stores weekdays instead of calendar dates', async () => {
  const response = await post(
    payload({
      schedule_type: 'days_of_week',
      dates: [],
      weekdays: [1, 3, 5],
      daily_start_minute: 540,
      daily_end_minute: 1020,
    }),
  );
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.deepEqual(body.weekdays, [1, 3, 5]);
  assert.deepEqual(body.dates, []);

  const rows = await runtimePool.query(
    'SELECT calendar_date, weekday FROM align.event_dates ORDER BY weekday',
  );
  assert.deepEqual(rows.rows, [
    { calendar_date: null, weekday: 1 },
    { calendar_date: null, weekday: 3 },
    { calendar_date: null, weekday: 5 },
  ]);
});

test('an empty description is stored as null rather than an empty string', async () => {
  const response = await post(payload({ description: '' }));

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().description, null);

  const stored = await runtimePool.query('SELECT description FROM align.events');
  assert.deepEqual(stored.rows, [{ description: null }]);
});

test('two events may claim the same calendar date', async () => {
  const first = await post(payload({ dates: ['2026-10-20'] }));
  const second = await post(payload({ title: 'Another event', dates: ['2026-10-20'] }));

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);

  const counts = await runtimePool.query('SELECT count(*)::integer AS events FROM align.events');
  assert.equal(counts.rows[0].events, 2);
});

test('a rejected payload writes nothing', async () => {
  const response = await post(payload({ slot_interval_minutes: 45 }));

  assert.equal(response.statusCode, 400);

  const counts = await runtimePool.query('SELECT count(*)::integer AS events FROM align.events');
  assert.equal(counts.rows[0].events, 0);
});

test('the runtime role can update and delete event rows without DDL or migration write access', async () => {
  const created = await post(payload());
  assert.equal(created.statusCode, 201);
  const eventId = created.json().id;

  const updated = await runtimePool.query(
    'UPDATE align.events SET title = $1 WHERE id = $2 RETURNING title',
    ['Updated sync', eventId],
  );
  assert.deepEqual(updated.rows, [{ title: 'Updated sync' }]);

  const deletedDates = await runtimePool.query(
    'DELETE FROM align.event_dates WHERE event_id = $1 RETURNING id',
    [eventId],
  );
  assert.equal(deletedDates.rowCount, 2);

  await assert.rejects(
    runtimePool.query(
      "INSERT INTO align.schema_migrations(version, name, checksum) VALUES ('9999', 'forged', repeat('0', 64))",
    ),
    (error) => error.code === '42501',
  );
  await assert.rejects(
    runtimePool.query('DROP TABLE align.events'),
    (error) => error.code === '42501',
  );
});

test('a created event is given a public slug that is persisted', async () => {
  const response = await post(payload());

  assert.equal(response.statusCode, 201);
  const slug = response.json().public_slug;
  assert.match(slug, /^[A-Za-z0-9_-]{8,24}$/);

  const stored = await runtimePool.query('SELECT public_slug FROM align.events');
  assert.deepEqual(stored.rows, [{ public_slug: slug }]);
});

test('each event receives a distinct public slug', async () => {
  for (let index = 0; index < 20; index += 1) {
    assert.equal((await post(payload({ title: `Event ${index}` }))).statusCode, 201);
  }

  const counts = await runtimePool.query(
    'SELECT count(*)::integer AS total, count(DISTINCT public_slug)::integer AS distinct_slugs FROM align.events',
  );
  assert.equal(counts.rows[0].total, 20);
  assert.equal(counts.rows[0].distinct_slugs, 20);
});

test('a public slug resolves to its own event', async () => {
  const first = (await post(payload({ title: 'First event' }))).json().public_slug;
  const second = (await post(payload({ title: 'Second event' }))).json().public_slug;

  const lookup = await app.inject({ method: 'GET', url: `/events/${first}` });
  assert.equal(lookup.statusCode, 200);
  assert.equal(lookup.json().title, 'First event');

  const other = await app.inject({ method: 'GET', url: `/events/${second}` });
  assert.equal(other.json().title, 'Second event');
});

test('the public lookup never exposes the internal event id', async () => {
  const slug = (await post(payload())).json().public_slug;
  const body = (await app.inject({ method: 'GET', url: `/events/${slug}` })).json();

  assert.equal(body.id, undefined);
  assert.doesNotMatch(JSON.stringify(body), /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/);
});

test('unknown and malformed slugs are both reported as not found', async () => {
  for (const slug of ['Zzzz99999', 'abc', encodeURIComponent('abc/def')]) {
    const response = await app.inject({ method: 'GET', url: `/events/${slug}` });
    assert.equal(response.statusCode, 404, slug);
    assert.deepEqual(response.json(), { error: 'event_not_found' });
  }
});

test('the runtime role can read the public slug but cannot drop its unique index', async () => {
  assert.equal((await post(payload())).statusCode, 201);

  const read = await runtimePool.query('SELECT public_slug FROM align.events');
  assert.equal(read.rows.length, 1);

  await assert.rejects(
    runtimePool.query('DROP INDEX align.events_public_slug_key'),
    (error) => error.code === '42501',
  );
});

function details(slug) {
  return app.inject({ method: 'GET', url: `/events/${slug}/details` });
}

test('the details endpoint returns exactly the contract the public page consumes', async () => {
  const slug = (await post(payload())).json().public_slug;
  const response = await details(slug);
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(body).sort(), [
    'daily_end_minute',
    'daily_start_minute',
    'dates',
    'description',
    'organizer',
    'schedule_type',
    'slot_interval_minutes',
    'slug',
    'time_zone',
    'title',
    'weekdays',
  ]);
  assert.equal(body.slug, slug);
  assert.equal(body.title, 'Design sync');
  assert.equal(body.description, 'Weekly catch-up');
  assert.equal(body.schedule_type, 'dates_only');
  assert.equal(body.slot_interval_minutes, 30);
  assert.equal(body.time_zone, 'Asia/Manila');
  assert.deepEqual(body.dates, ['2026-10-20', '2026-10-21']);
  assert.deepEqual(body.weekdays, []);
});

test('the details endpoint reports the organizer only when one was supplied', async () => {
  const named = (await post(payload({ organizer_name: 'Ejay Santos' }))).json().public_slug;
  const anonymous = (await post(payload({ title: 'No organizer' }))).json().public_slug;

  assert.deepEqual((await details(named)).json().organizer, { name: 'Ejay Santos' });
  assert.equal((await details(anonymous)).json().organizer, null);
});

test('a recurring event reports weekdays and no calendar dates', async () => {
  const slug = (
    await post(
      payload({
        schedule_type: 'days_of_week',
        dates: [],
        weekdays: [5, 1, 3],
        daily_start_minute: 540,
        daily_end_minute: 1020,
      }),
    )
  ).json().public_slug;
  const body = (await details(slug)).json();

  assert.equal(body.schedule_type, 'days_of_week');
  assert.deepEqual(body.weekdays, [1, 3, 5]);
  assert.deepEqual(body.dates, []);
  assert.equal(body.daily_start_minute, 540);
  assert.equal(body.daily_end_minute, 1020);
});

test('an omitted time zone falls back to the database default', async () => {
  const body = payload();
  delete body.time_zone;
  const slug = (await post(body)).json().public_slug;

  assert.equal((await details(slug)).json().time_zone, 'Asia/Manila');
});

test('an explicit time zone survives the round trip', async () => {
  const slug = (await post(payload({ time_zone: 'Australia/Sydney' }))).json().public_slug;

  assert.equal((await details(slug)).json().time_zone, 'Australia/Sydney');
});

test('the details endpoint exposes no internal or administrative fields', async () => {
  const slug = (await post(payload())).json().public_slug;
  const body = (await details(slug)).json();

  assert.equal(body.id, undefined);
  assert.equal(body.public_slug, undefined);
  assert.equal(body.created_at, undefined);
  assert.equal(body.updated_at, undefined);
  assert.doesNotMatch(JSON.stringify(body), /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/);
});

test('each slug resolves to its own details and never a neighbour', async () => {
  const first = (await post(payload({ title: 'First event' }))).json().public_slug;
  const second = (await post(payload({ title: 'Second event' }))).json().public_slug;

  assert.equal((await details(first)).json().title, 'First event');
  assert.equal((await details(second)).json().title, 'Second event');
});

test('unknown and malformed slugs are both reported as not found by the details endpoint', async () => {
  for (const slug of ['Zzzz99999', 'abc', encodeURIComponent('abc/def')]) {
    const response = await details(slug);

    assert.equal(response.statusCode, 404, slug);
    assert.deepEqual(response.json(), { error: 'event_not_found' });
  }
});

test('the runtime role can read the public details columns but cannot alter them', async () => {
  assert.equal((await post(payload({ organizer_name: 'Ejay Santos' }))).statusCode, 201);

  const read = await runtimePool.query('SELECT organizer_name, time_zone FROM align.events');
  assert.deepEqual(read.rows, [{ organizer_name: 'Ejay Santos', time_zone: 'Asia/Manila' }]);

  await assert.rejects(
    runtimePool.query('ALTER TABLE align.events DROP COLUMN time_zone'),
    (error) => error.code === '42501',
  );
});
