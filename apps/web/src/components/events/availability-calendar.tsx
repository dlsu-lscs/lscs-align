'use client';

import type { Dispatch, SetStateAction } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';

type AvailabilityCalendarProps = {
  eventDates: string[];
  selected: Set<string>;
  setSelected?: Dispatch<SetStateAction<Set<string>>>;
  submitted: boolean;
  readOnly?: boolean;
};

export function AvailabilityCalendar({
  eventDates,
  selected,
  setSelected,
  submitted,
  readOnly = false,
}: AvailabilityCalendarProps) {
  const eventDays = eventDates.map((d) => parseISO(d));
  const selectedDays = Array.from(selected).map((d) => parseISO(d));

  return (
    <Calendar
      mode="multiple"
      selected={selectedDays}
      onSelect={(days) => {
        if (readOnly || !setSelected) return;
        setSelected(new Set((days ?? []).map((d) => format(d, 'yyyy-MM-dd'))));
      }}
      disabled={(date) => submitted || !eventDates.includes(format(date, 'yyyy-MM-dd'))}
      {...(eventDays[0] && { defaultMonth: eventDays[0] })}
      modifiers={{ eventDate: eventDays }}
      modifiersClassNames={{ eventDate: '[&>button]:bg-[#C9C9C9]' }}
      formatters={{ formatWeekdayName: (date) => format(date, 'EEE') }}
      className="[--cell-size:69px]"
      classNames={{
        day_button: `h-[68px] rounded-[10px] border-0! ring-0! outline-none!
              hover:bg-brand-hover! hover:text-white!
              data-[selected-single=true]:bg-brand! data-[selected-single=true]:text-white!
              aria-selected:bg-brand! aria-selected:text-white!`,
        weekdays: 'flex',
        weekday: 'flex-1 text-center text-[24px] text-ink font-normal',
        caption_label: 'text-[24px] text-ink',
        disabled: 'text-[#777777] opacity-100',
      }}
    />
  );
}
