'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getEvent, EventNotFoundError } from '@/lib/api/events';
import Image from 'next/image';
import { Copy, X } from 'lucide-react';

export default function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  const { data, isPending, error } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEvent(slug),
    retry: false,
  });

  useEffect(() => {
    setLink(`${window.location.origin}/events/${slug}`);
  }, [slug]);

  if (isPending) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-4 text-center">
        <p className="text-[24px] text-brand leading-none tracking-tighter">
          Fetching event information...
        </p>
        <div
          role="status"
          aria-label="Loading"
          className="size-[175px] animate-spin rounded-full border-[10px] border-[#D9D9D9] border-t-brand"
        />
      </main>
    );
  }

  if (error instanceof EventNotFoundError) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-4 text-center text-brand">
        <div className="text-[24px] leading-none tracking-tighter">
          <p>This event seems to have been deleted by the organizer, or has expired.</p>
          <p>Create an event instead?</p>
        </div>
        <Link
          href="/"
          className="flex h-[50px] w-[140px] shrink-0 items-center justify-center rounded-[10px] bg-brand text-[24px] leading-none 
              tracking-tighter text-white hover:bg-brand-hover"
        >
          Create Event
        </Link>
      </main>
    );
  }

  if (error) {
    return <main className="p-4 text-center">Something went wrong. Please try again.</main>;
  }

  const handleCopy = async () => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Failed to copy link.');
    }
  };

  const shareActions = [
    {
      name: 'Messenger',
      icon: '/icons/Messenger.svg',
      url: 'https://www.messenger.com/',
      copyFirst: true,
    },
    { name: 'Discord', icon: '/icons/Discord.svg', url: 'https://discord.com/', copyFirst: true },
    { name: 'Gmail', icon: '/icons/Gmail.svg', url: 'https://mail.google.com/', copyFirst: true },
    {
      name: 'Instagram',
      icon: '/icons/Instagram.svg',
      url: 'https://www.instagram.com/',
      copyFirst: true,
    },
  ];

  const handleShare = (target: (typeof shareActions)[number]) => {
    if (target.copyFirst) void handleCopy();
    window.open(target.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <section
        className="relative w-full max-w-[543px] rounded-[10px] border border-black bg-[#F7F7E6]
                px-8 pt-24 pb-10 text-center sm:min-h-[611px]"
      >
        <Link href={`/events/${slug}`} aria-label="Close" className="absolute right-4 top-4">
          <X className="w-6 h-6 text-black stroke-1" />
        </Link>

        <h1 className="text-[28px] font-normal tracking-tighter text-black wrap-break-word sm:text-[40px]">
          {data.title}
        </h1>
        {data.description && (
          <p className="mt-2 text-[16px] font-normal tracking-tighter text-[#777777] wrap-break-word">
            {data.description}
          </p>
        )}

        <div className="mx-auto mt-10 w-full max-w-[327px] text-left">
          <div className="flex items-center justify-between">
            <p className="text-[24px] font-normal tracking-tighter text-black">
              Your shareable event link:
            </p>
            {copied && (
              <span className="text-[14px] font-normal tracking-tighter text-brand">Copied!</span>
            )}
          </div>

          <div className="relative mt-3">
            <input
              value={link}
              readOnly
              aria-label="Shareable event link"
              className="h-[50px] w-full rounded-[10px] border border-[#777777] bg-transparent 
                      py-2 pl-4 pr-12 text-[24px] font-normal tracking-tighter text-[#777777]"
            />
            <button
              type="button"
              aria-label="Copy link"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-brand"
              onClick={handleCopy}
            >
              <Copy className="h-[21px] w-[16.5px]" />
            </button>
          </div>

          {copyError && <p className="mt-2 text-[14px] tracking-tighter text-error">{copyError}</p>}

          <p className="mt-10 text-[24px] font-normal tracking-tighter text-black">Share to:</p>

          <ul className="mt-4 flex justify-between">
            {shareActions.map((target) => (
              <li key={target.name}>
                <button
                  type="button"
                  onClick={() => handleShare(target)}
                  className="flex flex-col items-center gap-1"
                >
                  <Image
                    src={target.icon}
                    alt=""
                    width={60}
                    height={60}
                    className="size-[60px] object-contain"
                  />
                  <span className="text-[16px] tracking-tighter text-[#777777]">{target.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
