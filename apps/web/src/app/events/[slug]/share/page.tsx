'use client';

import { use, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    setLink(`${window.location.origin}/events/${slug}`);
  }, [slug]);

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

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <section
        className="relative w-full max-w-[543px] rounded-[10px] border border-black bg-[#F7F7E6]
                px-8 py-10 text-center sm:min-h-[611px]"
      >
        <div className="flex items-center justify-between">
          <p className="text-[24px] font-normal tracking-tighter text-black">
            Your shareable event link:
          </p>
          {copied && (
            <span className="text-[14px] font-normal tracking-tighter text-brand">Copied!</span>
          )}
        </div>

        <p className="mt-3 break-all text-[24px] tracking-tighter text-[#777777]">{link}</p>
        <Button
          type="button"
          className="mt-6 rounded-[10px] border border-brand bg-brand text-[24px] text-white hover:bg-brand"
          onClick={handleCopy}
        >
          Copy Link
        </Button>

        {copyError && <p className="mt-2 text-error">{copyError}</p>}
      </section>
    </main>
  );
}
