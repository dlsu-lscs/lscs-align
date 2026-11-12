'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { submitAvailability } from '@/lib/api/events';
import { toSlots } from '@/lib/availability';
import { Input } from '@/components/ui/input';
import { AvailabilityGrid } from '@/components/events/availability-grid';
import { AvailabilityCalendar } from '@/components/events/availability-calendar';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

type AvailabilityFormProps = {
  header: ReactNode;
  event: {
    id: string;
    schedule_type: string;
    columns: (string | number)[];
    start_minute: number | null;
    end_minute: number | null;
    interval_minutes: number;
  };
};

export default function AvailabilityForm({ header, event }: AvailabilityFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      submitAvailability(event.id, {
        name: name.trim(),
        ...(email.trim() !== '' && { email: email.trim() }),
        slots: toSlots(selected, event.schedule_type),
      }),

    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (name.trim().length === 0) {
      setNameError('Please enter your name.');
      return;
    }

    setNameError('');

    if (selected.size === 0) return;

    mutation.mutate();
  };

  const nameBorder = nameError
    ? 'border-error'
    : name.trim() !== ''
      ? 'border-ink'
      : 'border-[#777777]';
  const emailBorder = email.trim() !== '' ? 'border-ink' : 'border-[#777777]';
  const isDatesOnly = event.schedule_type === 'dates_only';
  const hasTimes = !isDatesOnly && event.start_minute !== null && event.end_minute !== null;
  const showCalendar = event.schedule_type !== 'days_of_week';
  const datesSelection = new Set(Array.from(selected).map((key) => key.split('|')[0] ?? ''));

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`mx-auto grid w-full gap-y-6 ${showCalendar ? 'lg:grid-cols-2 lg:gap-x-16' : ''}`}
    >
      <div className="order-1 mx-auto w-full max-w-[543px] lg:order-2">
        {header}
        {nameError && <p className="mt-2 text-center text-[16px] text-error">{nameError}</p>}
      </div>

      {showCalendar && (
        <div className="order-2 lg:order-1 lg:row-span-2">
          <h2 className="text-center text-[24px] leading-[normal] font-normal tracking-tighter text-black">
            What dates are you available?
          </h2>
          <p className="mb-[18px] text-center text-[16px] leading-[normal] font-normal tracking-tighter text-[#777777]">
            Available dates for this event are highlighted gray.
          </p>

          {isDatesOnly ? (
            <AvailabilityCalendar
              eventDates={event.columns as string[]}
              selected={selected}
              setSelected={setSelected}
              submitted={submitted}
            />
          ) : (
            <AvailabilityCalendar
              eventDates={event.columns as string[]}
              selected={datesSelection}
              submitted={submitted}
              readOnly
            />
          )}
        </div>
      )}

      <div className="order-3 mx-auto w-full max-w-[543px]">
        {hasTimes && (
          <div className="mb-10">
            <h2 className="text-center text-[24px] leading-[normal] font-normal tracking-tighter text-black">
              What times are you available?
            </h2>
            <div className="mx-auto mt-3 w-full max-w-[420px]">
              <AvailabilityGrid
                schedule_type={event.schedule_type}
                columns={event.columns}
                start_minute={event.start_minute as number}
                end_minute={event.end_minute as number}
                interval_minutes={event.interval_minutes}
                selected={selected}
                setSelected={setSelected}
                submitted={submitted}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="name"
              className="text-[24px] leading-[normal] font-normal tracking-tighter text-black"
            >
              Your Name:<span className="text-error">*</span>
            </label>
            <Input
              id="name"
              placeholder="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError('');
              }}
              className={`h-[50px] w-[230px] rounded-[10px] border bg-transparent 
                text-[24px] text-ink placeholder:text-[#777777] ${nameBorder}`}
            />
          </div>

          <div className="flex items-center justify-between">
            <label
              htmlFor="email"
              className="text-[24px] leading-[normal] font-normal tracking-tighter text-black"
            >
              Your Email:
            </label>
            <Input
              type="email"
              id="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`h-[50px] w-[230px] rounded-[10px] border bg-transparent 
                text-[24px] text-ink placeholder:text-[#777777] ${emailBorder}`}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className={`mx-auto ${isDatesOnly ? 'mt-[182px]' : 'mt-16'} flex h-[50px] min-w-[129px] items-center justify-center gap-[10px] rounded-[10px] text-[24px]
          leading-[normal] font-normal tracking-tighter ${name.trim().length > 0 ? 'bg-brand text-cream' : 'border border-ink text-ink'}`}
        >
          {mutation.isPending ? 'Submitting...' : 'Submit'}
          <ArrowRight className="size-[22px]" />
        </button>

        {submitted && <p className="mt-3 text-center">Your availability has been submitted!</p>}
        {mutation.isError && (
          <p className="mt-3 text-center text-error">{mutation.error.message}</p>
        )}
      </div>
    </form>
  );
}
