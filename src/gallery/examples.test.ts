import { describe, expect, it } from 'vitest';
import { parseDoc } from '@/doc/schema';
import { compile } from '@/engine/compile';
import { examples } from './examples';

describe('gallery examples', () => {
  for (const ex of examples) {
    it(`${ex.slug} is a valid document that compiles without errors`, () => {
      const doc = parseDoc(ex.build());
      expect([...compile(doc).errors.values()]).toEqual([]);
    });
  }
});
