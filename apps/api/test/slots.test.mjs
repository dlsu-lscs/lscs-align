import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSlots } from '../src/lib/slots.ts';

const timed = {
  scheduleType: 'dates_and_times',
  slotIntervalMinutes: 30,
  dailyStartMinute: 540,
  dailyEndMinute: 1020,
  dates: ['2026-10-15', '2026-10-16'],
  weekdays: [],
};
const datesOnly = {
  scheduleType: 'dates_only',
  slotIntervalMinutes: 30,
  dailyStartMinute: null,
  dailyEndMinute: null,
  dates: ['2026-10-15'],
  weekdays: [],
};
const recurring = {
  scheduleType: 'days_of_week',
  slotIntervalMinutes: 60,
  dailyStartMinute: 540,
  dailyEndMinute: 1020,
  dates: [],
  weekdays: [1, 3],
};

function accepted(schedule, slots) {
  const result = validateSlots(schedule, slots);
  assert.deepEqual(result.issues, []);
  return result.normalized;
}

function firstIssue(schedule, slots) {
  const result = validateSlots(schedule, slots);
  assert.ok(result.issues.length > 0, 'expected at least one issue');
  assert.equal(result.normalized.length, 0, 'a rejected submission must normalize nothing');
  return result.issues[0];
}

test('valid timed slots normalize to database rows', () => {
  assert.deepEqual(
    accepted(timed, [
      { date: '2026-10-15', minute: 540 },
      { date: '2026-10-16', minute: 570 },
    ]),
    [
      { slotDate: '2026-10-15', slotWeekday: null, slotMinute: 540 },
      { slotDate: '2026-10-16', slotWeekday: null, slotMinute: 570 },
    ],
  );
});

test('a slot must finish inside the daily window, not merely start inside it', () => {
  accepted(timed, [{ date: '2026-10-15', minute: 990 }]);
  assert.match(
    firstIssue(timed, [{ date: '2026-10-15', minute: 1020 }]).message,
    /daily time window/,
  );
});

test('a slot before the daily window is rejected', () => {
  assert.match(
    firstIssue(timed, [{ date: '2026-10-15', minute: 510 }]).message,
    /daily time window/,
  );
});

test('minutes must align to the interval measured from the window start', () => {
  assert.match(firstIssue(timed, [{ date: '2026-10-15', minute: 545 }]).message, /align/);
  accepted({ ...timed, dailyStartMinute: 555 }, [{ date: '2026-10-15', minute: 585 }]);
  assert.match(
    firstIssue({ ...timed, dailyStartMinute: 555 }, [{ date: '2026-10-15', minute: 570 }]).message,
    /align/,
  );
});

test('a date outside the event is rejected', () => {
  assert.match(
    firstIssue(timed, [{ date: '2026-10-17', minute: 540 }]).message,
    /not part of this event/,
  );
});

test('a timed event requires a minute and forbids a weekday', () => {
  assert.match(firstIssue(timed, [{ date: '2026-10-15' }]).message, /minute is required/);
  assert.match(firstIssue(timed, [{ weekday: 1, minute: 540 }]).message, /date is required/);
});

test('duplicate slots in one submission are rejected', () => {
  assert.match(
    firstIssue(timed, [
      { date: '2026-10-15', minute: 540 },
      { date: '2026-10-15', minute: 540 },
    ]).message,
    /duplicate/,
  );
});

test('a dates-only event takes bare dates and refuses minutes', () => {
  assert.deepEqual(accepted(datesOnly, [{ date: '2026-10-15' }]), [
    { slotDate: '2026-10-15', slotWeekday: null, slotMinute: null },
  ]);
  assert.match(
    firstIssue(datesOnly, [{ date: '2026-10-15', minute: 540 }]).message,
    /minute is not allowed/,
  );
});

test('a dates-only event still rejects a repeated date', () => {
  assert.match(
    firstIssue(datesOnly, [{ date: '2026-10-15' }, { date: '2026-10-15' }]).message,
    /duplicate/,
  );
});

test('a recurring event takes weekdays and refuses dates', () => {
  assert.deepEqual(accepted(recurring, [{ weekday: 1, minute: 540 }]), [
    { slotDate: null, slotWeekday: 1, slotMinute: 540 },
  ]);
  assert.match(
    firstIssue(recurring, [{ date: '2026-10-15', minute: 540 }]).message,
    /weekday is required/,
  );
});

test('a weekday outside the event is rejected', () => {
  assert.match(
    firstIssue(recurring, [{ weekday: 2, minute: 540 }]).message,
    /not part of this event/,
  );
});

test('the configured interval drives alignment for recurring events', () => {
  accepted(recurring, [{ weekday: 1, minute: 600 }]);
  assert.match(firstIssue(recurring, [{ weekday: 1, minute: 570 }]).message, /align/);
});

test('an empty submission is valid and produces no rows', () => {
  const result = validateSlots(timed, []);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.normalized, []);
});

test('issues identify the offending slot by index', () => {
  const result = validateSlots(timed, [
    { date: '2026-10-15', minute: 540 },
    { date: '2026-10-17', minute: 540 },
  ]);
  assert.equal(result.issues[0].field, 'slots.1');
});

test('a timed event missing its window reports the event, not the slot', () => {
  const broken = { ...timed, dailyStartMinute: null, dailyEndMinute: null };
  assert.match(
    firstIssue(broken, [{ date: '2026-10-15', minute: 540 }]).message,
    /missing its daily time window/,
  );
});
