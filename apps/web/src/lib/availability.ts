export function buildSlotMinutes(
  startMinute: number,
  endMinute: number,
  intervalMinutes: number,
): number[] {
  if (intervalMinutes <= 0) return [];

  const slots: number[] = [];

  for (let minute = startMinute; minute < endMinute; minute += intervalMinutes) {
    slots.push(minute);
  }

  return slots;
}

export type Slot = { date?: string; weekday?: number; minute?: number };

export function toSlots(selected: Set<string>, scheduleType: string): Slot[] {
  if (scheduleType === 'dates_only') {
    return Array.from(selected).map((date) => ({ date }));
  }

  return Array.from(selected).map((key) => {
    const [column, minute] = key.split('|');
    if (column === undefined || minute === undefined) {
      throw new Error(`Invalid slot key: ${key}`);
    }

    if (scheduleType === 'days_of_week') {
      return { weekday: Number(column), minute: Number(minute) };
    }

    return { date: column, minute: Number(minute) };
  });
}

export function slotKey(column: string | number, minute: number): string {
  return `${column}|${minute}`;
}

export function getColumns(event: {
  schedule_type: string;
  dates: string[];
  weekdays: number[];
}): (string | number)[] {
  return event.schedule_type === 'days_of_week' ? event.weekdays : event.dates;
}
