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
    publicSlug: text('public_slug').notNull(),
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
    uniqueIndex('events_public_slug_key').on(table.publicSlug),
    check('events_title_length', sql`char_length(${table.title}) between 1 and 200`),
    check('events_slot_interval_supported', sql`${table.slotIntervalMinutes} in (15, 30, 60)`),
    check('events_public_slug_format', sql`${table.publicSlug} ~ '^[A-Za-z0-9_-]{8,24}$'`),
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

export const availabilityStatusEnum = alignSchema.enum('availability_status', [
  'available',
  'if_need_be',
]);

export const participants = alignSchema.table(
  'participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('participants_event_id_idx').on(table.eventId),
    uniqueIndex('participants_event_email_key')
      .on(table.eventId, sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
    check(
      'participants_display_name_length',
      sql`char_length(${table.displayName}) between 1 and 200`,
    ),
    check(
      'participants_email_length',
      sql`${table.email} is null or char_length(${table.email}) between 3 and 320`,
    ),
  ],
);

// The two unique indexes on participant_availability are declared only in
// migration 0004 because they require NULLS NOT DISTINCT, which drizzle-orm
// 0.45.4 supports on unique() constraints but not on uniqueIndex(), and a
// unique constraint cannot be partial.
export const participantAvailability = alignSchema.table(
  'participant_availability',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    slotDate: date('slot_date'),
    slotWeekday: smallint('slot_weekday'),
    slotMinute: smallint('slot_minute'),
    status: availabilityStatusEnum('status').notNull().default('available'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('participant_availability_participant_id_idx').on(table.participantId),
    check(
      'participant_availability_exactly_one_kind',
      sql`(${table.slotDate} is not null and ${table.slotWeekday} is null) or (${table.slotDate} is null and ${table.slotWeekday} is not null)`,
    ),
    check(
      'participant_availability_weekday_range',
      sql`${table.slotWeekday} is null or ${table.slotWeekday} between 0 and 6`,
    ),
    check(
      'participant_availability_minute_range',
      sql`${table.slotMinute} is null or ${table.slotMinute} between 0 and 1439`,
    ),
  ],
);

export type AvailabilityStatus = (typeof availabilityStatusEnum.enumValues)[number];
export type Participant = InferSelectModel<typeof participants>;
export type NewParticipant = InferInsertModel<typeof participants>;
export type ParticipantAvailabilityRow = InferSelectModel<typeof participantAvailability>;
export type NewParticipantAvailability = InferInsertModel<typeof participantAvailability>;

export type ScheduleType = (typeof scheduleTypeEnum.enumValues)[number];
export type Event = InferSelectModel<typeof events>;
export type NewEvent = InferInsertModel<typeof events>;
export type EventDate = InferSelectModel<typeof eventDates>;
export type NewEventDate = InferInsertModel<typeof eventDates>;
