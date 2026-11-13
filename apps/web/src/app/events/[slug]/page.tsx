'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEvent, EventNotFoundError } from '@/lib/api/events';
import Link from 'next/link';
import { getColumns } from '@/lib/availability';
import AvailabilityForm from '@/components/events/availability-form';

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const { data, isPending, error } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEvent(slug),
    retry: false,
  });

  if (isPending) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-4 text-center">
        <p className="text-[24px] text-brand leading-none tracking-tighter">
          Fetching event information...
        </p>
        <div
          role="status"
          aria-label="Loading"
          className="size-[175px] animate-spin rounded-full border-[10px] border-[#D9D9D9] border-t-brand"
        />
      </main>
    );
  }

  if (error instanceof EventNotFoundError) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-4 text-center text-brand">
        <div className="text-[24px] leading-none tracking-tighter">
          <p>This event seems to have been deleted by the organizer, or has expired.</p>
          <p>Create an event instead?</p>
        </div>
        <Link
          href="/"
          className="flex h-[50px] w-[140px] shrink-0 items-center justify-center rounded-[10px] bg-brand text-[24px] leading-none 
              tracking-tighter text-white hover:bg-brand-hover"
        >
          Create Event
        </Link>
      </main>
    );
  }

  if (error) {
    return <main className="p-4 text-center">Something went wrong. Please try again.</main>;
  }

  return (
    <main className="p-4">
      <div className="mx-auto w-full max-w-[1100px]">
        <AvailabilityForm
          header={
            <>
              <h1 className="mx-auto max-w-[533px] text-[40px] font-normal leading-[normal] tracking-tighter wrap-break-word text-ink text-center">
                {data.title}
              </h1>

              {data.description && (
                <p className="mx-auto mt-1.5 max-w-[533px] text-[16px] font-normal leading-[normal] tracking-tighter wrap-break-word text-[#777777] text-center">
                  {data.description}
                </p>
              )}

              {data.organizer && (
                <p className="mt-1 text-[16px] font-normal leading-[normal] tracking-tighter text-[#777777] text-center">
                  Event Organizer: {data.organizer.name}
                </p>
              )}
            </>
          }
          event={{
            id: data.id,
            schedule_type: data.schedule_type,
            columns: getColumns({
              schedule_type: data.schedule_type,
              dates: data.dates ?? [],
              weekdays: data.weekdays ?? [],
            }),
            start_minute: data.daily_start_minute,
            end_minute: data.daily_end_minute,
            interval_minutes: data.slot_interval_minutes,
          }}
        />
      </div>
    </main>
  );
}
