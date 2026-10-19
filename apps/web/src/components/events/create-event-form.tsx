'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEventFormStore } from '@/stores/event-form-store';

import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function CreateEventForm() {
  const title = useEventFormStore((s) => s.title);
  const description = useEventFormStore((s) => s.description);
  const setTitle = useEventFormStore((s) => s.setTitle);
  const setDescription = useEventFormStore((s) => s.setDescription);
  const [nameError, setNameError] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    setNameError('');

    if (title.trim().length === 0) {
      setNameError('Please enter an event name.');
      hasError = true;
    } else if (title.trim().length > 200) {
      setNameError('Event name cannot exceed 200 characters');
      hasError = true;
    }

    if (hasError) return;

    router.push('/events/new/schedule');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-[549px] space-y-5 px-4 py-6 sm:px-[34px] sm:py-[31px]"
    >
      <Field>
        <FieldLabel
          htmlFor="title"
          className="text-[28px] sm:text-[40px] sm:whitespace-nowrap leading-none tracking-tighter font-normal"
        >
          <span>
            What is your event name?
            <span className="text-red-600">*</span>
          </span>
        </FieldLabel>

        <Input
          type="text"
          id="title"
          placeholder="Event Name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-[60px] w-full rounded-[10px] border border-[#777777] px-3
                    placeholder:text-[#777777]"
        />

        {nameError && <p className="text-sm text-red-600">{nameError}</p>}
      </Field>

      <Field>
        <FieldLabel
          htmlFor="description"
          className="text-[28px] sm:text-[40px] sm:whitespace-nowrap leading-none tracking-tighter font-normal"
        >
          What is your event description?
        </FieldLabel>
        <Textarea
          id="description"
          placeholder="Event Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-[153px] w-full rounded-[10px] border border-[#777777] px-3 py-2 resize-none
                    placeholder:text-[#777777]"
        />
      </Field>

      <Button
        type="submit"
        className={`h-[50px] w-full rounded-[10px] border sm:w-[129px] ${
          title.trim().length > 0
            ? 'border-brand bg-brand text-white hover:bg-brand'
            : 'border-ink bg-transparent text-ink hover:bg-transparent'
        }`}
      >
        Next
      </Button>
    </form>
  );
}
