'use client';

import { useMutation } from '@tanstack/react-query';
import { createEvent } from '@/lib/api/events';
import { useState } from 'react';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function CreateEventForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');

  const { mutate, isPending, isSuccess, isError, error } = useMutation({
    mutationFn: ({ title, description }: { title: string; description: string }) =>
      createEvent(title, description),
  });

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

    mutate(
      { title, description },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
        },
      },
    );
  };

  return (
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

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending ? 'Creating...' : 'Next'}
      </Button>

      {isSuccess && <p className="text-sm text-green-600">Event created!</p>}
      {isError && <p className="text-sm text-red-600">Error: {error.message}</p>}
    </form>
  );
}
