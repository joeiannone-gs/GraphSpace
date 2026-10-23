import type { z } from 'zod';
import type { Rng } from '@/engine/rng';
import type { Tape, Var } from '@/engine/tape';
import type { Tensor } from '@/engine/tensor';

export interface PortDef {
  name: string;
  label?: string;
  doc?: string;
  /** May be left unconnected. */
  optional?: boolean;
  /** May be fed by a feedback edge (previous iteration's value). */
  feedback?: boolean;
}

export type Category =
  | 'Data'
  | 'Math'
  | 'Activations'
  | 'Linear algebra'
  | 'Loss'
  | 'Training'
  | 'Text'
  | 'Diffusion'
  | 'Display'
  | 'Structure';

/** How the canvas draws a node's live value. */
export type DisplayKind = 'value' | 'tensor' | 'parameter' | 'dataset' | 'scatter' | 'points' | 'image' | 'loss' | 'text' | 'none';

export type FieldKind = 'number' | 'int' | 'shape' | 'axes' | 'select' | 'bool' | 'text' | 'longtext' | 'tensor' | 'slice';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  help?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export type RunMode = 'eval' | 'train' | 'generate';

export interface DatasetParams {
  source: string;
  batchSize: number;
  shuffle: boolean;
  split: 'train' | 'test';
  /** For source 'csv': the table and how to read it. */
  csv?: string;
  yColumns?: number;
  classes?: boolean;
}

export interface ParameterParams {
  shape: number[];
  init: 'zeros' | 'ones' | 'normal' | 'uniform' | 'glorot';
  scale: number;
  trainable: boolean;
  value?: { shape: number[]; data: number[] };
}

/** What the executor provides to node implementations. */
export interface RunEnv {
  mode: RunMode;
  /** Training step (train mode) or generation iteration (generate mode). */
  iter: number;
  rng: Rng;
  parameter(nodeId: string, p: ParameterParams): Var;
  batch(nodeId: string, p: DatasetParams): { x: Tensor; y: Tensor };
  /** Scratch state that persists across runs for one node (iterators, counters). */
  state<T>(nodeId: string, init: () => T): T;
}

export interface ForwardCtx<P> {
  tape: Tape;
  nodeId: string;
  p: P;
  in: Record<string, Var | undefined>;
  env: RunEnv;
}

export interface NodeDef<P = Record<string, unknown>> {
  type: string;
  label: string;
  category: Category;
  /** Markdown shown in the palette tooltip, Inspector and help. */
  explanation: string;
  icon?: string;
  display: DisplayKind;
  inputs: PortDef[] | ((p: P) => PortDef[]);
  outputs: PortDef[] | ((p: P) => PortDef[]);
  params: z.ZodType<P>;
  fields: FieldSpec[];
  /** False for nodes whose outputs carry no gradient (argmax, accuracy, sampling). */
  differentiable: boolean;
  /** Hidden from the palette (structure nodes created by other means). */
  hidden?: boolean;
  forward?: (ctx: ForwardCtx<P>) => Record<string, Var>;
}

/** Helper that keeps P inferred from the params schema. */
export function defineNode<S extends z.ZodType>(
  def: Omit<NodeDef<z.output<S>>, 'params'> & { params: S },
): NodeDef<z.output<S>> {
  return def as unknown as NodeDef<z.output<S>>;
}
