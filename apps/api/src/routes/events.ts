import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { eventDates, events, type Database } from '@align/db';

import { generateSlug, isValidSlug } from '../lib/slug.ts';

const MAX_SLUG_ATTEMPTS = 5;
const MINUTES_IN_DAY = 1440;
const SUPPORTED_INTERVALS = [15, 30, 60];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasDuplicates(values: readonly unknown[]): boolean {
  return new Set(values).size !== values.length;
}

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    organizer_name: z.string().trim().min(1).max(200).optional(),
    schedule_type: z.enum(['dates_only', 'dates_and_times', 'days_of_week']),
    dates: z
      .array(z.string().regex(ISO_DATE).refine(isRealCalendarDate, 'must be a real calendar date'))
      .optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    daily_start_minute: z.number().int().min(0).max(MINUTES_IN_DAY).nullable().optional(),
    daily_end_minute: z.number().int().min(0).max(MINUTES_IN_DAY).nullable().optional(),
    time_zone: z.string().trim().min(1).max(64).optional(),
    slot_interval_minutes: z
      .number()
      .int()
      .refine((value) => SUPPORTED_INTERVALS.includes(value), {
        message: 'slot_interval_minutes must be 15, 30, or 60',
      }),
  })
  .superRefine((payload, ctx) => {
    const dates = payload.dates ?? [];
    const weekdays = payload.weekdays ?? [];
    const start = payload.daily_start_minute ?? null;
    const end = payload.daily_end_minute ?? null;

    if (payload.schedule_type === 'days_of_week') {
      if (weekdays.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['weekdays'],
          message: 'at least one weekday is required',
        });
      }
      if (hasDuplicates(weekdays)) {
        ctx.addIssue({ code: 'custom', path: ['weekdays'], message: 'weekdays must be unique' });
      }
    } else {
      if (dates.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['dates'], message: 'at least one date is required' });
      }
      if (hasDuplicates(dates)) {
        ctx.addIssue({ code: 'custom', path: ['dates'], message: 'dates must be unique' });
      }
    }

    if (payload.schedule_type === 'dates_only') {
      if (start !== null || end !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['daily_start_minute'],
          message: 'a daily time window is not allowed when only dates are chosen',
        });
      }
      return;
    }

    if (start === null || end === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['daily_start_minute'],
        message: 'a daily time window is required for this schedule type',
      });
      return;
    }

    if (end <= start) {
      ctx.addIssue({
        code: 'custom',
        path: ['daily_end_minute'],
        message: 'daily_end_minute must be greater than daily_start_minute',
      });
    }
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

function isSlugConflict(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return false;
    }
    const record = current as Record<string, unknown>;
    if (record['code'] === '23505' && record['constraint'] === 'events_public_slug_key') {
      return true;
    }
    current = record['cause'];
  }
  return false;
}

export function registerEventRoutes(database?: Database, createSlug: () => string = generateSlug) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.post('/events', async (request, reply) => {
      const parsed = createEventSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_failed',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      if (!database) {
        return reply.status(503).send({ error: 'database_unavailable' });
      }

      const payload = parsed.data;
      const usesWeekdays = payload.schedule_type === 'days_of_week';

      const db = database;
      const insertEvent = async () =>
        db.transaction(async (tx) => {
          const inserted = await tx
            .insert(events)
            .values({
              publicSlug: createSlug(),
              title: payload.title,
              description: payload.description ? payload.description : null,
              organizerName: payload.organizer_name ? payload.organizer_name : null,
              scheduleType: payload.schedule_type,
              slotIntervalMinutes: payload.slot_interval_minutes,
              dailyStartMinute: payload.daily_start_minute ?? null,
              dailyEndMinute: payload.daily_end_minute ?? null,
              ...(payload.time_zone === undefined ? {} : { timeZone: payload.time_zone }),
            })
            .returning();

          const event = inserted[0];
          if (!event) {
            throw new Error('event insert returned no row');
          }

          const children = usesWeekdays
            ? (payload.weekdays ?? []).map((weekday) => ({ eventId: event.id, weekday }))
            : (payload.dates ?? []).map((calendarDate) => ({ eventId: event.id, calendarDate }));

          if (children.length > 0) {
            await tx.insert(eventDates).values(children);
          }

          return event;
        });

      let created;
      for (let attempt = 1; ; attempt += 1) {
        try {
          created = await insertEvent();
          break;
        } catch (error) {
          if (attempt >= MAX_SLUG_ATTEMPTS || !isSlugConflict(error)) {
            throw error;
          }
        }
      }

      return reply.status(201).send({
        id: created.id,
        public_slug: created.publicSlug,
        title: created.title,
        description: created.description,
        organizer_name: created.organizerName,
        schedule_type: created.scheduleType,
        slot_interval_minutes: created.slotIntervalMinutes,
        daily_start_minute: created.dailyStartMinute,
        daily_end_minute: created.dailyEndMinute,
        time_zone: created.timeZone,
        dates: usesWeekdays ? [] : (payload.dates ?? []),
        weekdays: usesWeekdays ? (payload.weekdays ?? []) : [],
        created_at: created.createdAt.toISOString(),
      });
    });

    app.get('/events/:slug', async (request, reply) => {
      const { slug } = request.params as { slug: string };

      if (!isValidSlug(slug)) {
        return reply.status(404).send({ error: 'event_not_found' });
      }

      if (!database) {
        return reply.status(503).send({ error: 'database_unavailable' });
      }

      const found = await database
        .select({
          id: events.id,
          publicSlug: events.publicSlug,
          title: events.title,
          description: events.description,
          organizerName: events.organizerName,
          scheduleType: events.scheduleType,
          slotIntervalMinutes: events.slotIntervalMinutes,
          dailyStartMinute: events.dailyStartMinute,
          dailyEndMinute: events.dailyEndMinute,
          timeZone: events.timeZone,
        })
        .from(events)
        .where(eq(events.publicSlug, slug))
        .limit(1);

      const event = found[0];
      if (!event) {
        return reply.status(404).send({ error: 'event_not_found' });
      }

      const scheduleRows = await database
        .select({ calendarDate: eventDates.calendarDate, weekday: eventDates.weekday })
        .from(eventDates)
        .where(eq(eventDates.eventId, event.id))
        .orderBy(eventDates.calendarDate, eventDates.weekday);

      return reply.status(200).send({
        id: event.id,
        public_slug: event.publicSlug,
        title: event.title,
        description: event.description,
        organizer: event.organizerName === null ? null : { name: event.organizerName },
        schedule_type: event.scheduleType,
        dates: scheduleRows.flatMap((row) => (row.calendarDate === null ? [] : [row.calendarDate])),
        weekdays: scheduleRows.flatMap((row) => (row.weekday === null ? [] : [row.weekday])),
        daily_start_minute: event.dailyStartMinute,
        daily_end_minute: event.dailyEndMinute,
        time_zone: event.timeZone,
        slot_interval_minutes: event.slotIntervalMinutes,
      });
    });
  };
}
