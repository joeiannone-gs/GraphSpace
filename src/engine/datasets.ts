/**
 * Built-in datasets. Synthetic ones are generated from a fixed seed; file-backed ones are fetched
 * from /datasets (browser) or read from public/datasets (tests).
 */
import { oneHot } from './kernels';
import { Rng } from './rng';
import { Tensor, tensor } from './tensor';

export interface Dataset {
  source: string;
  /** Number of classes for classification sets (y is one-hot); undefined for regression. */
  classes?: number;
  train: { x: Tensor; y: Tensor };
  test: { x: Tensor; y: Tensor };
}

export type FetchBytes = (path: string) => Promise<ArrayBuffer>;

const TEST_FRACTION = 0.2;

function rowsOf(t: Tensor, rows: number[]): Tensor {
  const width = t.data.length / t.shape[0];
  const out = new Float64Array(rows.length * width);
  rows.forEach((r, i) => out.set(t.data.subarray(r * width, (r + 1) * width), i * width));
  return { shape: [rows.length, ...t.shape.slice(1)], data: out };
}

/** Deterministic train/test split (the same for everyone). */
function split(source: string, x: Tensor, y: Tensor, classes?: number, testFraction = TEST_FRACTION): Dataset {
  const n = x.shape[0];
  const order = new Rng(1234).shuffle(Array.from({ length: n }, (_, i) => i));
  const nTest = testFraction > 0 ? Math.max(1, Math.round(n * testFraction)) : 0;
  const testRows = order.slice(0, nTest).sort((a, b) => a - b);
  const trainRows = order.slice(nTest).sort((a, b) => a - b);
  return {
    source,
    classes,
    train: { x: rowsOf(x, trainRows), y: rowsOf(y, trainRows) },
    test: nTest ? { x: rowsOf(x, testRows), y: rowsOf(y, testRows) } : { x: rowsOf(x, trainRows), y: rowsOf(y, trainRows) },
  };
}

function labels(ids: number[], classes: number): Tensor {
  return oneHot(tensor([ids.length], ids), classes);
}

function xor(): Dataset {
  const x = tensor([4, 2], [0, 0, 0, 1, 1, 0, 1, 1]);
  return split('xor', x, labels([0, 1, 1, 0], 2), 2, 0);
}

function moons(): Dataset {
  const rng = new Rng(7);
  const n = 400;
  const xs: number[] = [];
  const ids: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % 2;
    const t = Math.PI * rng.next();
    const px = c === 0 ? Math.cos(t) : 1 - Math.cos(t);
    const py = c === 0 ? Math.sin(t) : 0.5 - Math.sin(t);
    xs.push(px - 0.5 + 0.1 * rng.normal(), py - 0.25 + 0.1 * rng.normal());
    ids.push(c);
  }
  return split('moons', tensor([n, 2], xs), labels(ids, 2), 2);
}

function spiral(): Dataset {
  const rng = new Rng(11);
  const perClass = 100;
  const classes = 3;
  const xs: number[] = [];
  const ids: number[] = [];
  for (let c = 0; c < classes; c++) {
    for (let i = 0; i < perClass; i++) {
      const r = i / perClass;
      const t = c * 4 + 4 * r + 0.2 * rng.normal();
      xs.push(r * Math.sin(t), r * Math.cos(t));
      ids.push(c);
    }
  }
  return split('spiral', tensor([perClass * classes, 2], xs), labels(ids, classes), classes);
}

export function decodePoints(json: { shape: number[]; data: number[] }): Dataset {
  const n = json.shape[0];
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = json.data[i * 2];
    y[i] = json.data[i * 2 + 1];
  }
  return split('points-2d', { shape: [n, 1], data: x }, { shape: [n, 1], data: y });
}

/** mnist-200.bin: N×784 uint8 pixels followed by N uint8 labels. */
export function decodeMnist(bytes: ArrayBuffer): Dataset {
  const u8 = new Uint8Array(bytes);
  const n = u8.length / 785;
  if (!Number.isInteger(n)) throw new Error('mnist-200.bin has an unexpected size');
  const x = new Float64Array(n * 784);
  for (let i = 0; i < n * 784; i++) x[i] = u8[i] / 255;
  const ids = Array.from(u8.subarray(n * 784));
  return split('mnist-200', { shape: [n, 784], data: x }, labels(ids, 10), 10);
}

const synthetic: Record<string, () => Dataset> = { xor, moons, spiral };

/** Built-in datasets that need no download (available synchronously). */
export function syntheticDataset(source: string): Dataset | undefined {
  return synthetic[source]?.();
}

export const DATASET_FILES: Record<string, string> = {
  'points-2d': '/datasets/points-2d.json',
  'mnist-200': '/datasets/mnist-200.bin',
};

export async function loadDataset(source: string, fetchBytes: FetchBytes): Promise<Dataset> {
  const make = synthetic[source];
  if (make) return make();
  const path = DATASET_FILES[source];
  if (!path) throw new Error(`Unknown dataset "${source}"`);
  const bytes = await fetchBytes(path);
  if (source === 'points-2d') return decodePoints(JSON.parse(new TextDecoder().decode(bytes)));
  return decodeMnist(bytes);
}

/** Cycles through a dataset split in (optionally shuffled) batches. */
export class BatchIterator {
  private order: number[];
  private cursor = 0;

  constructor(
    private readonly data: { x: Tensor; y: Tensor },
    private readonly batchSize: number,
    private readonly shuffle: boolean,
    private readonly rng: Rng,
  ) {
    this.order = this.freshOrder();
  }

  private freshOrder() {
    const order = Array.from({ length: this.data.x.shape[0] }, (_, i) => i);
    return this.shuffle ? this.rng.shuffle(order) : order;
  }

  private size() {
    const n = this.data.x.shape[0];
    return this.batchSize <= 0 || this.batchSize >= n ? n : this.batchSize;
  }

  /** The first batch in natural order: stable, for looking at values without training. */
  peek(): { x: Tensor; y: Tensor } {
    const rows = Array.from({ length: this.size() }, (_, i) => i);
    return { x: rowsOf(this.data.x, rows), y: rowsOf(this.data.y, rows) };
  }

  next(): { x: Tensor; y: Tensor } {
    const size = this.size();
    if (size === this.data.x.shape[0]) return this.data;
    if (this.cursor + size > this.order.length) {
      this.order = this.freshOrder();
      this.cursor = 0;
    }
    const rows = this.order.slice(this.cursor, this.cursor + size);
    this.cursor += size;
    return { x: rowsOf(this.data.x, rows), y: rowsOf(this.data.y, rows) };
  }
}
