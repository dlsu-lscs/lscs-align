export type CreateEventPayload = {
  title: string;
  description: string;
  schedule_type: 'dates_only' | 'dates_and_times' | 'days_of_week';
  dates: string[];
  weekdays: number[];
  daily_start_minute: number | null;
  daily_end_minute: number | null;
  time_zone: string;
  slot_interval_minutes: number;
};

export async function createEvent(payload: CreateEventPayload) {
  const response = await fetch('/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new Error(body?.error ?? body?.message ?? `HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
