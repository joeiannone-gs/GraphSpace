/** Character-level text data: built-in corpora, vocabularies, and windows for next-character prediction. */
import { Rng } from './rng';
import { Tensor } from './tensor';

/** Public-domain texts small enough to learn in a browser in a minute. */
export const CORPORA: Record<string, { label: string; text: string }> = {
  sonnets: {
    label: 'Shakespeare sonnets (excerpt)',
    text: `Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date;
Sometime too hot the eye of heaven shines,
And often is his gold complexion dimm'd;
And every fair from fair sometime declines,
By chance or nature's changing course untrimm'd;
But thy eternal summer shall not fade,
Nor lose possession of that fair thou ow'st;
Nor shall death brag thou wander'st in his shade,
When in eternal lines to time thou grow'st:
So long as men can breathe or eyes can see,
So long lives this, and this gives life to thee.
Let me not to the marriage of true minds
Admit impediments. Love is not love
Which alters when it alteration finds,
Or bends with the remover to remove.
O no! it is an ever-fixed mark
That looks on tempests and is never shaken;
It is the star to every wand'ring bark,
Whose worth's unknown, although his height be taken.
Love's not Time's fool, though rosy lips and cheeks
Within his bending sickle's compass come;
Love alters not with his brief hours and weeks,
But bears it out even to the edge of doom.
If this be error and upon me proved,
I never writ, nor no man ever loved.
`,
  },
  counting: {
    label: 'Counting (very easy)',
    text: 'one two three four five six seven eight nine ten. '.repeat(12),
  },
  abc: {
    label: 'The alphabet, repeated (easiest)',
    text: 'abcdefghijklmnopqrstuvwxyz '.repeat(20),
  },
};

export interface Vocab {
  chars: string[];
  index: Map<string, number>;
}

export function vocabOf(text: string): Vocab {
  const chars = [...new Set(text)].sort();
  return { chars, index: new Map(chars.map((c, i) => [c, i])) };
}

export function corpusText(source: string, custom: string): string {
  if (source === 'custom') return custom.length >= 2 ? custom : 'ab';
  return (CORPORA[source] ?? CORPORA.sonnets).text;
}

export const encode = (v: Vocab, s: string): number[] => [...s].map((c) => v.index.get(c) ?? 0);
export const decode = (v: Vocab, ids: ArrayLike<number>): string => Array.from(ids, (i) => v.chars[Math.round(i)] ?? '?').join('');

/**
 * `batch` windows of `context` characters (x) and the same windows shifted by one (y).
 * Random positions when training; fixed, evenly spaced ones otherwise.
 */
export function textBatch(ids: number[], context: number, batch: number, rng: Rng | null): { x: Tensor; y: Tensor } {
  const span = ids.length - context - 1;
  if (span < 1) throw new Error(`The text needs more than ${context + 1} characters for a context of ${context}.`);
  const x = new Float64Array(batch * context);
  const y = new Float64Array(batch * context);
  for (let b = 0; b < batch; b++) {
    const start = rng ? rng.int(span) : Math.floor((b * span) / batch);
    for (let t = 0; t < context; t++) {
      x[b * context + t] = ids[start + t];
      y[b * context + t] = ids[start + t + 1];
    }
  }
  return { x: { shape: [batch, context], data: x }, y: { shape: [batch, context], data: y } };
}
