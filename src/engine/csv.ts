/** Learners' own tables: parse CSV text into an x/y dataset. */
import { oneHot } from './kernels';
import type { Dataset } from './datasets';
import { Rng } from './rng';
import { tensor } from './tensor';

export interface CsvOptions {
  /** How many columns on the right are the answers (y). */
  yColumns: number;
  /** Treat y as class numbers (one-hot) instead of numbers to predict. */
  classes: boolean;
}

export function parseCsv(text: string, opts: CsvOptions): Dataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/[,;\t]/).map((c) => c.trim()));
  if (rows.length === 0) throw new Error('The table is empty.');
  const numeric = (r: string[]) => r.every((c) => c !== '' && Number.isFinite(Number(c)));
  const body = numeric(rows[0]) ? rows : rows.slice(1);
  if (body.length < 2) throw new Error('The table needs at least two rows of numbers.');
  const width = body[0].length;
  body.forEach((r, i) => {
    if (r.length !== width) throw new Error(`Row ${i + 1} has ${r.length} values but the first row has ${width}.`);
    if (!numeric(r)) throw new Error(`Row ${i + 1} has something that isn't a number: ${r.join(', ')}`);
  });
  const yCols = Math.min(Math.max(0, opts.yColumns), width - 1);
  const xCols = width - yCols;
  if (xCols < 1) throw new Error('Leave at least one column for x.');
  const n = body.length;
  const x = tensor([n, xCols], body.flatMap((r) => r.slice(0, xCols).map(Number)));
  let y = yCols > 0 ? tensor([n, yCols], body.flatMap((r) => r.slice(xCols).map(Number))) : tensor([n, 1]);
  let classes: number | undefined;
  if (opts.classes && yCols === 1) {
    const ids = Array.from(y.data, (v) => Math.round(v));
    if (ids.some((v) => v < 0)) throw new Error('Class numbers must be 0, 1, 2, …');
    classes = Math.max(...ids) + 1;
    y = oneHot(tensor([n], ids), classes);
  }
  // Same split rule as built-in datasets: 20% held out, fixed.
  const order = new Rng(1234).shuffle(Array.from({ length: n }, (_, i) => i));
  const nTest = n >= 10 ? Math.round(n * 0.2) : 0;
  const pick = (rows: number[], t: typeof x) => {
    const w = t.data.length / t.shape[0];
    const data = new Float64Array(rows.length * w);
    rows.forEach((r, i) => data.set(t.data.subarray(r * w, (r + 1) * w), i * w));
    return { shape: [rows.length, w], data };
  };
  const trainRows = order.slice(nTest).sort((a, b) => a - b);
  const testRows = nTest ? order.slice(0, nTest).sort((a, b) => a - b) : trainRows;
  return {
    source: 'csv',
    classes,
    train: { x: pick(trainRows, x), y: pick(trainRows, y) },
    test: { x: pick(testRows, x), y: pick(testRows, y) },
  };
}
