export type ScheduleKind = 'dates_only' | 'dates_and_times' | 'days_of_week';

export interface EventSchedule {
  readonly scheduleType: ScheduleKind;
  readonly slotIntervalMinutes: number;
  readonly dailyStartMinute: number | null;
  readonly dailyEndMinute: number | null;
  readonly dates: readonly string[];
  readonly weekdays: readonly number[];
}

export interface SubmittedSlot {
  readonly date?: string | undefined;
  readonly weekday?: number | undefined;
  readonly minute?: number | undefined;
}

export interface SlotIssue {
  readonly field: string;
  readonly message: string;
}

export interface NormalizedSlot {
  readonly slotDate: string | null;
  readonly slotWeekday: number | null;
  readonly slotMinute: number | null;
}

function slotKey(slot: NormalizedSlot): string {
  return `${slot.slotDate ?? ''}|${slot.slotWeekday ?? ''}|${slot.slotMinute ?? ''}`;
}

export function validateSlots(
  schedule: EventSchedule,
  slots: readonly SubmittedSlot[],
): { issues: SlotIssue[]; normalized: NormalizedSlot[] } {
  const issues: SlotIssue[] = [];
  const normalized: NormalizedSlot[] = [];
  const seen = new Set<string>();

  const usesWeekdays = schedule.scheduleType === 'days_of_week';
  const usesTimes = schedule.scheduleType !== 'dates_only';
  const allowedDates = new Set(schedule.dates);
  const allowedWeekdays = new Set(schedule.weekdays);

  slots.forEach((slot, index) => {
    const field = `slots.${index}`;
    const hasDate = slot.date !== undefined;
    const hasWeekday = slot.weekday !== undefined;
    const hasMinute = slot.minute !== undefined;

    if (usesWeekdays) {
      if (!hasWeekday) {
        issues.push({ field, message: 'weekday is required for a recurring event' });
        return;
      }
      if (hasDate) {
        issues.push({ field, message: 'date is not allowed for a recurring event' });
        return;
      }
      if (!allowedWeekdays.has(slot.weekday as number)) {
        issues.push({ field, message: 'weekday is not part of this event' });
        return;
      }
    } else {
      if (!hasDate) {
        issues.push({ field, message: 'date is required for this event' });
        return;
      }
      if (hasWeekday) {
        issues.push({ field, message: 'weekday is not allowed for this event' });
        return;
      }
      if (!allowedDates.has(slot.date as string)) {
        issues.push({ field, message: 'date is not part of this event' });
        return;
      }
    }

    if (!usesTimes) {
      if (hasMinute) {
        issues.push({ field, message: 'minute is not allowed when the event has no time window' });
        return;
      }
    } else {
      if (!hasMinute) {
        issues.push({ field, message: 'minute is required for this event' });
        return;
      }
      const start = schedule.dailyStartMinute;
      const end = schedule.dailyEndMinute;
      if (start === null || end === null) {
        issues.push({ field, message: 'event is missing its daily time window' });
        return;
      }
      const minute = slot.minute as number;
      if (minute < start || minute + schedule.slotIntervalMinutes > end) {
        issues.push({ field, message: "minute is outside the event's daily time window" });
        return;
      }
      if ((minute - start) % schedule.slotIntervalMinutes !== 0) {
        issues.push({
          field,
          message: `minute must align to the event's ${schedule.slotIntervalMinutes}-minute interval`,
        });
        return;
      }
    }

    const entry: NormalizedSlot = {
      slotDate: usesWeekdays ? null : (slot.date as string),
      slotWeekday: usesWeekdays ? (slot.weekday as number) : null,
      slotMinute: usesTimes ? (slot.minute as number) : null,
    };

    const key = slotKey(entry);
    if (seen.has(key)) {
      issues.push({ field, message: 'duplicate slot' });
      return;
    }
    seen.add(key);
    normalized.push(entry);
  });

  return issues.length > 0 ? { issues, normalized: [] } : { issues, normalized };
}
