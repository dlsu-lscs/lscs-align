'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEvent, EventNotFoundError } from '@/lib/api/events';
import { formatMinutes } from '@/lib/time';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SCHEDULE_LABELS = {
  dates_only: 'Dates Only',
  dates_and_times: 'Dates & Times',
  days_of_week: 'Recurring Days',
};

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const { data, isPending, error } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEvent(slug),
    retry: false,
  });

  if (isPending) {
    return (
      <main className="p-4">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
      </main>
    );
  }

  if (error instanceof EventNotFoundError) {
    return <main className="p-4 text-center">Event not found</main>;
  }

  if (error) {
    return <main className="p-4 text-center">Something went wrong. Please try again.</main>;
  }

  const gridAvail = {
    schedule_type: data.schedule_type,
    dates: data.dates,
    weekdays: data.weekdays,
    start_minute: data.daily_start_minute,
    end_minute: data.daily_end_minute,
    slot_interval_minutes: data.slot_interval_minutes,
    time_zone: data.time_zone,
  };

  return (
    <main className="p-4 text-center">
      <h1 className="text-2xl font-semibold">{data.title}</h1>
      {data.description && <p>{data.description}</p>}

      <p>{SCHEDULE_LABELS[data.schedule_type]}</p>

      {data.schedule_type === 'days_of_week' ? (
        <p>{data.weekdays.map((days) => WEEKDAYS[days]).join(', ')}</p>
      ) : (
        <p>{data.dates.join(', ')}</p>
      )}

      {data.daily_start_minute !== null && data.daily_end_minute !== null && (
        <p>
          {formatMinutes(data.daily_start_minute)} to {formatMinutes(data.daily_end_minute)}
        </p>
      )}

      <p>{data.slot_interval_minutes} minute slots</p>

      {data.organizer && <p>Organized by {data.organizer.name}</p>}

      <div data-grid-avail={JSON.stringify(gridAvail)} hidden />
    </main>
  );
}
