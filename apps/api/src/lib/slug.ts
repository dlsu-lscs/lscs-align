import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_PATTERN = /^[A-Za-z0-9_-]{8,24}$/;
const MIN_LENGTH = 8;
const MAX_LENGTH = 24;

export const DEFAULT_SLUG_LENGTH = 9;

// 256 is not a multiple of 62, so bytes at or above this cutoff are discarded
// rather than folded with `%`, which would over-represent the first four letters.
const UNBIASED_CUTOFF = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

export function generateSlug(length: number = DEFAULT_SLUG_LENGTH): string {
  if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    throw new Error(`slug length must be an integer from ${MIN_LENGTH} to ${MAX_LENGTH}`);
  }

  let slug = '';
  while (slug.length < length) {
    for (const byte of randomBytes(length - slug.length + 8)) {
      if (byte >= UNBIASED_CUTOFF) continue;
      slug += ALPHABET.charAt(byte % ALPHABET.length);
      if (slug.length === length) break;
    }
  }
  return slug;
}

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
