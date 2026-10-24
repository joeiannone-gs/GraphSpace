/** Graph (network) datasets for graph neural networks: who is connected to whom, plus node labels. */
import type { FetchBytes } from './datasets';
import { oneHot } from './kernels';
import { Tensor, tensor } from './tensor';

export interface GraphJSON {
  name: string;
  n: number;
  edges: [number, number][];
  classes: string[];
  labels: number[];
  labeled: number[];
  features: number[][] | null;
  pos: [number, number][];
}

export interface GraphDataset {
  name: string;
  classes: string[];
  /** Normalized adjacency with self-loops, D^-1/2 (A + I) D^-1/2: one GNN step mixes each node with its neighbours. */
  adj: Tensor;
  /** Node features (one-hot ids when the dataset has none). */
  x: Tensor;
  /** One-hot labels for every node (for measuring accuracy). */
  y: Tensor;
  /** Ids of the few labeled nodes training may see, and their labels. */
  labeled: Tensor;
  yLabeled: Tensor;
  /** Layout positions for drawing. */
  pos: Tensor;
}

export const GRAPH_SOURCES = [
  { value: 'karate', label: "Zachary's karate club (34 members)" },
  { value: 'communities', label: 'Three communities (60 people)' },
];

const FILES: Record<string, string> = { karate: '/datasets/karate.json', communities: '/datasets/communities.json' };

export function buildGraph(g: GraphJSON): GraphDataset {
  const n = g.n;
  const a = new Float64Array(n * n);
  for (let i = 0; i < n; i++) a[i * n + i] = 1;
  for (const [i, j] of g.edges) {
    a[i * n + j] = 1;
    a[j * n + i] = 1;
  }
  const deg = Array.from({ length: n }, (_, i) => {
    let d = 0;
    for (let j = 0; j < n; j++) d += a[i * n + j];
    return d;
  });
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a[i * n + j] /= Math.sqrt(deg[i] * deg[j]);
  const C = g.classes.length;
  const x = g.features ? tensor([n, g.features[0].length], g.features.flat()) : oneHot(tensor([n], Array.from({ length: n }, (_, i) => i)), n);
  return {
    name: g.name,
    classes: g.classes,
    adj: { shape: [n, n], data: a },
    x,
    y: oneHot(tensor([n], g.labels), C),
    labeled: tensor([g.labeled.length], g.labeled),
    yLabeled: oneHot(tensor([g.labeled.length], g.labeled.map((i) => g.labels[i])), C),
    pos: tensor([n, 2], g.pos.flat()),
  };
}

export async function loadGraph(source: string, fetchBytes: FetchBytes): Promise<GraphDataset> {
  const path = FILES[source];
  if (!path) throw new Error(`Unknown graph "${source}"`);
  return buildGraph(JSON.parse(new TextDecoder().decode(await fetchBytes(path))) as GraphJSON);
}
