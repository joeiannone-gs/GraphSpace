/**
 * A live model built from one project document: holds parameter values, optimizer state and
 * dataset iterators across edits, and runs evaluation, training steps and generation.
 * Pure TypeScript with no DOM dependencies — the worker wraps it, and tests drive it directly.
 */
import type { Id, ProjectDoc, TensorJSON } from '@/doc/types';
import type { DatasetParams, ParameterParams, RunEnv, RunMode } from '@/nodes/types';
import { Compiled, NodeError, compile, portKey } from './compile';
import { BatchIterator, Dataset, FetchBytes, loadDataset } from './datasets';
import { Optimizer } from './optim';
import { Rng, hashString } from './rng';
import { ForwardResult, forward } from './run';
import { Tape, Var } from './tape';
import { Tensor, TensorStats, sameShape, sizeOf, stats, tensor } from './tensor';

export interface TensorSnap {
  shape: number[];
  stats: TensorStats;
  /** Row-major values, cut off after a size limit (see `truncated`). */
  data: Float64Array;
  truncated: boolean;
}

export type NodeStatus = 'ok' | 'error' | 'blocked';

export interface NodeSnap {
  status: NodeStatus;
  error?: NodeError;
  /** Port name → key into `tensors`/`grads`. */
  inputs: Record<string, string>;
  outputs: Record<string, string>;
}

export interface SessionSnapshot {
  step: number;
  loss: number | null;
  lossHistory: number[];
  tensors: Record<string, TensorSnap>;
  grads: Record<string, TensorSnap>;
  nodes: Record<Id, NodeSnap>;
  /** How many trainable Parameters received a gradient from the loss in the last run. */
  trainable: number;
  /** Text some nodes show (e.g. the text generated so far). */
  texts: Record<Id, string>;
}

export interface SnapshotOptions {
  /** Max values kept per tensor (stats always cover everything). */
  maxValues?: number;
  /** Larger limit for tensors feeding these nodes (e.g. image displays). */
  wideNodes?: Set<Id>;
}

const MAX_HISTORY = 2000;

function snap(t: Tensor, max: number): TensorSnap {
  const truncated = t.data.length > max;
  return {
    shape: [...t.shape],
    stats: stats(t),
    data: truncated ? t.data.slice(0, max) : new Float64Array(t.data),
    truncated,
  };
}

function initParameter(p: ParameterParams, rng: Rng): Tensor {
  const n = sizeOf(p.shape);
  if (p.value && sameShape(p.value.shape, p.shape)) return tensor(p.shape, p.value.data);
  const t = tensor(p.shape);
  switch (p.init) {
    case 'zeros':
      break;
    case 'ones':
      t.data.fill(1);
      break;
    case 'normal':
      for (let i = 0; i < n; i++) t.data[i] = rng.normal() * p.scale;
      break;
    case 'uniform':
      for (let i = 0; i < n; i++) t.data[i] = (rng.next() * 2 - 1) * p.scale;
      break;
    case 'glorot': {
      const fanOut = p.shape[p.shape.length - 1] ?? 1;
      const fanIn = p.shape.length >= 2 ? p.shape[p.shape.length - 2] : fanOut;
      const limit = Math.sqrt(6 / (fanIn + fanOut));
      for (let i = 0; i < n; i++) t.data[i] = (rng.next() * 2 - 1) * limit;
      break;
    }
  }
  return t;
}

export class Session {
  private doc: ProjectDoc | null = null;
  private compiled: Compiled | null = null;
  private datasets = new Map<string, Dataset>();
  private datasetErrors = new Map<string, string>();
  private iterators = new Map<string, BatchIterator>();
  private params = new Map<Id, { key: string; value: Tensor }>();
  private paramVars = new Map<number, Id>();
  private optimizer = new Optimizer({ optimizer: 'adam', lr: 0.01, momentum: 0.9 });
  private previous = new Map<string, Tensor>();
  private state = new Map<Id, unknown>();
  private last: ForwardResult | null = null;
  private lastGrads = new Map<number, Tensor>();

  step = 0;
  lossHistory: number[] = [];

  constructor(private readonly fetchBytes: FetchBytes) {}

  get compiledGraph(): Compiled | null {
    return this.compiled;
  }

  /** Compile a new version of the document. Parameters whose settings didn't change keep their values. */
  async load(doc: ProjectDoc): Promise<void> {
    this.doc = doc;
    this.compiled = compile(doc);
    this.optimizer.config = { optimizer: doc.training.optimizer, lr: doc.training.lr, momentum: doc.training.momentum };
    const sources = new Set<string>();
    for (const n of this.compiled.order) {
      if (n.type === 'dataset') sources.add(String((n.params as unknown as DatasetParams).source));
    }
    await Promise.all(
      [...sources]
        .filter((s) => !this.datasets.has(s))
        .map(async (s) => {
          try {
            this.datasets.set(s, await loadDataset(s, this.fetchBytes));
            this.datasetErrors.delete(s);
          } catch (err) {
            this.datasetErrors.set(s, err instanceof Error ? err.message : String(err));
          }
        }),
    );
    const live = new Set(this.compiled.order.map((n) => n.id));
    for (const id of [...this.params.keys()]) if (!live.has(id)) this.params.delete(id);
  }

  /** Apply new optimizer settings and step budget without recompiling. */
  setTraining(training: ProjectDoc['training']) {
    if (this.doc) this.doc = { ...this.doc, training };
    this.optimizer.config = { optimizer: training.optimizer, lr: training.lr, momentum: training.momentum };
  }

  /** Start training over: fresh parameters, optimizer state, iterators and history. */
  resetTraining() {
    this.params.clear();
    this.optimizer.reset();
    this.iterators.clear();
    this.previous.clear();
    this.state.clear();
    this.step = 0;
    this.lossHistory = [];
  }

  private env(mode: RunMode, iter: number): RunEnv {
    const doc = this.doc!;
    const seed = doc.training.seed;
    return {
      mode,
      iter,
      rng: new Rng((seed * 1_000_003 + iter) >>> 0),
      parameter: (nodeId: string, p: ParameterParams): Var => {
        const key = JSON.stringify([p.shape, p.init, p.scale, p.value ?? null, seed]);
        let entry = this.params.get(nodeId);
        if (!entry || entry.key !== key) {
          entry = { key, value: initParameter(p, new Rng((seed ^ hashString(nodeId)) >>> 0)) };
          this.params.set(nodeId, entry);
          this.optimizer.reset(nodeId);
        }
        return this.tapeOf(p.trainable, nodeId, entry.value);
      },
      batch: (nodeId: string, p: DatasetParams) => {
        const ds = this.datasets.get(p.source);
        if (!ds) throw new Error(this.datasetErrors.get(p.source) ?? `Dataset "${p.source}" isn't loaded`);
        const key = `${nodeId}|${p.source}|${p.split}|${p.batchSize}|${p.shuffle}`;
        let it = this.iterators.get(key);
        if (!it) {
          it = new BatchIterator(ds[p.split], p.batchSize, p.shuffle, new Rng((seed ^ hashString(key)) >>> 0));
          this.iterators.set(key, it);
        }
        return mode === 'train' ? it.next() : it.peek();
      },
      state: <T>(nodeId: string, init: () => T): T => {
        if (!this.state.has(nodeId)) this.state.set(nodeId, init());
        return this.state.get(nodeId) as T;
      },
    };
  }

  private currentTape: Tape | null = null;

  private tapeOf(trainable: boolean, nodeId: Id, value: Tensor): Var {
    const tape = this.currentTape!;
    if (!trainable) return tape.constant(value);
    const v = tape.leaf(value);
    this.paramVars.set(v.id, nodeId);
    return v;
  }

  private run(mode: RunMode, iter: number): { result: ForwardResult; grads: Map<number, Tensor>; tape: Tape } {
    if (!this.compiled || !this.doc) throw new Error('No document loaded');
    const tape = new Tape();
    this.currentTape = tape;
    this.paramVars.clear();
    const result = forward(this.compiled, tape, this.env(mode, iter), this.previous);
    this.currentTape = null;
    const grads = result.loss && mode !== 'generate' ? tape.backward(result.loss) : new Map<number, Tensor>();
    return { result, grads, tape };
  }

  /** Run once without changing anything, to show current values (and gradients, if there is a loss). */
  evaluate(): void {
    const { result, grads } = this.run('eval', this.step);
    this.last = result;
    this.lastGrads = grads;
  }

  /** Number of trainable parameters that currently influence the loss. */
  get trainableCount(): number {
    let n = 0;
    for (const [varId] of this.paramVars) if (this.lastGrads.has(varId)) n++;
    return n;
  }

  /** One optimization step. Returns the loss before the update (null if there is no usable loss). */
  trainStep(): number | null {
    const { result, grads } = this.run('train', this.step);
    this.last = result;
    this.lastGrads = grads;
    if (!result.loss) return null;
    for (const [varId, nodeId] of this.paramVars) {
      const g = grads.get(varId);
      const entry = this.params.get(nodeId);
      if (g && entry) this.optimizer.step(nodeId, entry.value, g);
    }
    const loss = result.loss.value.data[0];
    this.step++;
    this.lossHistory.push(loss);
    if (this.lossHistory.length > MAX_HISTORY) {
      this.lossHistory = this.lossHistory.filter((_, i) => i % 2 === 0);
    }
    return loss;
  }

  /** Run `steps` iterations, feeding each feedback edge the previous iteration's value. */
  generate(steps: number): void {
    this.previous.clear();
    for (let i = 0; i < steps; i++) {
      const { result } = this.run('generate', i);
      this.last = result;
      this.lastGrads = new Map();
      const next = new Map<string, Tensor>();
      for (const key of this.compiled!.feedbackSources) {
        const v = result.values.get(key);
        if (v) next.set(key, v.value);
      }
      this.previous = next;
    }
    this.previous.clear();
  }

  paramValues(): Record<Id, TensorJSON> {
    const out: Record<Id, TensorJSON> = {};
    for (const [id, { value }] of this.params) out[id] = { shape: [...value.shape], data: Array.from(value.data) };
    return out;
  }

  snapshot(options: SnapshotOptions = {}): SessionSnapshot {
    const max = options.maxValues ?? 4096;
    const tensors: Record<string, TensorSnap> = {};
    const grads: Record<string, TensorSnap> = {};
    const nodes: Record<Id, NodeSnap> = {};
    const compiled = this.compiled;
    const last = this.last;
    if (compiled && last) {
      const keyOf = new Map<number, string>();
      for (const [key, v] of last.values) {
        keyOf.set(v.id, key);
        tensors[key] = snap(v.value, max);
        const g = this.lastGrads.get(v.id);
        if (g) grads[key] = snap(g, max);
      }
      for (const node of compiled.order) {
        const outputs: Record<string, string> = {};
        for (const key of last.values.keys()) {
          if (key.startsWith(`${node.id}:`)) outputs[key.slice(node.id.length + 1)] = key;
        }
        const inputs: Record<string, string> = {};
        const vars = last.inputVars.get(node.id) ?? {};
        const wide = options.wideNodes?.has(node.id);
        for (const [port, v] of Object.entries(vars)) {
          if (!v) continue;
          let key = keyOf.get(v.id);
          if (!key) {
            key = `${node.id}:in:${port}`;
            tensors[key] = snap(v.value, max);
          }
          if (wide && tensors[key].truncated) tensors[key] = snap(v.value, Math.max(max, 16 * 1024));
          inputs[port] = key;
        }
        const err = last.errors.get(node.id);
        nodes[node.id] = { status: err ? (err.code === 'blocked' ? 'blocked' : 'error') : 'ok', error: err, inputs, outputs };
      }
      for (const [id, err] of last.errors) {
        if (!nodes[id]) nodes[id] = { status: err.code === 'blocked' ? 'blocked' : 'error', error: err, inputs: {}, outputs: {} };
      }
      for (const [alias, src] of compiled.aliases) {
        const key = portKey(src.node, src.port);
        if (!tensors[key]) continue;
        const [id, port] = alias.split(':');
        nodes[id] ??= { status: 'ok', inputs: {}, outputs: {} };
        if (port === 'in') nodes[id].inputs.in = key;
        else nodes[id].outputs[port] = key;
      }
    }
    return {
      step: this.step,
      loss: this.lossHistory.length ? this.lossHistory[this.lossHistory.length - 1] : null,
      lossHistory: [...this.lossHistory],
      tensors,
      grads,
      nodes,
      trainable: this.trainableCount,
      texts: Object.fromEntries(
        [...this.state].flatMap(([id, st]) =>
          st && typeof st === 'object' && typeof (st as { text?: unknown }).text === 'string' ? [[id, (st as { text: string }).text]] : [],
        ),
      ),
    };
  }

  /** The loss value from the most recent run, if any. */
  get currentLoss(): number | null {
    return this.last?.loss ? this.last.loss.value.data[0] : null;
  }

  /** Errors from the most recent run (static and runtime). */
  get errors(): Map<Id, NodeError> {
    return this.last?.errors ?? this.compiled?.errors ?? new Map();
  }

  /** Value of a node's output from the most recent run (groups and boundary nodes resolve through). */
  valueOf(nodeId: Id, port = 'out'): Tensor | undefined {
    const direct = this.last?.values.get(portKey(nodeId, port))?.value;
    if (direct) return direct;
    const alias = this.compiled?.aliases.get(portKey(nodeId, port));
    return alias ? this.last?.values.get(portKey(alias.node, alias.port))?.value : undefined;
  }
}
