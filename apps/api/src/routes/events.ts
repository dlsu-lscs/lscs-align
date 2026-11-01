import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { eventDates, events, type Database } from '@align/db';

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

export function registerEventRoutes(database?: Database) {
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

      const created = await database.transaction(async (tx) => {
        const inserted = await tx
          .insert(events)
          .values({
            title: payload.title,
            description: payload.description ? payload.description : null,
            scheduleType: payload.schedule_type,
            slotIntervalMinutes: payload.slot_interval_minutes,
            dailyStartMinute: payload.daily_start_minute ?? null,
            dailyEndMinute: payload.daily_end_minute ?? null,
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

      return reply.status(201).send({
        id: created.id,
        title: created.title,
        description: created.description,
        schedule_type: created.scheduleType,
        slot_interval_minutes: created.slotIntervalMinutes,
        daily_start_minute: created.dailyStartMinute,
        daily_end_minute: created.dailyEndMinute,
        dates: usesWeekdays ? [] : (payload.dates ?? []),
        weekdays: usesWeekdays ? (payload.weekdays ?? []) : [],
        created_at: created.createdAt.toISOString(),
      });
    });
  };
}
