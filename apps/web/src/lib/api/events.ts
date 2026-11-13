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

export async function createEvent(
  payload: CreateEventPayload,
): Promise<{ public_slug?: string; slug?: string }> {
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
        body?.error ??
        body?.message ??
        `HTTP error! Status: ${response.status}`,
    );
  }

  return (await response.json()) as { public_slug?: string; slug?: string };
}

export type EventDetails = {
  id: string;
  public_slug: string;
  title: string;
  description: string | null;
  organizer: { name: string } | null;
  schedule_type: 'dates_only' | 'dates_and_times' | 'days_of_week';
  dates: string[];
  weekdays: number[];
  daily_start_minute: number | null;
  daily_end_minute: number | null;
  time_zone: string;
  slot_interval_minutes: number;
};

export class EventNotFoundError extends Error {}

export async function getEvent(slug: string): Promise<EventDetails> {
  const response = await fetch(`/api/events/${encodeURIComponent(slug)}`);

  if (response.status === 404) throw new EventNotFoundError();
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

  return (await response.json()) as EventDetails;
}

export type SubmitAvailabilityPayload = {
  name: string;
  email?: string;
  slots: { date?: string; weekday?: number; minute?: number }[];
};

export async function submitAvailability(
  eventId: string,
  payload: SubmitAvailabilityPayload,
): Promise<void> {
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
        body?.error ??
        body?.message ??
        `HTTP error! Status: ${response.status}`,
    );
  }
}
