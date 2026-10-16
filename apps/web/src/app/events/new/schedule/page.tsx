'use client';

import { useEventFormStore, type ScheduleType } from '@/stores/event-form-store';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';

export default function SchedulePage() {
  const scheduleType = useEventFormStore((s) => s.scheduleType);
  const setScheduleType = useEventFormStore((s) => s.setScheduleType);

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <h1 className="text-2xl font-semibold">Schedule</h1>
      <ToggleGroup
        variant="outline"
        value={[scheduleType]}
        onValueChange={(values) => {
          const next = values[0];
          if (next) setScheduleType(next as ScheduleType);
        }}
      >
        <ToggleGroupItem value="dates_and_times">Date and Time</ToggleGroupItem>
        <ToggleGroupItem value="days_of_week">Days of Week</ToggleGroupItem>
        <ToggleGroupItem value="dates_only">Dates Only</ToggleGroupItem>
      </ToggleGroup>

      <Calendar mode="multiple" className="rounded-lg border" />
    </main>
  );
}
