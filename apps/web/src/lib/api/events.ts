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

export async function createEvent(payload: CreateEventPayload): Promise<{ slug: string }> {
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
      details?: { field: string; message: string }[];
    } | null;
    throw new Error(
      body?.details?.[0]?.message ??
        body?.message ??
        body?.error ??
        `HTTP error! Status: ${response.status}`,
    );
  }

  return (await response.json()) as { slug: string };
}
