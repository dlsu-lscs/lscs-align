import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { title, description } = (await request.json()) as {
    title?: string;
    description?: string;
  };

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 1500);
  });

  const id = crypto.randomUUID();
  return NextResponse.json({ id, title, description }, { status: 201 });
}
