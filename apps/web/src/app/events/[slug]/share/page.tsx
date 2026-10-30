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
    <main className="p-4 text-center">
      <p>Share Link: {link}</p>
      <Button type="button" 
                className="mt-6 rounded-[10px] border text-[24px] " 
                onClick={handleCopy}>
        Copy Link
      </Button>

      {copied && <p className="text-green-600">Link copied to clipboard successfully!</p>}
      {copyError && <p className="text-error">{copyError}</p>}
    </main>
  );
}
