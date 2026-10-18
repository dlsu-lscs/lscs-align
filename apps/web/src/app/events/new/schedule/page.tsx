'use client';

import { useState } from 'react';
import { useEventFormStore, type ScheduleType } from '@/stores/event-form-store';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulePage() {
  const scheduleType = useEventFormStore((s) => s.scheduleType);
  const setScheduleType = useEventFormStore((s) => s.setScheduleType);
  const selectedDates = useEventFormStore((s) => s.selectedDates);
  const setSelectedDates = useEventFormStore((s) => s.setSelectedDates);
  const selectedWeekdays = useEventFormStore((s) => s.selectedWeekdays);
  const setSelectedWeekdays = useEventFormStore((s) => s.setSelectedWeekdays);
  const startTime = useEventFormStore((s) => s.startTime);
  const setStartTime = useEventFormStore((s) => s.setStartTime);
  const endTime = useEventFormStore((s) => s.endTime);
  const setEndTime = useEventFormStore((s) => s.setEndTime);

  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');

  const handleNext = () => {
    let hasError = false;
    setDateError('');
    setTimeError('');

    if (scheduleType === 'days_of_week') {
      if (selectedWeekdays.length === 0 || selectedDates.length === 0) {
        setDateError('Please select a date/dates.');
        hasError = true;
      }
    }

    if (scheduleType !== 'dates_only' && endTime <= startTime) {
      setTimeError('Please enter possible times.');
      hasError = true;
    }

    if (hasError) return;

    console.log({ scheduleType, selectedDates, selectedWeekdays, startTime, endTime });
  };

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

      {dateError && <p className="mt-2 text-sm text-red-600">{dateError}</p>}

      {scheduleType !== 'dates_only' && (
        <div className="mt-4 flex gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="start-time">Start Time</label>
            <Input
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="end-time">End Time</label>
            <Input
              id="end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
      )}

      {timeError && <p className="mt-2 text-sm text-red-600">{timeError}</p>}

      <Button type="button" className="mt-6" onClick={handleNext}>
        Next
      </Button>
    </main>
  );
}
