import assert from 'node:assert/strict';
import test from 'node:test';

async function loadEventsModule() {
  try {
    return await import('../src/routes/events.ts');
  } catch (error) {
    assert.fail(`events route module must exist: ${error.code ?? error.message}`);
  }
}

function datesOnlyPayload(overrides = {}) {
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

function datesAndTimesPayload(overrides = {}) {
  return datesOnlyPayload({
    schedule_type: 'dates_and_times',
    daily_start_minute: 540,
    daily_end_minute: 1020,
    ...overrides,
  });
}

function firstFailure(result) {
  assert.equal(result.success, false);
  return result.error.issues[0];
}

test('a dates-only event without a time window is accepted', async () => {
  const { createEventSchema } = await loadEventsModule();
  const result = createEventSchema.safeParse(datesOnlyPayload());

  assert.equal(result.success, true);
  assert.equal(result.data.title, 'Design sync');
  assert.deepEqual(result.data.dates, ['2026-10-20', '2026-10-21']);
});

test('a dated event with a valid daily window is accepted', async () => {
  const { createEventSchema } = await loadEventsModule();
  const result = createEventSchema.safeParse(datesAndTimesPayload());

  assert.equal(result.success, true);
  assert.equal(result.data.daily_start_minute, 540);
  assert.equal(result.data.daily_end_minute, 1020);
});

test('a recurring weekday event is accepted', async () => {
  const { createEventSchema } = await loadEventsModule();
  const result = createEventSchema.safeParse(
    datesAndTimesPayload({ schedule_type: 'days_of_week', dates: [], weekdays: [1, 3, 5] }),
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.data.weekdays, [1, 3, 5]);
});

test('the title is trimmed and must not be blank or overlong', async () => {
  const { createEventSchema } = await loadEventsModule();

  const trimmed = createEventSchema.safeParse(datesOnlyPayload({ title: '  Spaced out  ' }));
  assert.equal(trimmed.success, true);
  assert.equal(trimmed.data.title, 'Spaced out');

  assert.equal(createEventSchema.safeParse(datesOnlyPayload({ title: '   ' })).success, false);
  assert.equal(
    createEventSchema.safeParse(datesOnlyPayload({ title: 'x'.repeat(201) })).success,
    false,
  );
  assert.equal(
    createEventSchema.safeParse(datesOnlyPayload({ title: 'x'.repeat(200) })).success,
    true,
  );
});

test('the description is optional and capped', async () => {
  const { createEventSchema } = await loadEventsModule();

  assert.equal(createEventSchema.safeParse(datesOnlyPayload({ description: '' })).success, true);
  assert.equal(
    createEventSchema.safeParse(datesOnlyPayload({ description: undefined })).success,
    true,
  );
  assert.equal(
    createEventSchema.safeParse(datesOnlyPayload({ description: 'y'.repeat(2001) })).success,
    false,
  );
});

test('only supported slot intervals are accepted', async () => {
  const { createEventSchema } = await loadEventsModule();

  for (const interval of [15, 30, 60]) {
    assert.equal(
      createEventSchema.safeParse(datesOnlyPayload({ slot_interval_minutes: interval })).success,
      true,
    );
  }
  for (const interval of [0, 10, 45, 90]) {
    assert.equal(
      createEventSchema.safeParse(datesOnlyPayload({ slot_interval_minutes: interval })).success,
      false,
    );
  }
});

test('a dates-only event may not carry a daily time window', async () => {
  const { createEventSchema } = await loadEventsModule();
  const issue = firstFailure(
    createEventSchema.safeParse(
      datesOnlyPayload({ daily_start_minute: 540, daily_end_minute: 1020 }),
    ),
  );

  assert.deepEqual(issue.path, ['daily_start_minute']);
});

test('a timed event requires a daily window that ends after it starts', async () => {
  const { createEventSchema } = await loadEventsModule();

  const missing = createEventSchema.safeParse(
    datesAndTimesPayload({ daily_start_minute: null, daily_end_minute: null }),
  );
  assert.equal(missing.success, false);

  const inverted = createEventSchema.safeParse(
    datesAndTimesPayload({ daily_start_minute: 1020, daily_end_minute: 540 }),
  );
  assert.deepEqual(firstFailure(inverted).path, ['daily_end_minute']);

  const empty = createEventSchema.safeParse(
    datesAndTimesPayload({ daily_start_minute: 540, daily_end_minute: 540 }),
  );
  assert.equal(empty.success, false);

  const past = createEventSchema.safeParse(
    datesAndTimesPayload({ daily_start_minute: 0, daily_end_minute: 1441 }),
  );
  assert.equal(past.success, false);
});

test('dates must be real, unique, and present for dated schedules', async () => {
  const { createEventSchema } = await loadEventsModule();

  assert.equal(createEventSchema.safeParse(datesOnlyPayload({ dates: [] })).success, false);
  assert.equal(
    createEventSchema.safeParse(datesOnlyPayload({ dates: ['2026-10-20', '2026-10-20'] })).success,
    false,
  );
  assert.equal(
    createEventSchema.safeParse(datesOnlyPayload({ dates: ['2026-13-01'] })).success,
    false,
  );
  assert.equal(
    createEventSchema.safeParse(datesOnlyPayload({ dates: ['2026-02-30'] })).success,
    false,
  );
  assert.equal(
    createEventSchema.safeParse(datesOnlyPayload({ dates: ['20-10-2026'] })).success,
    false,
  );
});

test('weekdays must be in range, unique, and present for recurring schedules', async () => {
  const { createEventSchema } = await loadEventsModule();
  const recurring = (overrides) =>
    createEventSchema.safeParse(
      datesAndTimesPayload({ schedule_type: 'days_of_week', dates: [], ...overrides }),
    );

  assert.equal(recurring({ weekdays: [0, 6] }).success, true);
  assert.equal(recurring({ weekdays: [] }).success, false);
  assert.equal(recurring({ weekdays: [1, 1] }).success, false);
  assert.equal(recurring({ weekdays: [7] }).success, false);
  assert.equal(recurring({ weekdays: [-1] }).success, false);
});

test('an unknown schedule type is rejected', async () => {
  const { createEventSchema } = await loadEventsModule();

  assert.equal(
    createEventSchema.safeParse(datesOnlyPayload({ schedule_type: 'recurring_days' })).success,
    false,
  );
});

test('POST /events reports a safe error when no database is configured', async (t) => {
  const { createApp } = await import('../src/app.ts');
  const app = createApp();
  await app.ready();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/events',
    payload: datesOnlyPayload(),
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { error: 'database_unavailable' });
});

test('POST /events rejects an invalid payload before touching the database', async (t) => {
  const { createApp } = await import('../src/app.ts');
  const app = createApp();
  await app.ready();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/events',
    payload: datesOnlyPayload({ title: '', slot_interval_minutes: 45 }),
  });
  const body = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(body.error, 'validation_failed');
  assert.ok(body.details.some((detail) => detail.field === 'title'));
  assert.ok(body.details.some((detail) => detail.field === 'slot_interval_minutes'));
});
