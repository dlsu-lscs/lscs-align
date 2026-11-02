import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  eventDates,
  events,
  participantAvailability,
  participants,
  type Database,
} from '@align/db';

import { validateSlots, type EventSchedule } from '../lib/slots.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MINUTES_IN_DAY = 1440;
const MAX_SLOTS = 2000;

const slotSchema = z.object({
  date: z.string().regex(ISO_DATE).optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  minute: z
    .number()
    .int()
    .min(0)
    .max(MINUTES_IN_DAY - 1)
    .optional(),
});

export const submitAvailabilitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z
    .string()
    .trim()
    .max(320)
    .refine((value) => value === '' || z.email().safeParse(value).success, {
      message: 'must be a valid email address',
    })
    .optional(),
  slots: z.array(slotSchema).max(MAX_SLOTS),
});

const paramsSchema = z.object({ id: z.guid() });

export type SubmitAvailabilityInput = z.infer<typeof submitAvailabilitySchema>;

interface UpsertedParticipant {
  [key: string]: unknown;
  id: string;
  inserted: boolean;
}

export function registerAvailabilityRoutes(database?: Database) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.post('/events/:id/availability', async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({
          error: 'validation_failed',
          details: [{ field: 'id', message: 'event id must be a uuid' }],
        });
      }

      const parsed = submitAvailabilitySchema.safeParse(request.body);
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

      const eventId = params.data.id;
      const payload = parsed.data;
      const email = payload.email ? payload.email : null;

      const eventRows = await database
        .select({
          scheduleType: events.scheduleType,
          slotIntervalMinutes: events.slotIntervalMinutes,
          dailyStartMinute: events.dailyStartMinute,
          dailyEndMinute: events.dailyEndMinute,
        })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      const event = eventRows[0];
      if (!event) {
        return reply.status(404).send({ error: 'event_not_found' });
      }

      const dateRows = await database
        .select({ calendarDate: eventDates.calendarDate, weekday: eventDates.weekday })
        .from(eventDates)
        .where(eq(eventDates.eventId, eventId));

      const schedule: EventSchedule = {
        scheduleType: event.scheduleType,
        slotIntervalMinutes: event.slotIntervalMinutes,
        dailyStartMinute: event.dailyStartMinute,
        dailyEndMinute: event.dailyEndMinute,
        dates: dateRows.flatMap((row) => (row.calendarDate === null ? [] : [row.calendarDate])),
        weekdays: dateRows.flatMap((row) => (row.weekday === null ? [] : [row.weekday])),
      };

      const { issues, normalized } = validateSlots(schedule, payload.slots);
      if (issues.length > 0) {
        return reply.status(400).send({ error: 'validation_failed', details: issues });
      }

      const result = await database.transaction(async (tx) => {
        const upserted = await tx.execute<UpsertedParticipant>(sql`
          insert into ${participants} (event_id, display_name, email)
          values (${eventId}, ${payload.name}, ${email})
          on conflict (event_id, lower(email)) where email is not null
          do update set display_name = excluded.display_name, updated_at = clock_timestamp()
          returning id, (xmax = 0) as inserted
        `);

        const participant = upserted.rows[0];
        if (!participant) {
          throw new Error('participant upsert returned no row');
        }

        await tx
          .delete(participantAvailability)
          .where(eq(participantAvailability.participantId, participant.id));

        if (normalized.length > 0) {
          await tx.insert(participantAvailability).values(
            normalized.map((slot) => ({
              participantId: participant.id,
              slotDate: slot.slotDate,
              slotWeekday: slot.slotWeekday,
              slotMinute: slot.slotMinute,
            })),
          );
        }

        return participant;
      });

      return reply.status(result.inserted ? 201 : 200).send({
        participant_id: result.id,
        event_id: eventId,
        name: payload.name,
        email,
        slot_count: normalized.length,
        slots: normalized.map((slot) => ({
          date: slot.slotDate,
          weekday: slot.slotWeekday,
          minute: slot.slotMinute,
        })),
      });
    });
  };
}
