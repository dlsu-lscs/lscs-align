import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_SLUG_LENGTH, generateSlug, isValidSlug } from '../src/lib/slug.ts';

test('a generated slug has the default length and a url-safe alphabet', () => {
  for (let i = 0; i < 200; i += 1) {
    const slug = generateSlug();
    assert.equal(slug.length, DEFAULT_SLUG_LENGTH);
    assert.match(slug, /^[A-Za-z0-9]+$/);
  }
});

test('a generated slug always satisfies the database constraint', () => {
  for (let i = 0; i < 200; i += 1) {
    assert.ok(isValidSlug(generateSlug()), 'must match the events_public_slug_format CHECK');
  }
});

test('an explicit length is honoured across the supported range', () => {
  for (const length of [8, 12, 24]) {
    assert.equal(generateSlug(length).length, length);
  }
});

test('lengths outside the supported range are rejected', () => {
  for (const bad of [7, 25, 0, -1, 9.5, Number.NaN]) {
    assert.throws(() => generateSlug(bad), /slug length/);
  }
});

test('slugs are distinct across many generations', () => {
  const seen = new Set();
  for (let i = 0; i < 20000; i += 1) {
    seen.add(generateSlug());
  }
  assert.equal(seen.size, 20000, 'no collisions expected at this volume');
});

test('character distribution shows no modulo bias', () => {
  const counts = new Map();
  const draws = 300000;
  for (let i = 0; i < draws / 3; i += 1) {
    for (const character of generateSlug(9).slice(0, 3)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }

  assert.equal(counts.size, 62, 'every alphabet character should appear');

  const expected = draws / 62;
  const chiSquare = [...counts.values()].reduce(
    (total, observed) => total + (observed - expected) ** 2 / expected,
    0,
  );
  // 61 degrees of freedom; the p=0.001 critical value is about 103.4.
  assert.ok(chiSquare < 103.4, `chi-square ${chiSquare.toFixed(1)} suggests bias`);
});

test('isValidSlug matches the database CHECK exactly', () => {
  for (const good of ['sUp7Rtbu1', 'abcdefgh', 'a-b_c1234', 'A'.repeat(24)]) {
    assert.ok(isValidSlug(good), good);
  }
  for (const bad of [
    'abc1234',
    'A'.repeat(25),
    '',
    'abc/1234',
    'abc 1234',
    'abc+1234',
    'abc.1234',
  ]) {
    assert.ok(!isValidSlug(bad), bad);
  }
});
