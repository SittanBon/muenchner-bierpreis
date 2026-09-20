import { describe, it, expect } from 'vitest';
import { de, en } from './translations';

// Flattens a translation tree to { 'a.b.c': 'text' }.
const flat = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]]
));
const stripPlural = (key) => key.replace(/_(one|other)$/, '');

describe('translations', () => {
  it('German and English define exactly the same keys', () => {
    const deKeys = new Set(flat(de).map(([k]) => stripPlural(k)));
    const enKeys = new Set(flat(en).map(([k]) => stripPlural(k)));
    expect([...deKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !deKeys.has(k))).toEqual([]);
  });

  // Serving sizes are generated from constants/servingSizes.js ("0,50L" / "0.50L").
  // The canonical labels are two-decimal ("0,50L", "0,33L", "1,00L"); a hand-typed
  // short form — "0,5L", "0.4L", "1L" — is what drifts from them.
  it('contains no hand-typed serving sizes', () => {
    const stray = /(?<![\d.,])(0[.,][45]|1)\s?L\b(?![a-z])/;
    const offenders = [...flat(de), ...flat(en)].filter(([, text]) => stray.test(text)).map(([k, text]) => `${k}: ${text}`);
    expect(offenders).toEqual([]);
  });
});
