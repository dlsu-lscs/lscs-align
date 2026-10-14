'use client';

import { useMutation } from '@tanstack/react-query';
import { createEvent } from '@/lib/api/events';
import { useState } from 'react';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [descError, setDescError] = useState('');

  const { mutate, isPending, isSuccess, isError, error } = useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      createEvent(name, description),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    setNameError('');
    setDescError('');

    if (name.trim().length === 0) {
      setNameError('Event name is required');
      hasError = true;
    } else if (name.trim().length > 50) {
      setNameError('Event name cannot exceed 50 characters');
      hasError = true;
    }

    if (description.trim().length > 100) {
      setDescError('Event description cannot exceed 100 characters');
      hasError = true;
    }

    if (hasError) return;

    mutate(
      { name, description },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
        },
      },
    );
  };

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <form onSubmit={handleSubmit} className="space-y-5">
        <h1 className="text-2xl font-semibold">Create Event</h1>

        <Field>
          <FieldLabel htmlFor="name">Event Name:</FieldLabel>
          <Input
            type="text"
            id="name"
            placeholder="Event Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg px-3 py-2"
          />
          <FieldDescription>Max 50 characters</FieldDescription>

          {nameError && <p className="text-sm text-red-600">{nameError}</p>}
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Event Description: </FieldLabel>
          <Textarea
            id="description"
            placeholder="Event Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg px-3 py-2"
          />
          {descError && <p className="text-sm text-red-600">{descError}</p>}
        </Field>

        <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Event'}
        </Button>

        {isSuccess && <p className="text-sm text-green-600">Event created!</p>}
        {isError && <p className="text-sm text-red-600">Error: {error.message}</p>}
      </form>
    </main>
  );
}
