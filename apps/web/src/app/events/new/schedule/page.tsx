'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createEvent } from '@/lib/api/events';
import { useEventFormStore, type ScheduleType } from '@/stores/event-form-store';

import { toMinutes } from '@/lib/time';
import { format } from 'date-fns';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulePage() {
  const router = useRouter();

  const title = useEventFormStore((s) => s.title);
  const description = useEventFormStore((s) => s.description);
  const resetForm = useEventFormStore((s) => s.reset);
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

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: createEvent,
  });

  const handleNext = () => {
    let hasError = false;
    setDateError('');
    setTimeError('');

    if (scheduleType === 'days_of_week') {
      if (selectedWeekdays.length === 0) {
        setDateError('Please select a date/dates.');
        hasError = true;
      }
    } else if (selectedDates.length === 0) {
      setDateError('Please select a date/dates.');
      hasError = true;
    }

    if (scheduleType !== 'dates_only' && endTime <= startTime) {
      setTimeError('Please enter possible times.');
      hasError = true;
    }

    if (hasError) return;

    const hasTimes = scheduleType !== 'dates_only';

    mutate(
      {
        title,
        description,
        schedule_type: scheduleType,
        dates:
          scheduleType === 'days_of_week' ? [] : selectedDates.map((d) => format(d, 'yyyy-MM-dd')),
        weekdays: scheduleType === 'days_of_week' ? selectedWeekdays : [],
        daily_start_minute: hasTimes ? toMinutes(startTime) : null,
        daily_end_minute: hasTimes ? toMinutes(endTime) : null,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      {
        onSuccess: (data) => {
          console.log('Event created:', data);
          resetForm();
          router.push('/');
        },
      },
    );
  };

  const hasSelection =
    scheduleType === 'days_of_week' ? selectedWeekdays.length > 0 : selectedDates.length > 0;

  return (
    <main className="mx-auto w-full max-w-[549px] p-4">
      <div className="px-2 text-center leading-none tracking-tighter font-normal">
        <h1 className="text-[28px] text-ink wrap-break-word sm:text-[40px]">{title}</h1>
        {description && (
          <p className="mt-[6px] text-[16px] text-[#777777] wrap-break-word">{description}</p>
        )}
      </div>
      <ToggleGroup
        variant="outline"
        spacing={5}
        className="mt-5 flex w-full gap-5"
        value={[scheduleType]}
        onValueChange={(values) => {
          const next = values[0];
          if (next) setScheduleType(next as ScheduleType);
        }}
      >
        {[
          ['dates_only', 'Dates Only'],
          ['dates_and_times', 'Dates & Times'],
          ['days_of_week', 'Recurring Days'],
        ].map(([value, label]) => (
          <ToggleGroupItem
            key={value}
            value={value!}
            className="h-[50px] flex-1 rounded-[10px]! border border-ink text-[24px] leading-none
                           tracking-tighter text-ink aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-white"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {dateError && (
        <p className="mt-2 text-center text-[16px] leading-none font-normal tracking-tighter text-error">
          {dateError}
        </p>
      )}

      {(scheduleType === 'dates_only' || scheduleType === 'dates_and_times') && (
        <Calendar
          mode="multiple"
          className="mx-auto mt-3 w-full max-w-[533px] [--cell-size:--spacing(14)]"
          classNames={{
            day_button: `rounded-[10px] border-0! ring-0! outline-none! 
              hover:bg-brand-hover! hover:text-white! 
              data-[selected-single=true]:bg-brand! data-[selected-single=true]:text-white!
              aria-selected:bg-brand! aria-selected:text-white!`,
            weekdays: 'flex',
            weekday: 'flex-1 text-center text-[24px] text-ink font-normal',
            caption_label: 'text-[24px] text-ink',
            today: 'bg-transparent',
            disabled: 'text-[#777777] opacity-100',
          }}
          formatters={{ formatWeekdayName: (date) => format(date, 'EEE') }}
          disabled={{ before: new Date() }}
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

      {timeError && <p className="mt-2 text-sm text-error">{timeError}</p>}

      <Button
        type="button"
        onClick={handleNext}
        disabled={isPending}
        className={`mx-auto mt-6 block h-[50px] w-[129px] rounded-[10px] border text-[24px] leading-none tracking-tighter ${
          hasSelection
            ? 'border-brand bg-brand text-white hover:bg-brand'
            : 'border-ink bg-transparent text-ink hover:bg-transparent'
        }`}
      >
        {isPending ? 'Creating...' : 'Next'}
      </Button>
      {isError && <p className="mt-2 text-sm text-error">Error: {error.message}</p>}
    </main>
  );
}
