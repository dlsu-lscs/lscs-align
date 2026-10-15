'use client';

import { useState } from 'react';
import { useEventFormStore } from '@/stores/event-form-store';
import { useRouter } from 'next/navigation';

import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function NewEventPage() {
  const router = useRouter();
  const title = useEventFormStore((s) => s.title);
  const description = useEventFormStore((s) => s.description);
  const setTitle = useEventFormStore((s) => s.setTitle);
  const setDescription = useEventFormStore((s) => s.setDescription);
  const [nameError, setNameError] = useState('');

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
    <main className="mx-auto w-full max-w-xl p-4">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field>
          <FieldLabel htmlFor="title" className="text-2xl font-semibold">
            What is your event name?
            <span className="text-red-600">*</span>
          </FieldLabel>

          {nameError && <p className="text-sm text-red-600">{nameError}</p>}

          <Input
            type="text"
            id="title"
            placeholder="Event Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg px-3 py-2"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="description" className="text-2xl font-semibold">
            What is your event description?
          </FieldLabel>
          <Textarea
            id="description"
            placeholder="Event Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg px-3 py-2"
          />
        </Field>

        <Button type="submit" className="w-full sm:w-auto">
          Next
        </Button>
      </form>
    </main>
  );
}
