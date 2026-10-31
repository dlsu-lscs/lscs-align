import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';

import { createDatabase } from '@align/db';

import { createApp } from '../../src/app.ts';
import { runMigrations } from '../../src/migrations.ts';

const migrationDatabaseUrl = process.env.TEST_MIGRATION_DATABASE_URL;

if (!migrationDatabaseUrl) {
  throw new Error('TEST_MIGRATION_DATABASE_URL is required for integration tests');
}

const { Pool } = pg;
const pool = new Pool({ connectionString: migrationDatabaseUrl, max: 4 });
const expectedIdentity = { environment: 'test', databaseName: 'align_test' };
const migrationsDirectory = new URL('../../migrations/', import.meta.url);

let app;

test.before(async () => {
  await pool.query('DROP SCHEMA IF EXISTS align CASCADE');
  await runMigrations({ pool, expectedIdentity, migrationsDirectory });
  app = createApp({ database: createDatabase(pool) });
  await app.ready();
});

test.beforeEach(async () => {
  await pool.query('TRUNCATE align.events CASCADE');
});

test.after(async () => {
  await app?.close();
  await pool.end();
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

  const stored = await pool.query(
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

  const dates = await pool.query(
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

  const stored = await pool.query(
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

  const rows = await pool.query(
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

  const stored = await pool.query('SELECT description FROM align.events');
  assert.deepEqual(stored.rows, [{ description: null }]);
});

test('two events may claim the same calendar date', async () => {
  const first = await post(payload({ dates: ['2026-10-20'] }));
  const second = await post(payload({ title: 'Another event', dates: ['2026-10-20'] }));

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);

  const counts = await pool.query('SELECT count(*)::integer AS events FROM align.events');
  assert.equal(counts.rows[0].events, 2);
});

test('a rejected payload writes nothing', async () => {
  const response = await post(payload({ slot_interval_minutes: 45 }));

  assert.equal(response.statusCode, 400);

  const counts = await pool.query('SELECT count(*)::integer AS events FROM align.events');
  assert.equal(counts.rows[0].events, 0);
});
