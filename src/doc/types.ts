/**
 * The persisted project document: plain JSON, the single source of truth for a graph.
 * Nodes form a tree through `parent` (null = top level); positions are local to the parent.
 */
export type Id = string;
export type Vec2 = [number, number];

export interface TensorJSON {
  shape: number[];
  data: number[];
}

export interface PortRef {
  node: Id;
  port: string;
}

export interface NodeSource {
  kind: 'builtin' | 'user';
  id: string;
  version: number;
  /** Settings a built-in group was built with (e.g. layer sizes), so it can be rebuilt. */
  params?: Record<string, number>;
}

export interface DocNode {
  id: Id;
  type: string;
  parent: Id | null;
  pos: Vec2;
  label?: string;
  /** Learner-facing markdown note shown in the Info panel. */
  note?: string;
  params: Record<string, unknown>;
  /** Where a composite came from (provenance only; instances are independent copies). */
  source?: NodeSource;
}

export interface DocEdge {
  id: Id;
  from: PortRef;
  to: PortRef;
  /** Carries the source's value from the previous iteration; excluded from ordering and backprop. */
  kind?: 'feedback';
}

export interface TrainingConfig {
  optimizer: 'sgd' | 'adam';
  lr: number;
  steps: number;
  seed: number;
  momentum: number;
}

/** auto: straight where a straight line is clear, right angles where it would cross nodes or go backwards. */
export type EdgeStyle = 'auto' | 'orthogonal' | 'straight';

export interface ProjectDoc {
  schemaVersion: 1;
  nodes: Record<Id, DocNode>;
  edges: Record<Id, DocEdge>;
  training: TrainingConfig;
  generate: { steps: number };
  /** Flow direction, and how connections are drawn (automatic when unset). */
  layout: { direction: 'up' | 'right'; edges?: EdgeStyle };
  info: { description: string };
}

export const CURRENT_SCHEMA_VERSION = 1;

export function emptyDoc(): ProjectDoc {
  return {
    schemaVersion: 1,
    nodes: {},
    edges: {},
    training: { optimizer: 'adam', lr: 0.01, steps: 500, seed: 1, momentum: 0.9 },
    generate: { steps: 20 },
    layout: { direction: 'up' },
    info: { description: '' },
  };
}
