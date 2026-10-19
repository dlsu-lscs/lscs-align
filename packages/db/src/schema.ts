import { sql } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgSchema,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const alignSchema = pgSchema('align');

export const scheduleTypeEnum = alignSchema.enum('schedule_type', [
  'dates_only',
  'dates_and_times',
  'days_of_week',
]);

export const events = alignSchema.table(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),
    scheduleType: scheduleTypeEnum('schedule_type').notNull(),
    slotIntervalMinutes: smallint('slot_interval_minutes').notNull().default(30),
    dailyStartMinute: smallint('daily_start_minute'),
    dailyEndMinute: smallint('daily_end_minute'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('events_title_length', sql`char_length(${table.title}) between 1 and 200`),
    check('events_slot_interval_supported', sql`${table.slotIntervalMinutes} in (15, 30, 60)`),
  ],
);

export const eventDates = alignSchema.table(
  'event_dates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    calendarDate: date('calendar_date'),
    weekday: smallint('weekday'),
  },
  (table) => [
    index('event_dates_event_id_idx').on(table.eventId),
    uniqueIndex('event_dates_event_calendar_date_key')
      .on(table.eventId, table.calendarDate)
      .where(sql`${table.calendarDate} is not null`),
    uniqueIndex('event_dates_event_weekday_key')
      .on(table.eventId, table.weekday)
      .where(sql`${table.weekday} is not null`),
    check('event_dates_weekday_range', sql`${table.weekday} between 0 and 6`),
  ],
);

export type ScheduleType = (typeof scheduleTypeEnum.enumValues)[number];
export type Event = InferSelectModel<typeof events>;
export type NewEvent = InferInsertModel<typeof events>;
export type EventDate = InferSelectModel<typeof eventDates>;
export type NewEventDate = InferInsertModel<typeof eventDates>;
