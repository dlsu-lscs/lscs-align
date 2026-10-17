'use client';

import { useEventFormStore, type ScheduleType } from '@/stores/event-form-store';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulePage() {
  const scheduleType = useEventFormStore((s) => s.scheduleType);
  const setScheduleType = useEventFormStore((s) => s.setScheduleType);
  const selectedDates = useEventFormStore((s) => s.selectedDates);
  const setSelectedDates = useEventFormStore((s) => s.setSelectedDates);
  const selectedWeekdays = useEventFormStore((s) => s.selectedWeekdays);
  const setSelectedWeekdays = useEventFormStore((s) => s.setSelectedWeekdays);

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

      {(scheduleType === 'dates_only' || scheduleType === 'dates_and_times') && (
        <Calendar
          mode="multiple"
          className="rounded-lg border"
          selected={selectedDates}
          onSelect={(dates) => setSelectedDates(dates ?? [])}
        />
      )}

      {scheduleType === 'days_of_week' && (
        <ToggleGroup
          variant="outline"
          multiple
          value={selectedWeekdays.map(String)}
          onValueChange={(values) => setSelectedWeekdays(values.map(Number))}
        >
          {WEEKDAYS.map((label, index) => (
            <ToggleGroupItem key={label} value={String(index)}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </main>
  );
}
