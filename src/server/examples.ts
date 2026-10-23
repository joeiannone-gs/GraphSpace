import fs from 'node:fs';
import path from 'node:path';
import { migrate } from '@/doc/migrate';
import type { ProjectDoc } from '@/doc/types';
import { getExample } from '@/gallery/examples';

/** An example's document, with pretrained weights when public/examples/<slug>.json exists. */
export function exampleDoc(slug: string): ProjectDoc | undefined {
  const example = getExample(slug);
  if (!example) return undefined;
  const file = path.join(process.cwd(), 'public', 'examples', `${slug}.json`);
  if (fs.existsSync(file)) {
    try {
      return migrate(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      // Fall back to the untrained version.
    }
  }
  return example.build();
}
